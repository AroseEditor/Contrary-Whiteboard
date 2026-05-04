#include "UBSharingServer.h"
#include <QJsonDocument>
#include <QBuffer>
#include <QFile>
#include <QDebug>
#include <QHostAddress>

UBSharingServer::UBSharingServer(QObject* parent) : QObject(parent) {}
UBSharingServer::~UBSharingServer() { stop(); }

bool UBSharingServer::start(quint16 port)
{
    // WS server handles upgrades handed to it from the TCP server
    m_wsServer = new QWebSocketServer("CW", QWebSocketServer::NonSecureMode, this);
    connect(m_wsServer, &QWebSocketServer::newConnection, this, &UBSharingServer::onWsConnected);

    // Single TCP server: routes GET /ws → WS handshake, everything else → HTML
    m_tcpServer = new QTcpServer(this);
    if (!m_tcpServer->listen(QHostAddress::Any, port)) {
        if (!m_tcpServer->listen(QHostAddress::Any, 0)) {
            delete m_tcpServer; m_tcpServer = nullptr;
            delete m_wsServer;  m_wsServer  = nullptr;
            return false;
        }
    }
    m_port = m_tcpServer->serverPort();
    connect(m_tcpServer, &QTcpServer::newConnection, this, &UBSharingServer::onNewTcpConnection);
    qDebug() << "UBSharingServer on port" << m_port;
    return true;
}

void UBSharingServer::stop()
{
    for (QWebSocket* c : qAsConst(m_clients)) c->close();
    m_clients.clear();
    if (m_wsServer)  { m_wsServer->close();  m_wsServer->deleteLater();  m_wsServer = nullptr; }
    if (m_tcpServer) { m_tcpServer->close(); m_tcpServer->deleteLater(); m_tcpServer = nullptr; }
}

void UBSharingServer::broadcast(const QJsonObject& ev, QWebSocket* exclude)
{
    QByteArray data = QJsonDocument(ev).toJson(QJsonDocument::Compact);
    for (QWebSocket* c : qAsConst(m_clients))
        if (c != exclude && c->isValid())
            c->sendTextMessage(QString::fromUtf8(data));
}

void UBSharingServer::sendTo(QWebSocket* client, const QJsonObject& ev)
{
    if (client && client->isValid())
        client->sendTextMessage(QString::fromUtf8(QJsonDocument(ev).toJson(QJsonDocument::Compact)));
}

// ── TCP routing ──────────────────────────────────────────────────────────────
void UBSharingServer::onNewTcpConnection()
{
    while (m_tcpServer->hasPendingConnections()) {
        QTcpSocket* socket = m_tcpServer->nextPendingConnection();
        connect(socket, &QTcpSocket::readyRead, this, [this, socket]() {
            routeTcpSocket(socket);
        });
        connect(socket, &QTcpSocket::disconnected, socket, &QTcpSocket::deleteLater);
    }
}

void UBSharingServer::routeTcpSocket(QTcpSocket* socket)
{
    QByteArray peek = socket->peek(2048);
    if (peek.size() < 16) return; // wait for more data

    // If the request is a WebSocket upgrade to /ws, hand off to QWebSocketServer
    if (peek.contains("GET /ws") && peek.contains("Upgrade: websocket")) {
        // Disconnect our handler — QWebSocketServer takes ownership
        disconnect(socket, &QTcpSocket::readyRead,    nullptr, nullptr);
        disconnect(socket, &QTcpSocket::disconnected, nullptr, nullptr);
        m_wsServer->handleConnection(socket);
    } else if (peek.startsWith("GET ") || peek.startsWith("HEAD ")) {
        socket->readAll(); // consume request
        serveHtml(socket);
    }
    // else: partial data, wait for next readyRead
}

void UBSharingServer::serveHtml(QTcpSocket* socket)
{
    QFile f(":/web/whiteboard.html");
    QByteArray body;
    if (f.open(QIODevice::ReadOnly)) { body = f.readAll(); f.close(); }
    else body = "<html><body><h2>Contrary Whiteboard</h2><p>Resource missing — rebuild.</p></body></html>";

    socket->write(
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Content-Length: " + QByteArray::number(body.size()) + "\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: close\r\n"
        "\r\n" + body);
    socket->flush();
    socket->disconnectFromHost();
}

// ── WebSocket events ─────────────────────────────────────────────────────────
void UBSharingServer::onWsConnected()
{
    while (m_wsServer->hasPendingConnections()) {
        QWebSocket* client = m_wsServer->nextPendingConnection();
        connect(client, &QWebSocket::textMessageReceived, this, &UBSharingServer::onWsMessage);
        connect(client, &QWebSocket::disconnected,        this, &UBSharingServer::onWsDisconnected);
        m_clients.append(client);
        emit clientConnected(m_clients.size());
    }
}

void UBSharingServer::onWsMessage(const QString& msg)
{
    QWebSocket* sender = qobject_cast<QWebSocket*>(QObject::sender());
    QJsonParseError err;
    QJsonDocument doc = QJsonDocument::fromJson(msg.toUtf8(), &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return;

    QJsonObject ev = doc.object();

    if (ev["type"].toString() == "hello") {
        // New guest intro — don't relay, just notify controller to send init snapshot
        emit newGuest(sender);
        return;
    }

    // Relay to all other clients and notify controller
    broadcast(ev, sender);
    emit eventFromClient(ev, sender);
}

void UBSharingServer::onWsDisconnected()
{
    QWebSocket* client = qobject_cast<QWebSocket*>(QObject::sender());
    if (client) {
        m_clients.removeAll(client);
        client->deleteLater();
        emit clientDisconnected(m_clients.size());
    }
}
