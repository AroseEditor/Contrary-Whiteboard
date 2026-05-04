#ifndef UBSHARINGSERVER_H
#define UBSHARINGSERVER_H

#include <QObject>
#include <QWebSocketServer>
#include <QWebSocket>
#include <QTcpServer>
#include <QTcpSocket>
#include <QJsonObject>
#include <QList>
#include <QImage>

class UBSharingServer : public QObject
{
    Q_OBJECT
public:
    explicit UBSharingServer(QObject* parent = nullptr);
    ~UBSharingServer();

    bool start(quint16 port = 8080);
    void stop();
    quint16 port() const { return m_port; }
    bool isRunning() const { return m_tcpServer && m_tcpServer->isListening(); }
    int clientCount() const { return m_clients.size(); }

    void broadcast(const QJsonObject& ev, QWebSocket* exclude = nullptr);
    void sendTo(QWebSocket* client, const QJsonObject& ev);

signals:
    void clientConnected(int total);
    void clientDisconnected(int total);
    void eventFromClient(const QJsonObject& ev, QWebSocket* sender);
    void newGuest(QWebSocket* client);   // emitted on first 'hello' from a guest

private slots:
    void onNewTcpConnection();
    void onWsConnected();
    void onWsMessage(const QString& msg);
    void onWsDisconnected();

private:
    void routeTcpSocket(QTcpSocket* socket);
    void serveHtml(QTcpSocket* socket);

    QTcpServer*        m_tcpServer = nullptr;
    QWebSocketServer*  m_wsServer  = nullptr;
    QList<QWebSocket*> m_clients;
    quint16 m_port = 0;
};

#endif
