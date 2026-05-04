#include "UBSharingServer.h"

#include <QJsonDocument>
#include <QBuffer>
#include <QFile>
#include <QDebug>
#include <QHostAddress>

UBSharingServer::UBSharingServer(QObject* parent)
    : QObject(parent)
{}

UBSharingServer::~UBSharingServer()
{
    stop();
}

bool UBSharingServer::start(quint16 preferredPort)
{
    // QWebSocketServer in NonSecureMode used internally for handshake handling
    m_wsServer = new QWebSocketServer(QStringLiteral("CW"), QWebSocketServer::NonSecureMode, this);

    // Listen raw TCP on the preferred port
    m_tcpServer = new QTcpServer(this);
    if (!m_tcpServer->listen(QHostAddress::Any, preferredPort)) {
        if (!m_tcpServer->listen(QHostAddress::Any, 0)) {
            qWarning() << "UBSharingServer: TCP listen failed:" << m_tcpServer->errorString();
            delete m_tcpServer; m_tcpServer = nullptr;
            delete m_wsServer;  m_wsServer  = nullptr;
            return false;
        }
    }
    m_port = m_tcpServer->serverPort();
    qDebug() << "UBSharingServer: listening on port" << m_port;

    connect(m_tcpServer,  &QTcpServer::newConnection,      this, &UBSharingServer::onNewConnection);
    connect(m_wsServer,   &QWebSocketServer::newConnection, this, [this]() {
        while (m_wsServer->hasPendingConnections()) {
            QWebSocket* client = m_wsServer->nextPendingConnection();
            connect(client, &QWebSocket::textMessageReceived, this, &UBSharingServer::onWsMessage);
            connect(client, &QWebSocket::disconnected,        this, &UBSharingServer::onWsClientDisconnected);
            m_wsClients.append(client);
            qDebug() << "WS client:" << client->peerAddress().toString();
            emit clientConnected(m_wsClients.size());
        }
    });

    return true;
}

void UBSharingServer::stop()
{
    if (m_tcpServer) { m_tcpServer->close(); m_tcpServer->deleteLater(); m_tcpServer = nullptr; }
    for (QWebSocket* c : qAsConst(m_wsClients)) c->close();
    m_wsClients.clear();
    if (m_wsServer) { m_wsServer->close(); m_wsServer->deleteLater(); m_wsServer = nullptr; }
}

void UBSharingServer::broadcast(const QJsonObject& event, QWebSocket* exclude)
{
    QByteArray data = QJsonDocument(event).toJson(QJsonDocument::Compact);
    for (QWebSocket* c : qAsConst(m_wsClients)) {
        if (c != exclude && c->isValid())
            c->sendTextMessage(QString::fromUtf8(data));
    }
}

void UBSharingServer::sendInitSnapshot(QWebSocket* client, const QImage& snapshot)
{
    QByteArray png;
    QBuffer buf(&png);
    buf.open(QIODevice::WriteOnly);
    snapshot.save(&buf, "PNG");
    buf.close();

    QJsonObject msg;
    msg["type"]   = "init";
    msg["canvas"] = QString::fromLatin1(png.toBase64());
    client->sendTextMessage(QString::fromUtf8(QJsonDocument(msg).toJson(QJsonDocument::Compact)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Route incoming TCP connections: HTTP request → serve page, WS upgrade → hand off
// ─────────────────────────────────────────────────────────────────────────────
void UBSharingServer::onNewConnection()
{
    while (m_tcpServer->hasPendingConnections()) {
        QTcpSocket* socket = m_tcpServer->nextPendingConnection();
        connect(socket, &QTcpSocket::readyRead, this, [this, socket]() {
            handleTcpData(socket);
        });
        connect(socket, &QTcpSocket::disconnected, socket, &QTcpSocket::deleteLater);
    }
}

void UBSharingServer::handleTcpData(QTcpSocket* socket)
{
    // Peek at the first line to decide: plain HTTP or WebSocket upgrade
    QByteArray data = socket->peek(4096);
    QString firstLine = QString::fromLatin1(data).section('\n', 0, 0).trimmed();

    if (firstLine.contains("Upgrade: websocket") || data.contains("Upgrade: websocket")) {
        // Hand the raw socket to the QWebSocketServer for WS handshake
        socket->disconnect(this);  // stop our readyRead handler
        m_wsServer->handleConnection(socket);
    } else if (firstLine.startsWith("GET ")) {
        // Consume the request
        socket->readAll();
        serveHtml(socket);
    }
    // else: wait for more data
}

void UBSharingServer::serveHtml(QTcpSocket* socket)
{
    QFile f(":/web/whiteboard.html");
    QByteArray body;
    if (f.open(QIODevice::ReadOnly)) {
        body = f.readAll();
        f.close();
    } else {
        body = "<html><body><h2>Contrary Whiteboard</h2>"
               "<p>Resource not found — rebuild the application.</p></body></html>";
    }

    QByteArray resp =
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html; charset=utf-8\r\n"
        "Content-Length: " + QByteArray::number(body.size()) + "\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: close\r\n"
        "\r\n" + body;

    socket->write(resp);
    socket->flush();
    socket->disconnectFromHost();
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket events
// ─────────────────────────────────────────────────────────────────────────────
void UBSharingServer::onWsMessage(const QString& msg)
{
    QWebSocket* snd = qobject_cast<QWebSocket*>(QObject::sender());
    QJsonParseError err;
    QJsonDocument doc = QJsonDocument::fromJson(msg.toUtf8(), &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) return;

    QJsonObject event = doc.object();
    broadcast(event, snd);
    emit eventFromClient(event);
}

void UBSharingServer::onWsClientDisconnected()
{
    QWebSocket* client = qobject_cast<QWebSocket*>(QObject::sender());
    if (client) {
        m_wsClients.removeAll(client);
        client->deleteLater();
        emit clientDisconnected(m_wsClients.size());
    }
}
