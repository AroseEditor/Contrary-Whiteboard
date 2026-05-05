#include "UBSharingController.h"
#include "core/UBApplication.h"
#include "core/UBSettings.h"
#include "board/UBBoardController.h"
#include "board/UBBoardView.h"
#include "domain/UBGraphicsScene.h"
#include "domain/UBGraphicsTextItem.h"
#include "domain/UBGraphicsPixmapItem.h"

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

    connect(UBApplication::boardController, &UBBoardController::controlViewportChanged,
            this, &UBSharingController::onHostViewportChanged);

    view->viewport()->installEventFilter(m_boardFilter);
    view->viewport()->setMouseTracking(true);
}

void UBSharingController::joinSession(const QString& url, const QString& name)
{
    if (m_hosting) toggleHosting();
    if (m_isClient) leaveSession();

    m_clientName = name.isEmpty() ? "App Guest" : name;
    
    QString wsUrl = url;
    if (!wsUrl.contains("://")) wsUrl = "ws://" + wsUrl;
    if (!wsUrl.endsWith("/ws")) {
        if (wsUrl.endsWith("/")) wsUrl += "ws";
        else wsUrl += "/ws";
    }

    m_clientSocket = new QWebSocket();
    connect(m_clientSocket, &QWebSocket::connected, this, &UBSharingController::onClientSocketConnected);
    connect(m_clientSocket, &QWebSocket::disconnected, this, &UBSharingController::onClientSocketDisconnected);
    connect(m_clientSocket, &QWebSocket::textMessageReceived, this, &UBSharingController::onClientMessageReceived);
    connect(m_clientSocket, QOverload<QAbstractSocket::SocketError>::of(&QWebSocket::error),
            this, &UBSharingController::onClientSocketError);

    m_isClient = true;
    m_clientSocket->open(QUrl(wsUrl));
    emit statusMessage(tr("Connecting to %1...").arg(url));
}

void UBSharingController::leaveSession()
{
    if (!m_isClient) return;
    if (m_clientSocket) {
        m_clientSocket->close();
        m_clientSocket->deleteLater();
        m_clientSocket = nullptr;
    }
    m_isClient = false;
    clearAllCursorOverlays();
    emit statusMessage(tr("Disconnected from session."));
}

void UBSharingController::onClientSocketConnected()
{
    emit statusMessage(tr("Connected to session as %1").arg(m_clientName));
    
    QJsonObject hello;
    hello["type"] = "hello";
    hello["id"]   = "app_" + QString::number(QCoreApplication::applicationPid());
    hello["name"] = m_clientName;
    hello["color"] = "#10b981"; // Emerald green for app guests
    m_clientSocket->sendTextMessage(QJsonDocument(hello).toJson(QJsonDocument::Compact));
    
    wireBoard();
}

void UBSharingController::onClientSocketDisconnected()
{
    emit statusMessage(tr("Disconnected from host."));
    m_isClient = false;
}

void UBSharingController::onClientSocketError(QAbstractSocket::SocketError error)
{
    emit statusMessage(tr("Connection error: %1").arg(m_clientSocket->errorString()));
    m_isClient = false;
}

void UBSharingController::onClientMessageReceived(const QString& message)
{
    QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8());
    if (doc.isNull()) return;
    QJsonObject ev = doc.object();
    
    QString type = ev["type"].toString();
    
    // If it's a snapshot or init, we clear and load the new background
    if (type == "init" || type == "snapshot" || type == "page_change") {
        if (!UBApplication::boardController) return;
        auto scene = UBApplication::boardController->activeScene();
        if (!scene) return;
        
        // Clear previous remote guest items if any (optional, usually we want a fresh start)
        // scene->clearContent(); 

        QString b64 = ev["canvas"].toString(ev["data"].toString());
        if (!b64.isEmpty()) {
            QByteArray data = QByteArray::fromBase64(b64.toLatin1());
            QPixmap pix; pix.loadFromData(data, "JPEG");
            if (!pix.isNull()) {
                // Remove old background snapshot
                QList<QGraphicsItem*> items = scene->items();
                for (auto* item : items) {
                    if (item->data(0).toString() == "remote_snapshot") {
                        scene->removeItem(item);
                        delete item;
                    }
                }
                
                auto* item = scene->addPixmap(pix, nullptr);
                item->setData(0, "remote_snapshot");
                item->setZValue(-1000); // stay in background
                
                // Set scene rect to match host
                qreal sw = ev["sceneW"].toDouble(1920);
                qreal sh = ev["sceneH"].toDouble(1080);
                scene->setSceneRect(ev["sceneX"].toDouble(0), ev["sceneY"].toDouble(0), sw, sh);
            }
        }
        
        if (type == "page_change") {
             emit statusMessage(tr("Host moved to page %1").arg(ev["pageIdx"].toInt() + 1));
        }
    } else if (type == "cursor") {
        const QString id   = ev["id"].toString();
        const QString name = ev["name"].toString(id);
        if (id == "host" || id != ("app_" + QString::number(QCoreApplication::applicationPid()))) {
            m_guestLastSeen[id] = QDateTime::currentMSecsSinceEpoch();
            updateGuestCursorOverlay(id, ev["x"].toDouble(), ev["y"].toDouble(),
                                     ev["color"].toString("#f90"), name);
        }
    } else if (type == "hdraw" || type == "draw" || type == "erase" || type == "text") {
        // Apply remote stroke to our scene
        applyGuestEventToScene(ev);
    }
}

