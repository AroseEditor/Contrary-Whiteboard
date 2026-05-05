#include "UBAIBackend.h"
#include "core/UBSettings.h"

#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QTimer>
#include <QThread>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QNetworkRequest>
#include <QDebug>

// Model download URL (Mozilla's pre-quantized llamafile, Qwen 2.5 0.5B Q4)
static const char* MODEL_URL =
    "https://huggingface.co/Mozilla/Qwen2.5-0.5B-Instruct-llamafile/"
    "resolve/main/Qwen2.5-0.5B-Instruct.Q4_K_M.llamafile";
static const char* MODEL_FILENAME = "Qwen2.5-0.5B-Instruct.Q4_K_M.llamafile";
static const int   SERVER_PORT    = 8742;

UBAIBackend* UBAIBackend::s_instance = nullptr;
UBAIBackend* UBAIBackend::instance()
{
    if (!s_instance) s_instance = new UBAIBackend(qApp);
    return s_instance;
}

UBAIBackend::UBAIBackend(QObject* parent) : QObject(parent)
{
    s_instance = this;
    m_nam = new QNetworkAccessManager(this);
}

UBAIBackend::~UBAIBackend()
{
    shutdown();
    s_instance = nullptr;
}

bool UBAIBackend::isEnabled() const
{
    return UBSettings::settings()->value("AI/enabled", false).toBool();
}
void UBAIBackend::setEnabled(bool enabled)
{
    UBSettings::settings()->setValue("AI/enabled", enabled);
}

QString UBAIBackend::modelPath()
{
    QString dataDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dataDir + "/ai");
    return dataDir + "/ai/" + MODEL_FILENAME;
}

bool UBAIBackend::isModelDownloaded() const
{
    QFileInfo fi(modelPath());
    return fi.exists() && fi.size() > 100 * 1024 * 1024; // > 100 MB = valid
}

void UBAIBackend::ensureRunning()
{
    if (m_serverRunning) return;
    if (!isModelDownloaded()) {
        if (!m_downloading) downloadModel();
        return;
    }
    startServer();
}

void UBAIBackend::shutdown()
{
    if (m_process && m_process->state() != QProcess::NotRunning) {
        m_process->terminate();
        m_process->waitForFinished(2000);
        m_process->kill();
    }
    delete m_process; m_process = nullptr;
    m_serverRunning = false;
}

// ── Download ─────────────────────────────────────────────────────────────────
void UBAIBackend::downloadModel()
{
    m_downloading = true;
    emit statusChanged(tr("Downloading AI model (~350 MB)…"));

    QString tmpPath = modelPath() + ".download";
    m_dlFile = new QFile(tmpPath, this);
    if (!m_dlFile->open(QIODevice::WriteOnly)) {
        emit downloadFinished(false, tr("Cannot write to %1").arg(tmpPath));
        m_downloading = false;
        return;
    }

    QNetworkRequest req(QUrl(MODEL_URL));
    req.setRawHeader("User-Agent", "ContraryWhiteboard/1.0");
    req.setAttribute(QNetworkRequest::RedirectPolicyAttribute,
                     QNetworkRequest::NoLessSafeRedirectPolicy);
    m_dlReply = m_nam->get(req);
    connect(m_dlReply, &QNetworkReply::downloadProgress, this, &UBAIBackend::downloadProgress);
    connect(m_dlReply, &QNetworkReply::readyRead,  this, &UBAIBackend::onDownloadReadyRead);
    connect(m_dlReply, &QNetworkReply::finished,   this, &UBAIBackend::onDownloadFinished);
}

void UBAIBackend::onDownloadReadyRead()
{
    if (m_dlFile) m_dlFile->write(m_dlReply->readAll());
}

void UBAIBackend::onDownloadFinished()
{
    m_downloading = false;
    m_dlFile->flush(); m_dlFile->close();
    delete m_dlFile; m_dlFile = nullptr;

    if (m_dlReply->error() != QNetworkReply::NoError) {
        emit downloadFinished(false, m_dlReply->errorString());
        m_dlReply->deleteLater(); m_dlReply = nullptr;
        return;
    }

    // On Windows, llamafile is a PE executable — just rename it
    QString final = modelPath();
    QFile::remove(final);
    QFile::rename(final + ".download", final);

#ifdef Q_OS_WIN
    // Make executable (Windows doesn't need chmod but rename is done)
#else
    QFile::setPermissions(final, QFile::permissions(final)
                          | QFileDevice::ExeOwner | QFileDevice::ExeUser);
#endif

    m_dlReply->deleteLater(); m_dlReply = nullptr;
    emit downloadFinished(true, QString());
    emit statusChanged(tr("Download complete. Starting AI server…"));
    startServer();
}

