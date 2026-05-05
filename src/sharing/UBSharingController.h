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
#include <QColor>
#include <QPointF>
#include "UBSharingServer.h"
#include "UBNgrokManager.h"

struct GuestCursorInfo {
    qreal x = 0, y = 0;
    QString color;
    QString name;
    QLabel* label = nullptr;
};

// Installed on board viewport — emits cursor + stroke events from host input
class UBBoardEventFilter : public QObject {
    Q_OBJECT
public:
    explicit UBBoardEventFilter(QGraphicsView* view, QObject* parent = nullptr)
        : QObject(parent), m_view(view) {}
signals:
    void cursorMoved(QPointF scenePos);
    void strokeSegment(QPointF from, QPointF to);
    void strokeEnded();
protected:
    bool eventFilter(QObject*, QEvent* e) override {
        if (!m_view) return false;
        auto type = e->type();
        if (type == QEvent::MouseMove) {
            auto* me = static_cast<QMouseEvent*>(e);
            QPointF sp = m_view->mapToScene(me->pos());
            emit cursorMoved(sp);
            if ((me->buttons() & Qt::LeftButton) && m_wasDown && !m_lastPos.isNull())
                emit strokeSegment(m_lastPos, sp);
            m_wasDown = me->buttons() & Qt::LeftButton;
            m_lastPos = sp;
        } else if (type == QEvent::MouseButtonPress) {
            auto* me = static_cast<QMouseEvent*>(e);
            if (me->button() == Qt::LeftButton) {
                m_wasDown = true;
                m_lastPos = m_view->mapToScene(me->pos());
            }
        } else if (type == QEvent::MouseButtonRelease) {
            m_wasDown = false;
            m_lastPos = {};
            emit strokeEnded();
        }
        return false;
    }
private:
    QGraphicsView* m_view;
    QPointF m_lastPos;
    bool m_wasDown = false;
};

class UBSharingController : public QObject
{
    Q_OBJECT
public:
    static UBSharingController* instance();
    explicit UBSharingController(QObject* parent = nullptr);
    ~UBSharingController();
    bool isHosting() const { return m_hosting; }
    bool isClient() const { return m_isClient; }

public slots:
    void toggleHosting();
    void joinSession(const QString& url, const QString& name);
    void leaveSession();
    void onHostDrawEvent(const QJsonObject& event);
    void onHostViewportChanged();
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
    void broadcastReconciliationSnapshot();
    void cleanupStaleCursors();
    void onPageChanged();
    void onHostStroke(QPointF from, QPointF to);
    void onHostStrokeEnded();

    // Client slots
    void onClientSocketConnected();
    void onClientSocketDisconnected();
    void onClientMessageReceived(const QString& message);
    void onClientSocketError(QAbstractSocket::SocketError error);

private:
    QImage captureSnapshot() const;
    QByteArray snapshotJpeg(int quality) const;
    void applyGuestEventToScene(const QJsonObject& ev);
    void updateGuestCursorOverlay(const QString& id, qreal x, qreal y,
                                  const QString& color, const QString& name);
    void removeGuestCursorOverlay(const QString& id);
    void clearAllCursorOverlays();
    void wireBoard();

    bool m_hosting = false;
    UBSharingServer*      m_server = nullptr;
    UBNgrokManager*       m_ngrok  = nullptr;
    UBBoardEventFilter*   m_boardFilter = nullptr;

    QTimer* m_reconcileTimer    = nullptr;  // full snapshot every 3 s
    QTimer* m_cursorCleanupTimer= nullptr;

    // Client mode
    bool m_isClient = false;
    QWebSocket* m_clientSocket = nullptr;
    QString m_clientName;

    // Current host pen state (read when stroke occurs)
    QColor  m_hostPenColor { Qt::black };
    double  m_hostPenWidth { 3.0 };
    qint64  m_lastCursorMs { 0 };

    QHash<QString, GuestCursorInfo> m_guestCursors;
    QHash<QString, qint64>          m_guestLastSeen;

    static UBSharingController* s_instance;
};

#endif
