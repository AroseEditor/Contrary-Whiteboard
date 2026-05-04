#include "UBSharingController.h"
#include "core/UBApplication.h"
#include "board/UBBoardController.h"
#include "board/UBBoardView.h"
#include "domain/UBGraphicsScene.h"

#include <QApplication>
#include <QMessageBox>
#include <QGraphicsView>
#include <QPainter>
#include <QDateTime>
#include <QFont>
#include <QDebug>

UBSharingController* UBSharingController::s_instance = nullptr;

UBSharingController* UBSharingController::instance()
{
    return s_instance;
}

UBSharingController::UBSharingController(QObject* parent)
    : QObject(parent)
{
    s_instance = this;

    // Cleanup stale guest cursors (guests that stop moving after 5s)
    m_cursorCleanupTimer = new QTimer(this);
    m_cursorCleanupTimer->setInterval(5000);
    connect(m_cursorCleanupTimer, &QTimer::timeout, this, &UBSharingController::cleanupStaleCursors);
}

UBSharingController::~UBSharingController()
{
    if (m_hosting)
        toggleHosting();
    clearAllCursorOverlays();
    s_instance = nullptr;
}

void UBSharingController::toggleHosting()
{
    if (m_hosting) {
        if (m_ngrok)  { m_ngrok->stopTunnel();  m_ngrok->deleteLater();  m_ngrok  = nullptr; }
        if (m_server) { m_server->stop();        m_server->deleteLater(); m_server = nullptr; }
        m_cursorCleanupTimer->stop();
        clearAllCursorOverlays();
        m_hosting = false;
        emit hostingStopped();
        emit statusMessage(tr("Whiteboard hosting stopped."));
        return;
    }

    m_server = new UBSharingServer(this);
    connect(m_server, &UBSharingServer::eventFromClient,    this, &UBSharingController::onClientEvent);
    connect(m_server, &UBSharingServer::clientConnected,    this, &UBSharingController::onClientConnected);
    connect(m_server, &UBSharingServer::clientDisconnected, this, &UBSharingController::onClientDisconnected);

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
    emit statusMessage(tr("Starting ngrok tunnel..."));
    m_ngrok->startTunnel(m_server->port());
}

void UBSharingController::onUrlReady(const QString& url)
{
    emit hostingStarted(url);
    QMessageBox* box = new QMessageBox(QMessageBox::Information,
        tr("Whiteboard Hosted!"),
        tr("Your whiteboard is live!\n\n%1\n\nURL copied to clipboard. Share it with guests.").arg(url),
        QMessageBox::Ok);
    box->setAttribute(Qt::WA_DeleteOnClose);
    box->open();
}

void UBSharingController::onNgrokError(const QString& err)
{
    emit statusMessage(tr("ngrok error: %1").arg(err));
    if (m_hosting) toggleHosting();
}

// ─────────────────────────────────────────────────────────────────────────────
// Host cursor → broadcast to all browser guests
// ─────────────────────────────────────────────────────────────────────────────
void UBSharingController::onHostCursorMoved(const QPointF& scenePos)
{
    if (!m_server || !m_hosting) return;

    // Throttle to 20 fps max
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    if (now - m_lastHostCursorMs < 50) return;
    m_lastHostCursorMs = now;

    QJsonObject event;
    event["type"]  = "cursor";
    event["id"]    = "host";
    event["color"] = "#4285f4";  // distinct blue for the host
    event["x"]     = scenePos.x();
    event["y"]     = scenePos.y();
    m_server->broadcast(event);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest events → apply to host Qt canvas + relay to other guests
// ─────────────────────────────────────────────────────────────────────────────
void UBSharingController::onClientEvent(const QJsonObject& event)
{
    const QString type = event["type"].toString();

    if (type == "cursor") {
        const QString id    = event["id"].toString();
        const QString color = event["color"].toString("#f90");
        const qreal   x     = event["x"].toDouble();
        const qreal   y     = event["y"].toDouble();
        m_guestLastSeen[id] = QDateTime::currentMSecsSinceEpoch();
        updateGuestCursorOverlay(id, x, y, color);
    }

    // Forward all events so the host canvas can apply them too (draw/erase/text)
    emit guestEventReceived(event);
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

void UBSharingController::onHostDrawEvent(const QJsonObject& event)
{
    if (m_server && m_hosting)
        m_server->broadcast(event);
}

void UBSharingController::onHostViewportChanged(qreal x, qreal y, qreal scale)
{
    if (!m_server || !m_hosting) return;
    QJsonObject event;
    event["type"]  = "viewport";
    event["x"]     = x;
    event["y"]     = y;
    event["scale"] = scale;
    m_server->broadcast(event);
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest cursor overlay on the Qt host view
// ─────────────────────────────────────────────────────────────────────────────
void UBSharingController::updateGuestCursorOverlay(const QString& id, qreal x, qreal y, const QString& color)
{
    if (!UBApplication::boardController) return;

    // Convert scene coordinates to the control view's viewport coordinates
    UBBoardView* view = UBApplication::boardController->controlView();
    if (!view) return;

    QPoint vp = view->mapFromScene(QPointF(x, y));

    GuestCursorInfo& info = m_guestCursors[id];
    info.x = x; info.y = y; info.color = color;

    if (!info.label) {
        info.label = new QLabel(view->viewport());
        info.label->setStyleSheet(
            QString("background: %1; color: white; border-radius: 10px;"
                    "padding: 2px 6px; font-size: 11px; font-weight: bold;").arg(color));
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
    if (m_guestCursors.contains(id)) {
        GuestCursorInfo& info = m_guestCursors[id];
        if (info.label) { info.label->deleteLater(); info.label = nullptr; }
        m_guestCursors.remove(id);
        m_guestLastSeen.remove(id);
    }
}

void UBSharingController::clearAllCursorOverlays()
{
    for (auto& info : m_guestCursors) {
        if (info.label) info.label->deleteLater();
    }
    m_guestCursors.clear();
    m_guestLastSeen.clear();
}

void UBSharingController::cleanupStaleCursors()
{
    qint64 now = QDateTime::currentMSecsSinceEpoch();
    QStringList stale;
    for (auto it = m_guestLastSeen.constBegin(); it != m_guestLastSeen.constEnd(); ++it) {
        if (now - it.value() > 10000)  // 10s without movement → hide cursor
            stale << it.key();
    }
    for (const QString& id : stale)
        removeGuestCursorOverlay(id);
}

QImage UBSharingController::captureCanvasSnapshot() const
{
    if (!UBApplication::boardController || !UBApplication::boardController->activeScene())
        return QImage();

    UBGraphicsScene* scene = UBApplication::boardController->activeScene().get();
    QRectF rect = scene->sceneRect();
    QImage img(rect.size().toSize(), QImage::Format_RGB32);
    img.fill(Qt::white);
    QPainter painter(&img);
    scene->render(&painter, QRectF(), rect);
    return img;
}