// ── Host stroke streaming ─────────────────────────────────────────────────────
void UBSharingController::onHostStroke(QPointF from, QPointF to)
{
    if (!m_hosting && !m_isClient) return;

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
            // width logic...
        }
    }

    QJsonObject ev;
    ev["type"]  = m_isClient ? "draw" : "hdraw"; 
    ev["id"]    = m_isClient ? ("app_" + QString::number(QCoreApplication::applicationPid())) : "host";
    ev["name"]  = m_isClient ? m_clientName : "Host";
    ev["x"]     = from.x();  ev["y"]  = from.y();
    ev["x2"]    = to.x();    ev["y2"] = to.y();
    ev["color"] = color;
    ev["width"] = width;

    if (m_hosting && m_server) m_server->broadcast(ev);
    else if (m_isClient && m_clientSocket && m_clientSocket->isValid()) {
        m_clientSocket->sendTextMessage(QJsonDocument(ev).toJson(QJsonDocument::Compact));
    }
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

    // Send page count to populate sidebar immediately
    QJsonObject pc;
    pc["type"]    = "page_count";
    pc["count"]   = UBApplication::boardController->selectedDocument()->pageCount();
    pc["current"] = pageIdx;
    m_server->sendTo(client, pc);
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

    // Also update page counts for sidebars
    QJsonObject pc;
    pc["type"]    = "page_count";
    pc["count"]   = UBApplication::boardController->selectedDocument()->pageCount();
    pc["current"] = pageIdx;
    m_server->broadcast(pc);
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
    } else if (type == "request_page") {
        int idx = ev["pageIdx"].toInt();
        if (UBApplication::boardController)
            UBApplication::boardController->setActiveDocumentScene(idx);
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
    if (!m_hosting && !m_isClient) return;
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (now - m_lastCursorMs < 33) return; // ~30 fps
    m_lastCursorMs = now;

    QJsonObject ev;
    ev["type"]  = "cursor";
    ev["id"]    = m_isClient ? ("app_" + QString::number(QCoreApplication::applicationPid())) : "host";
    ev["name"]  = m_isClient ? m_clientName : "Host";
    ev["color"] = m_isClient ? "#10b981" : "#4285f4";
    ev["x"]     = scenePos.x();
    ev["y"]     = scenePos.y();

    if (m_hosting && m_server) m_server->broadcast(ev);
    else if (m_isClient && m_clientSocket && m_clientSocket->isValid()) {
        m_clientSocket->sendTextMessage(QJsonDocument(ev).toJson(QJsonDocument::Compact));
    }
}

void UBSharingController::onHostDrawEvent(const QJsonObject& ev)
{
    if (m_server && m_hosting) m_server->broadcast(ev);
}

void UBSharingController::onHostViewportChanged()
{
    if (!m_server || !m_hosting || !UBApplication::boardController) return;
    auto* view = UBApplication::boardController->controlView();
    if (!view) return;

    // Send center of view in scene coordinates + zoom factor
    QPointF center = view->mapToScene(view->rect().center());
    qreal zoom = UBApplication::boardController->currentZoom();

    QJsonObject ev;
    ev["type"]    = "viewport";
    ev["cx"]      = center.x();
    ev["cy"]      = center.y();
    ev["zoom"]    = zoom;
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
