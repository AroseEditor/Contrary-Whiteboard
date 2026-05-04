#include "UBNgrokManager.h"
#include "core/UBSettings.h"

#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QEventLoop>
#include <QJsonDocument>
#include <QJsonObject>
#include <QClipboard>
#include <QApplication>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QDesktopServices>
#include <QUrl>
#include <QMessageBox>
#include <QDebug>
#include <QRegularExpression>
#include <QTextStream>

UBNgrokManager::UBNgrokManager(QObject* parent)
    : QObject(parent)
{}

UBNgrokManager::~UBNgrokManager()
{
    stopTunnel();
}

bool UBNgrokManager::isRunning() const
{
    return m_process && m_process->state() != QProcess::NotRunning;
}

void UBNgrokManager::stopTunnel()
{
    if (m_process) {
        m_process->terminate();
        m_process->waitForFinished(3000);
        m_process->deleteLater();
        m_process = nullptr;
    }
    m_urlEmitted = false;
}

QString UBNgrokManager::ngrokBinaryPath() const
{
    QString dataDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dataDir);
#ifdef Q_OS_WIN
    return dataDir + "/ngrok.exe";
#else
    return dataDir + "/ngrok";
#endif
}

QString UBNgrokManager::savedToken() const
{
    return UBSettings::settings()->value("Sharing/NgrokAuthToken", "").toString();
}

void UBNgrokManager::saveToken(const QString& token)
{
    UBSettings::settings()->setValue("Sharing/NgrokAuthToken", token);
}

bool UBNgrokManager::showTokenDialog(QWidget* parent)
{
    QDialog dlg(parent);
    dlg.setWindowTitle(tr("Set Up ngrok — Host Whiteboard"));
    dlg.setMinimumWidth(480);

    QVBoxLayout* layout = new QVBoxLayout(&dlg);
    layout->setSpacing(12);
    layout->setContentsMargins(20, 20, 20, 20);

    // Title
    QLabel* title = new QLabel(
        QString("<b style='font-size:14px'>%1</b>").arg(tr("Connect your ngrok account")), &dlg);
    layout->addWidget(title);

    // Step 1
    QLabel* step1 = new QLabel(
        tr("<b>Step 1:</b> Create a free ngrok account"), &dlg);
    step1->setTextFormat(Qt::RichText);
    layout->addWidget(step1);

    QPushButton* openSignup = new QPushButton(tr("Open ngrok.com/signup  ↗"), &dlg);
    openSignup->setStyleSheet("color: #4285f4; text-decoration: underline; background: transparent; border: none;");
    QObject::connect(openSignup, &QPushButton::clicked, []{
        QDesktopServices::openUrl(QUrl("https://ngrok.com/signup"));
    });
    layout->addWidget(openSignup);

    // Step 2
    QLabel* step2 = new QLabel(
        tr("<b>Step 2:</b> Copy your authtoken from the ngrok dashboard"), &dlg);
    step2->setTextFormat(Qt::RichText);
    layout->addWidget(step2);

    QPushButton* openToken = new QPushButton(tr("Open ngrok Dashboard → Your Authtoken  ↗"), &dlg);
    openToken->setStyleSheet("color: #4285f4; text-decoration: underline; background: transparent; border: none;");
    QObject::connect(openToken, &QPushButton::clicked, []{
        QDesktopServices::openUrl(QUrl("https://dashboard.ngrok.com/get-started/your-authtoken"));
    });
    layout->addWidget(openToken);

    // Step 3
    QLabel* step3 = new QLabel(
        tr("<b>Step 3:</b> Paste your authtoken below:"), &dlg);
    step3->setTextFormat(Qt::RichText);
    layout->addWidget(step3);

    QLineEdit* tokenEdit = new QLineEdit(&dlg);
    tokenEdit->setPlaceholderText(tr("Paste authtoken here..."));
    tokenEdit->setEchoMode(QLineEdit::Password);

    // Pre-fill if already saved
    QString existing = savedToken();
    if (!existing.isEmpty())
        tokenEdit->setText(existing);

    layout->addWidget(tokenEdit);

    // Note
    QLabel* note = new QLabel(
        tr("<small style='color:grey'>Your token is stored locally and never shared.</small>"), &dlg);
    note->setTextFormat(Qt::RichText);
    layout->addWidget(note);

    // Buttons
    QHBoxLayout* btnRow = new QHBoxLayout();
    QPushButton* saveBtn = new QPushButton(tr("Save && Connect"), &dlg);
    saveBtn->setDefault(true);
    QPushButton* cancelBtn = new QPushButton(tr("Cancel"), &dlg);
    btnRow->addStretch();
    btnRow->addWidget(cancelBtn);
    btnRow->addWidget(saveBtn);
    layout->addLayout(btnRow);

    QObject::connect(cancelBtn, &QPushButton::clicked, &dlg, &QDialog::reject);
    QObject::connect(saveBtn, &QPushButton::clicked, [&]() {
        if (tokenEdit->text().trimmed().isEmpty()) {
            QMessageBox::warning(&dlg, tr("Token Required"),
                tr("Please paste your ngrok authtoken before connecting."));
            return;
        }
        dlg.accept();
    });

    if (dlg.exec() != QDialog::Accepted)
        return false;

    saveToken(tokenEdit->text().trimmed());
    return true;
}

