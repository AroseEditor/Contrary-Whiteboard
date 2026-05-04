#pragma once
#include <QWidget>
#include <QTextBrowser>
#include <QLineEdit>
#include <QPushButton>
#include <QProgressBar>
#include <QLabel>

// Bottom-docked chat panel for the AI assistant
class UBAIChatPanel : public QWidget
{
    Q_OBJECT
public:
    explicit UBAIChatPanel(QWidget* parent = nullptr);

    void toggleVisibility();

protected:
    void keyPressEvent(QKeyEvent* e) override;

private slots:
    void sendMessage();
    void appendChunk(const QString& text);
    void onResponseComplete();
    void onDownloadProgress(qint64 rx, qint64 total);
    void onDownloadFinished(bool ok, const QString& err);
    void onServerStarted();
    void onServerFailed(const QString& reason);

private:
    void appendBubble(const QString& html, bool isUser);
    void setInputEnabled(bool enabled);

    QTextBrowser* m_history   = nullptr;
    QLineEdit*    m_input     = nullptr;
    QPushButton*  m_sendBtn   = nullptr;
    QProgressBar* m_progress  = nullptr;
    QLabel*       m_statusLbl = nullptr;

    bool m_streaming = false;
};
