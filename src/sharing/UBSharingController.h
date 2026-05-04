#ifndef UBSHARINGCONTROLLER_H
#define UBSHARINGCONTROLLER_H

#include <QObject>
#include <QJsonObject>
#include <QImage>
#include "UBSharingServer.h"
#include "UBNgrokManager.h"

// Orchestrates UBSharingServer + UBNgrokManager.
// Call toggleHosting() from the "Host Whiteboard" toolbar button.
class UBSharingController : public QObject
{
    Q_OBJECT
public:
    static UBSharingController* instance();
    explicit UBSharingController(QObject* parent = nullptr);
    ~UBSharingController();

    bool isHosting() const { return m_hosting; }

public slots:
    void toggleHosting();
    // Called by the board when a stroke/erase/text event completes
    void onHostDrawEvent(const QJsonObject& event);
    // Called when the host board wants to sync its current viewport position
    void onHostViewportChanged(qreal x, qreal y, qreal scale);

signals:
    void hostingStarted(const QString& publicUrl);
    void hostingStopped();
    void guestEventReceived(const QJsonObject& event);
    void statusMessage(const QString& msg);
    void clientCountChanged(int count);

private slots:
    void onUrlReady(const QString& url);
    void onNgrokError(const QString& err);
    void onClientEvent(const QJsonObject& event);
    void onClientConnected(int total);
    void onClientDisconnected(int total);

private:
    QImage captureCanvasSnapshot() const;

    bool m_hosting = false;
    UBSharingServer* m_server = nullptr;
    UBNgrokManager*  m_ngrok  = nullptr;

    static UBSharingController* s_instance;
};

#endif // UBSHARINGCONTROLLER_H
