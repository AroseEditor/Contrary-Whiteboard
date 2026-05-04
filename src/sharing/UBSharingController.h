#ifndef UBSHARINGCONTROLLER_H
#define UBSHARINGCONTROLLER_H

#include <QObject>
#include <QJsonObject>
#include <QImage>
#include <QHash>
#include <QString>
#include <QPoint>
#include <QLabel>
#include <QTimer>
#include <QEvent>
#include <QMouseEvent>
#include <QGraphicsView>
#include "UBSharingServer.h"
#include "UBNgrokManager.h"

// Event filter installed on the board view's viewport to capture host cursor position
class UBCursorRelay : public QObject
{
    Q_OBJECT
public:
    explicit UBCursorRelay(QObject* parent = nullptr) : QObject(parent) {}

signals:
    void cursorMoved(const QPoint& viewportPos);

protected:
    bool eventFilter(QObject* obj, QEvent* event) override {
        if (event->type() == QEvent::MouseMove) {
            QMouseEvent* me = static_cast<QMouseEvent*>(event);
            emit cursorMoved(me->pos());
        }
        return false; // don't consume
    }
};

struct GuestCursorInfo {
    qreal x = 0, y = 0;
    QString color;
    QLabel* label = nullptr;
};

// Orchestrates UBSharingServer + UBNgrokManager.
// Handles bidirectional cursor relay between host Qt canvas and browser guests.
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
    // Called when host mouse moves over the board — broadcasts cursor to guests
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
    void onClientEvent(const QJsonObject& event);
    void onClientConnected(int total);
    void onClientDisconnected(int total);
    void cleanupStaleCursors();

private:
    QImage captureCanvasSnapshot() const;
    void updateGuestCursorOverlay(const QString& id, qreal x, qreal y, const QString& color);
    void removeGuestCursorOverlay(const QString& id);
    void clearAllCursorOverlays();

    bool m_hosting = false;
    UBSharingServer* m_server = nullptr;
    UBNgrokManager*  m_ngrok  = nullptr;

    // Guest cursor overlays shown on the Qt host canvas
    QHash<QString, GuestCursorInfo> m_guestCursors;
    QHash<QString, qint64>          m_guestLastSeen;  // for stale-cursor cleanup
    QTimer* m_cursorCleanupTimer = nullptr;

    // Throttle host cursor broadcasts
    qint64 m_lastHostCursorMs = 0;

    static UBSharingController* s_instance;
};

#endif // UBSHARINGCONTROLLER_H