// ── Server ────────────────────────────────────────────────────────────────────
void UBAIBackend::startServer()
{
    if (m_serverRunning) return;
    emit statusChanged(tr("Starting AI server…"));

    m_process = new QProcess(this);
    connect(m_process, &QProcess::readyReadStandardOutput, this, &UBAIBackend::onProcessOutput);
    connect(m_process, &QProcess::readyReadStandardError,  this, &UBAIBackend::onProcessOutput);
    connect(m_process, &QProcess::errorOccurred,           this, &UBAIBackend::onProcessError);

    QStringList args;
    args << "--server"
         << "--port" << QString::number(SERVER_PORT)
         << "--nobrowser"
         << "--ctx-size" << "2048"
         << "--threads" << QString::number(qMax(2, QThread::idealThreadCount() - 1));

    QString prog = modelPath();
#ifdef Q_OS_WIN
    // On Windows, llamafile is a PE EXE — invoke via cmd so the OS handles execution
    QStringList wsArgs;
    wsArgs << "/c" << prog;
    wsArgs += args;
    m_process->setProgram("cmd.exe");
    m_process->setArguments(wsArgs);
#else
    m_process->setProgram(prog);
    m_process->setArguments(args);
#endif
    m_process->start();

    // Wait up to 15 s for the server to be ready
    QTimer* watchdog = new QTimer(this);
    watchdog->setSingleShot(true);
    watchdog->start(15000);
    connect(watchdog, &QTimer::timeout, this, [this, watchdog]() {
        watchdog->deleteLater();
        if (!m_serverRunning) emit serverFailed(tr("AI server did not start in time."));
    });
}

void UBAIBackend::onProcessOutput()
{
    QByteArray out = m_process->readAllStandardOutput()
                   + m_process->readAllStandardError();
    QString text = QString::fromLocal8Bit(out);
    qDebug() << "[llamafile]" << text.trimmed();

    if (!m_serverRunning && (text.contains("HTTP server listening") ||
                             text.contains("starting the main loop") ||
                             text.contains("server listening"))) {
        m_serverRunning = true;
        emit serverStarted();
        emit statusChanged(tr("AI ready."));

        if (!m_pendingMessage.isEmpty()) {
            QString msg = m_pendingMessage;
            m_pendingMessage.clear();
            doChat(msg);
        }
    }
}

void UBAIBackend::onProcessError()
{
    emit serverFailed(m_process->errorString());
}

// ── Chat ──────────────────────────────────────────────────────────────────────
void UBAIBackend::sendMessage(const QString& userText)
{
    if (!m_serverRunning) {
        m_pendingMessage = userText;
        ensureRunning();
        return;
    }
    doChat(userText);
}

void UBAIBackend::doChat(const QString& userText)
{
    QJsonObject req;
    req["model"] = "local";
    req["stream"] = true;
    req["max_tokens"] = 512;
    QJsonArray messages;
    QJsonObject sys;
    sys["role"] = "system";
    sys["content"] = "You are a helpful assistant in Contrary Whiteboard, an educational whiteboard app. Give short, clear answers.";
    messages.append(sys);
    QJsonObject user;
    user["role"] = "user";
    user["content"] = userText;
    messages.append(user);
    req["messages"] = messages;

    QNetworkRequest netReq(QUrl(QString("http://127.0.0.1:%1/v1/chat/completions").arg(SERVER_PORT)));
    netReq.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    QNetworkReply* reply = m_nam->post(netReq, QJsonDocument(req).toJson(QJsonDocument::Compact));

    connect(reply, &QNetworkReply::readyRead, this, [this, reply]() {
        // Parse SSE chunks: "data: {...}\n\n"
        while (reply->canReadLine()) {
            QString line = QString::fromUtf8(reply->readLine()).trimmed();
            if (!line.startsWith("data:")) continue;
            QString json = line.mid(5).trimmed();
            if (json == "[DONE]") { emit responseComplete(); return; }
            QJsonDocument doc = QJsonDocument::fromJson(json.toUtf8());
            if (doc.isNull()) continue;
            QString delta = doc.object()["choices"].toArray().at(0).toObject()
                           ["delta"].toObject()["content"].toString();
            if (!delta.isEmpty()) emit messageChunk(delta);
        }
    });
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        emit responseComplete();
    });
}