bool UBNgrokManager::ensureNgrokExists()
{
    QString path = ngrokBinaryPath();
    if (QFile::exists(path))
        return true;

    emit statusMessage(tr("Downloading ngrok..."));

    // Download the ngrok static binary
#ifdef Q_OS_WIN
    QUrl downloadUrl("https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip");
#elif defined(Q_OS_MACOS)
    QUrl downloadUrl("https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip");
#else
    QUrl downloadUrl("https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz");
#endif

    QNetworkAccessManager mgr;
    QNetworkReply* reply = mgr.get(QNetworkRequest(downloadUrl));

    QEventLoop loop;
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    loop.exec();

    if (reply->error() != QNetworkReply::NoError) {
        emit error(tr("Failed to download ngrok: %1").arg(reply->errorString()));
        reply->deleteLater();
        return false;
    }

    QByteArray data = reply->readAll();
    reply->deleteLater();

    // Save as zip, then extract the binary
    QString zipPath = ngrokBinaryPath() + ".zip";
    QFile zipFile(zipPath);
    if (!zipFile.open(QIODevice::WriteOnly)) {
        emit error(tr("Could not write ngrok archive to disk."));
        return false;
    }
    zipFile.write(data);
    zipFile.close();

    // Use system unzip/tar to extract
#ifdef Q_OS_WIN
    QString extractCmd = QString("powershell -Command \"Expand-Archive -Path '%1' -DestinationPath '%2' -Force\"")
        .arg(zipPath).arg(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation));
#else
    QString extractCmd = QString("unzip -o '%1' ngrok -d '%2'")
        .arg(zipPath).arg(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation));
#endif

    int exitCode = system(extractCmd.toLocal8Bit().constData());
    QFile::remove(zipPath);

#ifndef Q_OS_WIN
    // Make executable on Unix
    QFile::setPermissions(path,
        QFile::ReadOwner | QFile::WriteOwner | QFile::ExeOwner |
        QFile::ReadGroup | QFile::ExeGroup |
        QFile::ReadOther | QFile::ExeOther);
#endif

    if (!QFile::exists(path)) {
        emit error(tr("ngrok binary not found after extraction. Please install ngrok manually."));
        return false;
    }

    Q_UNUSED(exitCode);
    emit statusMessage(tr("ngrok downloaded successfully."));
    return true;
}

void UBNgrokManager::startTunnel(quint16 port)
{
    if (isRunning())
        stopTunnel();

    // Ensure the binary exists
    if (!ensureNgrokExists())
        return;

    // Show auth dialog if no token saved
    QString token = savedToken();
    if (token.isEmpty()) {
        // Find a parent widget
        QWidget* parentWidget = qobject_cast<QWidget*>(QApplication::activeWindow());
        if (!showTokenDialog(parentWidget))
            return;
        token = savedToken();
    }

    m_port = port;
    m_urlEmitted = false;

    m_process = new QProcess(this);
    m_process->setProcessChannelMode(QProcess::MergedChannels);

    connect(m_process, &QProcess::readyRead,        this, &UBNgrokManager::onNgrokOutput);
    connect(m_process, &QProcess::errorOccurred,    this, &UBNgrokManager::onNgrokError);
    connect(m_process, qOverload<int, QProcess::ExitStatus>(&QProcess::finished),
            this, [this](int code, QProcess::ExitStatus) { onNgrokFinished(code); });

    // Configure authtoken first (creates ~/.config/ngrok/ngrok.yml)
    QProcess configure;
    configure.start(ngrokBinaryPath(), {"config", "add-authtoken", token});
    configure.waitForFinished(10000);

    // Start the HTTP tunnel with JSON log output for easy URL parsing
    m_process->start(ngrokBinaryPath(), {
        "http",
        QString::number(m_port),
        "--log=stdout",
        "--log-format=json"
    });

    if (!m_process->waitForStarted(5000)) {
        emit error(tr("Failed to start ngrok process. Is it installed?"));
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void UBNgrokManager::onNgrokOutput()
{
    if (!m_process) return;
    while (m_process->canReadLine()) {
        QString line = m_process->readLine().trimmed();
        qDebug() << "[ngrok]" << line;

        if (!m_urlEmitted) {
            // Parse JSON log lines for the public URL
            // ngrok v3 emits: {"url":"https://xxx.ngrok.io","proto":"https",...}
            QJsonParseError err;
            QJsonDocument doc = QJsonDocument::fromJson(line.toUtf8(), &err);
            if (err.error == QJsonParseError::NoError && doc.isObject()) {
                QJsonObject obj = doc.object();
                QString url = obj.value("url").toString();
                if (!url.isEmpty() && url.startsWith("https://")) {
                    m_urlEmitted = true;
                    // Copy URL to clipboard automatically
                    QApplication::clipboard()->setText(url);
                    emit urlReady(url);
                }
            }
        }
    }
}

void UBNgrokManager::onNgrokError()
{
    emit error(tr("ngrok process error: %1").arg(m_process ? m_process->errorString() : ""));
}

void UBNgrokManager::onNgrokFinished(int exitCode)
{
    qDebug() << "ngrok exited with code" << exitCode;
    if (exitCode != 0 && !m_urlEmitted) {
        emit error(tr("ngrok exited unexpectedly (code %1). Check your authtoken.").arg(exitCode));
    }
}
