#include "UBSharingController.h"
#include "core/UBApplication.h"
#include "core/UBSettings.h"
#include "board/UBBoardController.h"
#include "board/UBBoardView.h"
#include "domain/UBGraphicsScene.h"
#include "domain/UBGraphicsTextItem.h"

#include <QApplication>
#include <QClipboard>
#include <QMessageBox>
#include <QPainter>
#include <QBuffer>
#include <QDateTime>
#include <QDebug>
#include <QGraphicsLineItem>
#include <QGraphicsEllipseItem>
#include <QGraphicsTextItem>

UBSharingController* UBSharingController::s_instance = nullptr;
UBSharingController* UBSharingController::instance() { return s_instance; }

UBSharingController::UBSharingController(QObject* parent) : QObject(parent)
{
    s_instance = this;

    // Full reconciliation snapshot every 3 s — brings drifted clients up to date
    m_reconcileTimer = new QTimer(this);
    m_reconcileTimer->setInterval(3000);
    connect(m_reconcileTimer, &QTimer::timeout,
            this, &UBSharingController::broadcastReconciliationSnapshot);

    m_cursorCleanupTimer = new QTimer(this);
    m_cursorCleanupTimer->setInterval(5000);
    connect(m_cursorCleanupTimer, &QTimer::timeout,
            this, &UBSharingController::cleanupStaleCursors);
}

UBSharingController::~UBSharingController()
{
    if (m_hosting) toggleHosting();
    clearAllCursorOverlays();
    s_instance = nullptr;
}

// ── Start / stop ──────────────────────────────────────────────────────────────
void UBSharingController::toggleHosting()
{
    if (m_hosting) {
        m_reconcileTimer->stop();
        m_cursorCleanupTimer->stop();
        clearAllCursorOverlays();
        if (m_ngrok)  { m_ngrok->stopTunnel();  m_ngrok->deleteLater();  m_ngrok  = nullptr; }
        if (m_server) { m_server->stop();        m_server->deleteLater(); m_server = nullptr; }
        m_hosting = false;
        emit hostingStopped();
        emit statusMessage(tr("Whiteboard hosting stopped."));
        return;
    }

    m_server = new UBSharingServer(this);
    connect(m_server, &UBSharingServer::eventFromClient,    this, &UBSharingController::onClientEvent);
    connect(m_server, &UBSharingServer::clientConnected,    this, &UBSharingController::onClientConnected);
    connect(m_server, &UBSharingServer::clientDisconnected, this, &UBSharingController::onClientDisconnected);
    connect(m_server, &UBSharingServer::newGuest,           this, &UBSharingController::onNewGuest);

    if (!m_server->start(8080)) {
        emit statusMessage(tr("Failed to start sharing server."));
        m_server->deleteLater(); m_server = nullptr;
        return;
    }

    m_ngrok = new UBNgrokManager(this);
    connect(m_ngrok, &UBNgrokManager::urlReady,      this, &UBSharingController::onUrlReady);
    connect(m_ngrok, &UBNgrokManager::error,         this, &UBSharingController::onNgrokError);
    connect(m_ngrok, &UBNgrokManager::statusMessage, this, &UBSharingController::statusMessage);

    m_hosting = true;
    m_reconcileTimer->start();
    m_cursorCleanupTimer->start();
    wireBoard();

    // React to page switches
    if (UBApplication::boardController)
        connect(UBApplication::boardController, &UBBoardController::activeSceneChanged,
                this, &UBSharingController::onPageChanged, Qt::UniqueConnection);

    emit statusMessage(tr("Starting ngrok tunnel..."));
    m_ngrok->startTunnel(m_server->port());
}

