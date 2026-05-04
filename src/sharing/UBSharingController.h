#ifndef UBSHARINGCONTROLLER_H
#define UBSHARINGCONTROLLER_H

#include <QObject>
#include <QJsonObject>
#include <QImage>
#include <QHash>
#include <QLabel>
#include <QTimer>
#include <QEvent>
#include <QMouseEvent>
#include <QGraphicsView>
#include "UBSharingServer.h"
#include "UBNgrokManager.h"

struct GuestCursorInfo {
    qreal x = 0, y = 0;
    QString color;
    QLabel* label = nullptr;
};

// Event filter to relay host mouse position to guests
class UBCursorRelay : public QObject {
    Q_OBJECT
public:
    explicit UBCursorRelay(QObject* parent = nullptr) : QObject(parent) {}
signals:
    void cursorMoved(const QPoint& viewportPos);
protected:
    bool eventFilter(QObject*, QEvent* e) override {
        if (e->type() == QEvent::MouseMove)
            emit cursorMoved(static_cast<QMouseEvent*>(e)->pos());
        return false;
    }
};

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
    void onHostDrawEvent(const QJsonObject& event);
    void onHostViewportChanged(qreal x, qreal y, qreal scale);
    void onHostCursorMoved(const QPointF& scenePos);

signals:
    void hostingStarted(const QString& publicUrl);
    void hostingStopped();
    void guestEventReceived(const QJsonObject& event);
    void statusMessage(const QString& msg);
    void clientCountChanged(int count);

private slots:
    void onUrlReady(const QString& url);
    void onNgrokError(const QString& err);
    void onClientEvent(const QJsonObject& ev, QWebSocket* sender);
    void onClientConnected(int total);
    void onClientDisconnected(int total);
    void onNewGuest(QWebSocket* client);
    void broadcastSnapshot();
    void cleanupStaleCursors();

private:
    QImage captureSnapshot() const;
    void applyGuestEventToScene(const QJsonObject& ev);
    void updateGuestCursorOverlay(const QString& id, qreal x, qreal y, const QString& color);
    void removeGuestCursorOverlay(const QString& id);
    void clearAllCursorOverlays();
    void connectToScene();

    bool m_hosting = false;
    UBSharingServer* m_server = nullptr;
    UBNgrokManager*  m_ngrok  = nullptr;

    QTimer* m_snapshotTimer     = nullptr;
    QTimer* m_cursorCleanupTimer= nullptr;

    QHash<QString, GuestCursorInfo> m_guestCursors;
    QHash<QString, qint64>          m_guestLastSeen;
    qint64 m_lastHostCursorMs = 0;

    static UBSharingController* s_instance;
};

#endif
