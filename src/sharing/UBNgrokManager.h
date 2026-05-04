#ifndef UBNGROKMANAGER_H
#define UBNGROKMANAGER_H

#include <QObject>
#include <QProcess>
#include <QString>
#include <QDialog>
#include <QLineEdit>
#include <QPushButton>
#include <QLabel>

// Downloads ngrok (if needed) and tunnels the local WebSocket server.
// On first use shows a step-by-step authtoken setup dialog.
class UBNgrokManager : public QObject
{
    Q_OBJECT
public:
    explicit UBNgrokManager(QObject* parent = nullptr);
    ~UBNgrokManager();

    // Start ngrok tunnel for the given port.
    // Shows authtoken dialog if no token is saved.
    void startTunnel(quint16 port);
    void stopTunnel();
    bool isRunning() const;

signals:
    void urlReady(const QString& publicUrl);
    void error(const QString& errorMsg);
    void statusMessage(const QString& msg);

private slots:
    void onNgrokOutput();
    void onNgrokError();
    void onNgrokFinished(int exitCode);

private:
    QString ngrokBinaryPath() const;
    bool ensureNgrokExists();
    QString savedToken() const;
    void saveToken(const QString& token);
    bool showTokenDialog(QWidget* parent = nullptr);

    QProcess* m_process = nullptr;
    bool m_urlEmitted = false;
    quint16 m_port = 0;
};

#endif // UBNGROKMANAGER_H