// ── Wire event filter on board viewport ──────────────────────────────────────
void UBSharingController::wireBoard()
{
    if (!UBApplication::boardController) return;
    UBBoardView* view = UBApplication::boardController->controlView();
    if (!view || !view->viewport()) return;
    if (m_boardFilter) return; // already wired

    m_boardFilter = new UBBoardEventFilter(view, this);

    connect(m_boardFilter, &UBBoardEventFilter::cursorMoved,
            this, &UBSharingController::onHostCursorMoved);

    connect(m_boardFilter, &UBBoardEventFilter::strokeSegment,
            this, &UBSharingController::onHostStroke);

    connect(m_boardFilter, &UBBoardEventFilter::strokeEnded,
            this, &UBSharingController::onHostStrokeEnded);

    view->viewport()->installEventFilter(m_boardFilter);
    view->viewport()->setMouseTracking(true);
}

// ── Host stroke streaming ─────────────────────────────────────────────────────
void UBSharingController::onHostStroke(QPointF from, QPointF to)
{
    if (!m_server || !m_hosting || m_server->clientCount() == 0) return;

    // Read current pen state from board controller
    QString color = "#222222";
    double width  = 3.0;
    if (UBApplication::boardController) {
        auto scene = UBApplication::boardController->activeScene();
        bool dark  = scene && scene->isDarkBackground();
        QColor c   = dark
            ? UBApplication::boardController->penColorOnDarkBackground()
            : UBApplication::boardController->penColorOnLightBackground();
        color = c.name();
        // UBSettings for width
        if (UBSettings::settings()) {
            auto* s = UBSettings::settings();
            // UBSettings exposes pen width via currentPenWidth or similar
            // Fall back to a reasonable default if unavailable
            (void)s; // suppress unused warning
        }
    }

    QJsonObject ev;
    ev["type"]  = "hdraw";   // host-draw — clients render immediately
    ev["x"]     = from.x();  ev["y"]  = from.y();
    ev["x2"]    = to.x();    ev["y2"] = to.y();
    ev["color"] = color;
    ev["width"] = width;
    m_server->broadcast(ev);
}

void UBSharingController::onHostStrokeEnded()
{
    // Trigger an immediate reconciliation snapshot so clients stay in sync
    // after each stroke (instead of waiting up to 3 s)
    broadcastReconciliationSnapshot();
}

// ── Snapshot (reconciliation, not primary sync) ───────────────────────────────
QImage UBSharingController::captureSnapshot() const
{
    if (!UBApplication::boardController) return {};
    auto scene = UBApplication::boardController->activeScene();
    if (!scene) return {};

    QRectF sr = scene->sceneRect();
    if (sr.isEmpty()) sr = QRectF(0, 0, 1920, 1080);

    const double MAX = 1280.0;
    double s = qMin(1.0, qMin(MAX / sr.width(), MAX / sr.height()));
    QSize sz(qMax(1, (int)(sr.width()  * s)), qMax(1, (int)(sr.height() * s)));

    QImage img(sz, QImage::Format_RGB32);
    img.fill(Qt::white);
    QPainter p(&img);
    p.setRenderHint(QPainter::Antialiasing);
    scene->render(&p, QRectF(), sr);
    p.end();
    return img;
}

QByteArray UBSharingController::snapshotJpeg(int quality) const
{
    QImage img = captureSnapshot();
    if (img.isNull()) return {};
    QByteArray jpg;
    QBuffer buf(&jpg);
    buf.open(QIODevice::WriteOnly);
    img.save(&buf, "JPEG", quality);
    return jpg;
}

void UBSharingController::broadcastReconciliationSnapshot()
{
    if (!m_server || !m_hosting || m_server->clientCount() == 0) return;
    QByteArray jpg = snapshotJpeg(70);
    if (jpg.isEmpty()) return;

    QRectF sr;
    if (UBApplication::boardController && UBApplication::boardController->activeScene())
        sr = UBApplication::boardController->activeScene()->sceneRect();
    if (sr.isEmpty()) sr = QRectF(0, 0, 1920, 1080);

    QJsonObject ev;
    ev["type"]   = "snapshot";
    ev["data"]   = QString::fromLatin1(jpg.toBase64());
    ev["sceneW"] = sr.width();  ev["sceneH"] = sr.height();
    ev["sceneX"] = sr.x();      ev["sceneY"] = sr.y();
    m_server->broadcast(ev);
}

