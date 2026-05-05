#pragma once
#include <QObject>
#include <QProcess>
#include <QFile>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QString>

// Downloads, launches, and communicates with the llamafile backend.
// Model: Qwen2.5-0.5B-Instruct.Q4_K_M.llamafile (~350 MB, runs CPU-only)
class UBAIBackend : public QObject
{
    Q_OBJECT
public:
    static UBAIBackend* instance();
    explicit UBAIBackend(QObject* parent = nullptr);
    ~UBAIBackend();

    bool isEnabled() const;
    void setEnabled(bool enabled);

    bool isModelDownloaded() const;
    bool isServerRunning() const { return m_serverRunning; }

    // Start the llamafile server (downloads model first if needed)
    void ensureRunning();
    void shutdown();

    // Send a message, response comes via messageChunk() / responseComplete()
    void sendMessage(const QString& userText);

    // Where the model file lives on disk
    static QString modelPath();

signals:
    void downloadProgress(qint64 received, qint64 total);
    void downloadFinished(bool ok, const QString& error);
    void serverStarted();
    void serverFailed(const QString& reason);
    void messageChunk(const QString& text);   // streaming token
    void responseComplete();
    void statusChanged(const QString& msg);

private slots:
    void onDownloadReadyRead();
    void onDownloadFinished();
    void onProcessOutput();
    void onProcessError();

private:
    void downloadModel();
    void startServer();
    void doChat(const QString& userText);

    static UBAIBackend* s_instance;

    QNetworkAccessManager* m_nam       = nullptr;
    QNetworkReply*         m_dlReply   = nullptr;
    QProcess*              m_process   = nullptr;
    bool                   m_serverRunning = false;
    bool                   m_downloading   = false;

    QFile*   m_dlFile   = nullptr;
    QString  m_pendingMessage;
};
