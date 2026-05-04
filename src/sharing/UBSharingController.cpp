#include "UBSharingController.h"
#include "core/UBApplication.h"
#include "board/UBBoardController.h"
#include "domain/UBGraphicsScene.h"

#include <QApplication>
#include <QMessageBox>
#include <QGraphicsView>
#include <QPainter>
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
}

UBSharingController::~UBSharingController()
{
    if (m_hosting)
        toggleHosting();
    s_instance = nullptr;
}

void UBSharingController::toggleHosting()
{
    if (m_hosting) {
        // Stop session
        if (m_ngrok)  { m_ngrok->stopTunnel();  m_ngrok->deleteLater();  m_ngrok  = nullptr; }
        if (m_server) { m_server->stop();        m_server->deleteLater(); m_server = nullptr; }
        m_hosting = false;
        emit hostingStopped();
        emit statusMessage(tr("Whiteboard hosting stopped."));
        return;
    }

    // Start session
    m_server = new UBSharingServer(this);
    connect(m_server, &UBSharingServer::eventFromClient,  this, &UBSharingController::onClientEvent);
    connect(m_server, &UBSharingServer::clientConnected,  this, &UBSharingController::onClientConnected);
    connect(m_server, &UBSharingServer::clientDisconnected, this, &UBSharingController::onClientDisconnected);

    if (!m_server->start(8080)) {
        emit statusMessage(tr("Failed to start sharing server."));
        m_server->deleteLater();
        m_server = nullptr;
        return;
    }

    m_ngrok = new UBNgrokManager(this);
    connect(m_ngrok, &UBNgrokManager::urlReady,      this, &UBSharingController::onUrlReady);
    connect(m_ngrok, &UBNgrokManager::error,         this, &UBSharingController::onNgrokError);
    connect(m_ngrok, &UBNgrokManager::statusMessage, this, &UBSharingController::statusMessage);

    m_hosting = true;
    emit statusMessage(tr("Starting ngrok tunnel..."));
    m_ngrok->startTunnel(m_server->port());
}

void UBSharingController::onUrlReady(const QString& url)
{
    // Build the guest URL pointing to the embedded whiteboard.html served over HTTP
    // Replace ws:// with http:// for the initial page load — the JS will upgrade to ws://
    QString guestUrl = url + "/board";
    emit hostingStarted(guestUrl);

    QMessageBox* box = new QMessageBox(QMessageBox::Information,
        tr("Whiteboard Hosted!"),
        tr("Your whiteboard is live!\n\n%1\n\nThe URL has been copied to your clipboard.")
            .arg(guestUrl),
        QMessageBox::Ok);
    box->setAttribute(Qt::WA_DeleteOnClose);
    box->open();
}

void UBSharingController::onNgrokError(const QString& err)
{
    emit statusMessage(tr("ngrok error: %1").arg(err));
    // Stop everything if ngrok fails
    if (m_hosting)
        toggleHosting();
}

void UBSharingController::onClientEvent(const QJsonObject& event)
{
    // Forward to the Qt board canvas so guest strokes appear in the host
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

QImage UBSharingController::captureCanvasSnapshot() const
{
    if (!UBApplication::boardController || !UBApplication::boardController->activeScene())
        return QImage();

    UBGraphicsScene* scene = UBApplication::boardController->activeScene();
    QRectF rect = scene->sceneRect();
    QImage img(rect.size().toSize(), QImage::Format_RGB32);
    img.fill(Qt::white);
    QPainter painter(&img);
    scene->render(&painter, QRectF(), rect);
    return img;
}