// ── New guest — send full init ────────────────────────────────────────────────
void UBSharingController::onNewGuest(QWebSocket* client)
{
    if (!m_server) return;

    QByteArray jpg = snapshotJpeg(80);

    QRectF sr;
    if (UBApplication::boardController && UBApplication::boardController->activeScene())
        sr = UBApplication::boardController->activeScene()->sceneRect();
    if (sr.isEmpty()) sr = QRectF(0, 0, 1920, 1080);

    int pageIdx = UBApplication::boardController
                      ? UBApplication::boardController->activeSceneIndex() : 0;

    QJsonObject ev;
    ev["type"]    = "init";
    ev["canvas"]  = jpg.isEmpty() ? QString() : QString::fromLatin1(jpg.toBase64());
    ev["sceneW"]  = sr.width();  ev["sceneH"]  = sr.height();
    ev["sceneX"]  = sr.x();      ev["sceneY"]  = sr.y();
    ev["pageIdx"] = pageIdx;
    m_server->sendTo(client, ev);
}

// ── Page change ───────────────────────────────────────────────────────────────
void UBSharingController::onPageChanged()
{
    if (!m_server || !m_hosting || m_server->clientCount() == 0) return;
    QByteArray jpg = snapshotJpeg(75);

    QRectF sr;
    if (UBApplication::boardController && UBApplication::boardController->activeScene())
        sr = UBApplication::boardController->activeScene()->sceneRect();
    if (sr.isEmpty()) sr = QRectF(0, 0, 1920, 1080);

    int pageIdx = UBApplication::boardController
                      ? UBApplication::boardController->activeSceneIndex() : 0;

    QJsonObject ev;
    ev["type"]    = "page_change";
    ev["canvas"]  = jpg.isEmpty() ? QString() : QString::fromLatin1(jpg.toBase64());
    ev["sceneW"]  = sr.width();  ev["sceneH"]  = sr.height();
    ev["sceneX"]  = sr.x();      ev["sceneY"]  = sr.y();
    ev["pageIdx"] = pageIdx;
    m_server->broadcast(ev);
}

