#include "UBSharingController.h"
#include "core/UBApplication.h"
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

    m_snapshotTimer = new QTimer(this);
    m_snapshotTimer->setSingleShot(true);
    m_snapshotTimer->setInterval(250); // 4 fps max snapshot rate
    connect(m_snapshotTimer, &QTimer::timeout, this, &UBSharingController::broadcastSnapshot);

    m_cursorCleanupTimer = new QTimer(this);
    m_cursorCleanupTimer->setInterval(5000);
    connect(m_cursorCleanupTimer, &QTimer::timeout, this, &UBSharingController::cleanupStaleCursors);
}

UBSharingController::~UBSharingController()
{
    if (m_hosting) toggleHosting();
    clearAllCursorOverlays();
    s_instance = nullptr;
}

void UBSharingController::toggleHosting()
{
    if (m_hosting) {
        m_snapshotTimer->stop();
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
    m_cursorCleanupTimer->start();
    connectToScene();

    emit statusMessage(tr("Starting ngrok tunnel..."));
    m_ngrok->startTunnel(m_server->port());
}

// Connect to scene changes to trigger snapshot broadcast
void UBSharingController::connectToScene()
{
    if (!UBApplication::boardController) return;
    auto scene = UBApplication::boardController->activeScene();
    if (!scene) return;
    // QGraphicsScene::changed fires whenever items are added/moved/modified
    connect(scene.get(), &QGraphicsScene::changed, this, [this](const QList<QRectF>&) {
        if (m_hosting && m_server && m_server->clientCount() > 0)
            m_snapshotTimer->start(); // debounce: restarts the 250ms window
    }, Qt::UniqueConnection);
}

// ── Host → Guests: canvas snapshot ───────────────────────────────────────────
QImage UBSharingController::captureSnapshot() const
{
    if (!UBApplication::boardController) return {};
    auto scene = UBApplication::boardController->activeScene();
    if (!scene) return {};

    QRectF sr = scene->sceneRect();
    if (sr.isEmpty()) return {};

    // Scale to max 1600px on the long side, JPEG for speed
    const double MAX = 1600.0;
    double s = qMin(1.0, qMin(MAX / sr.width(), MAX / sr.height()));
    QSize sz(qMax(1, (int)(sr.width() * s)), qMax(1, (int)(sr.height() * s)));

    QImage img(sz, QImage::Format_RGB32);
    img.fill(Qt::white);
    QPainter p(&img);
    p.setRenderHint(QPainter::Antialiasing);
    scene->render(&p, QRectF(), sr);
    p.end();
    return img;
}

void UBSharingController::broadcastSnapshot()
{
    if (!m_server || !m_hosting || m_server->clientCount() == 0) return;
    QImage img = captureSnapshot();
    if (img.isNull()) return;

    QByteArray jpg;
    QBuffer buf(&jpg);
    buf.open(QIODevice::WriteOnly);
    img.save(&buf, "JPEG", 70);

    QJsonObject ev;
    ev["type"] = "snapshot";
    ev["w"]    = img.width();
    ev["h"]    = img.height();
    ev["data"] = QString::fromLatin1(jpg.toBase64());
    m_server->broadcast(ev);
}

// Sends full snapshot + scene dimensions to a newly connected guest
void UBSharingController::onNewGuest(QWebSocket* client)
{
    if (!m_server) return;
    QImage img = captureSnapshot();
    if (img.isNull()) return;

    QByteArray jpg;
    QBuffer buf(&jpg);
    buf.open(QIODevice::WriteOnly);
    img.save(&buf, "JPEG", 80);

    // Also send scene rect so browser sets coordinate system correctly
    QRectF sr;
    if (UBApplication::boardController && UBApplication::boardController->activeScene())
        sr = UBApplication::boardController->activeScene()->sceneRect();

    QJsonObject ev;
    ev["type"]    = "init";
    ev["canvas"]  = QString::fromLatin1(jpg.toBase64());
    ev["w"]       = img.width();
    ev["h"]       = img.height();
    ev["sceneW"]  = sr.width();
    ev["sceneH"]  = sr.height();
    ev["sceneX"]  = sr.x();
    ev["sceneY"]  = sr.y();
    m_server->sendTo(client, ev);
}

// ── Guest → Host: apply to Qt canvas ─────────────────────────────────────────
void UBSharingController::applyGuestEventToScene(const QJsonObject& ev)
{
    if (!UBApplication::boardController) return;
    auto scene = UBApplication::boardController->activeScene();
    if (!scene) return;

    const QString type = ev["type"].toString();

    if (type == "draw") {
        QColor color(ev["color"].toString("#ffffff"));
        double width = ev["width"].toDouble(3.0);
        double x1 = ev["x"].toDouble(),  y1 = ev["y"].toDouble();
        double x2 = ev["x2"].toDouble(), y2 = ev["y2"].toDouble();

        QPen pen(color, width, Qt::SolidLine, Qt::RoundCap, Qt::RoundJoin);
        auto* item = scene->addLine(x1, y1, x2, y2, pen);
        item->setData(0, QStringLiteral("guest")); // mark as guest-drawn
    }
    else if (type == "erase") {
        // Erase by painting a white-filled circle at the erase position
        double x = ev["x"].toDouble(), y = ev["y"].toDouble();
        double r = ev["radius"].toDouble(20.0);
        QBrush brush(Qt::white);
        QPen pen(Qt::NoPen);
        auto* item = scene->addEllipse(x - r, y - r, r * 2, r * 2, pen, brush);
        item->setZValue(1000); // above strokes
        item->setData(0, QStringLiteral("guest"));
    }
    else if (type == "text") {
        double x = ev["x"].toDouble(), y = ev["y"].toDouble();
        QString content = ev["content"].toString();
        QColor color(ev["color"].toString("#ffffff"));
        auto* item = scene->addText(content);
        item->setPos(x, y);
        item->setDefaultTextColor(color);
        item->setData(0, QStringLiteral("guest"));
    }
}

// ── Incoming client events ────────────────────────────────────────────────────
void UBSharingController::onClientEvent(const QJsonObject& ev, QWebSocket* /*sender*/)
{
    const QString type = ev["type"].toString();

    if (type == "cursor") {
        const QString id    = ev["id"].toString();
        const QString color = ev["color"].toString("#f90");
        m_guestLastSeen[id] = QDateTime::currentMSecsSinceEpoch();
        updateGuestCursorOverlay(id, ev["x"].toDouble(), ev["y"].toDouble(), color);
    } else {
        // draw / erase / text → apply to Qt canvas and relay is already done by server
        applyGuestEventToScene(ev);
    }

    emit guestEventReceived(ev);
}

void UBSharingController::onClientConnected(int total)
{
    emit clientCountChanged(total);
    emit statusMessage(tr("%1 guest(s) connected").arg(total));
    connectToScene(); // re-connect in case scene was swapped
}

void UBSharingController::onClientDisconnected(int total)
{
    emit clientCountChanged(total);
}

// ── Host cursor → guests ──────────────────────────────────────────────────────
void UBSharingController::onHostCursorMoved(const QPointF& scenePos)
{
    if (!m_server || !m_hosting) return;
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (now - m_lastHostCursorMs < 50) return;
    m_lastHostCursorMs = now;

    QJsonObject ev;
    ev["type"]  = "cursor";
    ev["id"]    = "host";
    ev["color"] = "#4285f4";
    ev["x"]     = scenePos.x();
    ev["y"]     = scenePos.y();
    m_server->broadcast(ev);
}

// ── Host draw event (called from board controller) → guests ──────────────────
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

// ── Guest cursor overlays on Qt host view ─────────────────────────────────────
void UBSharingController::updateGuestCursorOverlay(const QString& id, qreal x, qreal y, const QString& color)
{
    if (!UBApplication::boardController) return;
    UBBoardView* view = UBApplication::boardController->controlView();
    if (!view) return;

    QPoint vp = view->mapFromScene(QPointF(x, y));
    GuestCursorInfo& info = m_guestCursors[id];
    info.x = x; info.y = y; info.color = color;

    if (!info.label) {
        info.label = new QLabel(view->viewport());
        info.label->setStyleSheet(
            QString("background:%1;color:white;border-radius:10px;padding:2px 6px;"
                    "font-size:11px;font-weight:bold;").arg(color));
        info.label->setAttribute(Qt::WA_TransparentForMouseEvents);
        info.label->show();
    }
    info.label->setText(id);
    info.label->adjustSize();
    info.label->move(vp.x() + 10, vp.y() - 10);
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
