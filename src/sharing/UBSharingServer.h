#ifndef UBSHARINGSERVER_H
#define UBSHARINGSERVER_H

#include <QObject>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QTcpServer>
#include <QTcpSocket>
#include <QHash>
#include <QJsonObject>
#include <QList>
#include <QImage>

// Single-port HTTP + WebSocket server.
//   GET /board  → serves whiteboard.html
//   GET /ws     → WebSocket upgrade (handled inline)
//
// ngrok only needs to tunnel ONE port.
// The page JS connects to ws[s]://<ngrok-host>/ws
// which ngrok forwards to our local /ws handler.
class UBSharingServer : public QObject
{
    Q_OBJECT
public:
    explicit UBSharingServer(QObject* parent = nullptr);
    ~UBSharingServer();

    bool start(quint16 preferredPort = 8080);
    void stop();
    quint16 port() const { return m_port; }
    bool isRunning() const { return m_tcpServer != nullptr && m_tcpServer->isListening(); }
    int clientCount() const { return m_wsClients.size(); }

    void broadcast(const QJsonObject& event, QWebSocket* exclude = nullptr);
    void sendInitSnapshot(QWebSocket* client, const QImage& snapshot);

signals:
    void clientConnected(int totalClients);
    void clientDisconnected(int totalClients);
    void eventFromClient(const QJsonObject& event);

private slots:
    void onNewConnection();
    void onWsMessage(const QString& msg);
    void onWsClientDisconnected();

private:
    void handleTcpData(QTcpSocket* socket);
    void serveHtml(QTcpSocket* socket);

    // The QWebSocketServer in "off-the-network" mode accepts raw QTcpSocket
    QTcpServer*        m_tcpServer  = nullptr;
    QWebSocketServer*  m_wsServer   = nullptr;
    QList<QWebSocket*> m_wsClients;
    quint16 m_port = 0;
};

#endif // UBSHARINGSERVER_H