// ── Guest → Host ──────────────────────────────────────────────────────────────
void UBSharingController::applyGuestEventToScene(const QJsonObject& ev)
{
    if (!UBApplication::boardController) return;
    auto scene = UBApplication::boardController->activeScene();
    if (!scene) return;

    const QString type    = ev["type"].toString();
    const QString guestId = ev["name"].toString(ev["id"].toString("guest"));

    if (type == "draw") {
        QColor color(ev["color"].toString("#2563eb"));
        double width = ev["width"].toDouble(3.0);
        QPen pen(color, width, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
        auto* item = scene->addLine(
            ev["x"].toDouble(), ev["y"].toDouble(),
            ev["x2"].toDouble(), ev["y2"].toDouble(), pen);
        item->setData(0, guestId);
    }
    else if (type == "erase") {
        double x = ev["x"].toDouble(), y = ev["y"].toDouble();
        double r = ev["radius"].toDouble(20.0);
        auto* item = scene->addEllipse(x-r, y-r, r*2, r*2,
                                       QPen(Qt::NoPen), QBrush(Qt::white));
        item->setZValue(1000);
        item->setData(0, guestId);
    }
    else if (type == "text") {
        auto* item = scene->addText(ev["content"].toString());
        item->setPos(ev["x"].toDouble(), ev["y"].toDouble());
        item->setDefaultTextColor(QColor(ev["color"].toString("#000")));
        QFont f = item->font();
        f.setPointSize(qMax(6, ev["size"].toInt(18)));
        item->setFont(f);
        item->setData(0, guestId);
    }
}

void UBSharingController::onClientEvent(const QJsonObject& ev, QWebSocket* /*sender*/)
{
    const QString type = ev["type"].toString();
    if (type == "cursor") {
        const QString id   = ev["id"].toString();
        const QString name = ev["name"].toString(id);
        m_guestLastSeen[id] = QDateTime::currentMSecsSinceEpoch();
        updateGuestCursorOverlay(id, ev["x"].toDouble(), ev["y"].toDouble(),
                                 ev["color"].toString("#f90"), name);
    } else if (type != "hello") {
        applyGuestEventToScene(ev);
    }
    emit guestEventReceived(ev);
}

void UBSharingController::onClientConnected(int total)
{
    emit clientCountChanged(total);
    emit statusMessage(tr("%1 guest(s) connected").arg(total));
}

void UBSharingController::onClientDisconnected(int total)
{
    emit clientCountChanged(total);
}

// ── Host cursor ───────────────────────────────────────────────────────────────
void UBSharingController::onHostCursorMoved(const QPointF& scenePos)
{
    if (!m_server || !m_hosting) return;
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (now - m_lastCursorMs < 33) return; // ~30 fps
    m_lastCursorMs = now;
    QJsonObject ev;
    ev["type"]  = "cursor";
    ev["id"]    = "host";
    ev["name"]  = "Host";
    ev["color"] = "#4285f4";
    ev["x"]     = scenePos.x();
    ev["y"]     = scenePos.y();
    m_server->broadcast(ev);
}

void UBSharingController::onHostDrawEvent(const QJsonObject& ev)
{
    if (m_server && m_hosting) m_server->broadcast(ev);
}

void UBSharingController::onHostViewportChanged(qreal x, qreal y, qreal scale)
{
    if (!m_server || !m_hosting) return;
    QJsonObject ev;
    ev["type"] = "viewport"; ev["x"] = x; ev["y"] = y; ev["scale"] = scale;
    m_server->broadcast(ev);
}

void UBSharingController::onUrlReady(const QString& url)
{
    QApplication::clipboard()->setText(url);
    emit hostingStarted(url);
    QMessageBox* box = new QMessageBox(QMessageBox::Information,
        tr("Whiteboard Hosted!"),
        tr("Your whiteboard is live!\n\n%1\n\nURL copied to clipboard.").arg(url),
        QMessageBox::Ok);
    box->setAttribute(Qt::WA_DeleteOnClose);
    box->open();
}

void UBSharingController::onNgrokError(const QString& err)
{
    emit statusMessage(tr("ngrok error: %1").arg(err));
    if (m_hosting) toggleHosting();
}

// ── Guest cursor overlays on host view ───────────────────────────────────────
void UBSharingController::updateGuestCursorOverlay(const QString& id, qreal x, qreal y,
                                                    const QString& color, const QString& name)
{
    if (!UBApplication::boardController) return;
    UBBoardView* view = UBApplication::boardController->controlView();
    if (!view) return;

    GuestCursorInfo& info = m_guestCursors[id];
    info.x = x; info.y = y; info.color = color; info.name = name;

    if (!info.label) {
        info.label = new QLabel(view->viewport());
        info.label->setStyleSheet(
            QString("background:%1;color:white;border-radius:10px;"
                    "padding:2px 8px;font-size:11px;font-weight:bold;").arg(color));
        info.label->setAttribute(Qt::WA_TransparentForMouseEvents);
        info.label->show();
    }
    QPoint vp = view->mapFromScene(QPointF(x, y));
    info.label->setText(name.isEmpty() ? id : name);
    info.label->adjustSize();
    info.label->move(vp.x() + 12, vp.y() - 14);
    info.label->raise();
}

void UBSharingController::removeGuestCursorOverlay(const QString& id)
{
    if (!m_guestCursors.contains(id)) return;
    if (m_guestCursors[id].label) m_guestCursors[id].label->deleteLater();
    m_guestCursors.remove(id);
    m_guestLastSeen.remove(id);
}

void UBSharingController::clearAllCursorOverlays()
{
    for (auto& info : m_guestCursors) if (info.label) info.label->deleteLater();
    m_guestCursors.clear(); m_guestLastSeen.clear();
}

void UBSharingController::cleanupStaleCursors()
{
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    QStringList stale;
    for (auto it = m_guestLastSeen.constBegin(); it != m_guestLastSeen.constEnd(); ++it)
        if (now - it.value() > 10000) stale << it.key();
    for (const QString& id : stale) removeGuestCursorOverlay(id);
}
