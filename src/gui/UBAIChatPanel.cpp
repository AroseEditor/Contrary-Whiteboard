#include "UBAIChatPanel.h"
#include "UBAIBackend.h"

#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QKeyEvent>
#include <QScrollBar>
#include <QFrame>

UBAIChatPanel::UBAIChatPanel(QWidget* parent) : QWidget(parent)
{
    setObjectName("aiChatPanel");
    setMinimumHeight(200);
    setMaximumHeight(360);
    setSizePolicy(QSizePolicy::Expanding, QSizePolicy::Fixed);

    // ── Stylesheet ────────────────────────────────────────────────────────────
    setStyleSheet(R"(
        #aiChatPanel {
            background: #16213e;
            border-top: 2px solid #4285f4;
        }
        QTextBrowser {
            background: #0f3460;
            color: #e0e0e0;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            padding: 6px;
        }
        QLineEdit {
            background: #1a2a4a;
            color: #f0f0f0;
            border: 1px solid #4285f4;
            border-radius: 18px;
            padding: 6px 14px;
            font-size: 13px;
        }
        QPushButton#sendBtn {
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 18px;
            padding: 6px 18px;
            font-size: 13px;
            font-weight: bold;
        }
        QPushButton#sendBtn:hover  { background: #5a95ff; }
        QPushButton#sendBtn:pressed{ background: #2a65d4; }
        QPushButton#sendBtn:disabled { background: #2a3a5a; color: #666; }
        QLabel#statusLbl { color: #8ab4f8; font-size: 11px; }
        QProgressBar {
            background: #1a2a4a; border: 1px solid #4285f4;
            border-radius: 4px; height: 6px; text-align: center;
        }
        QProgressBar::chunk { background: #4285f4; border-radius: 4px; }
    )");

    // ── Layout ────────────────────────────────────────────────────────────────
    auto* root = new QVBoxLayout(this);
    root->setContentsMargins(10, 6, 10, 8);
    root->setSpacing(6);

    // Header bar
    auto* header = new QHBoxLayout();
    auto* title  = new QLabel("🤖  AI Assistant  (Qwen 2.5 · 0.5B · offline)", this);
    title->setStyleSheet("color:#8ab4f8; font-size:12px; font-weight:bold;");
    m_statusLbl = new QLabel(this);
    m_statusLbl->setObjectName("statusLbl");
    auto* closeBtn = new QPushButton("✕", this);
    closeBtn->setFixedSize(22, 22);
    closeBtn->setStyleSheet("QPushButton{background:transparent;color:#888;border:none;font-size:14px;}"
                            "QPushButton:hover{color:#fff;}");
    connect(closeBtn, &QPushButton::clicked, this, &UBAIChatPanel::hide);
    header->addWidget(title);
    header->addStretch();
    header->addWidget(m_statusLbl);
    header->addWidget(closeBtn);
    root->addLayout(header);

    // Download progress (hidden by default)
    m_progress = new QProgressBar(this);
    m_progress->hide();
    m_progress->setTextVisible(false);
    root->addWidget(m_progress);

    // Message history
    m_history = new QTextBrowser(this);
    m_history->setOpenExternalLinks(false);
    root->addWidget(m_history, 1);

    // Input row
    auto* inputRow = new QHBoxLayout();
    m_input = new QLineEdit(this);
    m_input->setPlaceholderText("Ask anything…");
    m_sendBtn = new QPushButton("Send", this);
    m_sendBtn->setObjectName("sendBtn");
    m_sendBtn->setFixedHeight(34);
    inputRow->addWidget(m_input, 1);
    inputRow->addWidget(m_sendBtn);
    root->addLayout(inputRow);

    // Connections
    connect(m_sendBtn, &QPushButton::clicked, this, &UBAIChatPanel::sendMessage);
    connect(m_input, &QLineEdit::returnPressed, this, &UBAIChatPanel::sendMessage);

    // Wire AI backend signals
    auto* ai = UBAIBackend::instance();
    connect(ai, &UBAIBackend::messageChunk,      this, &UBAIChatPanel::appendChunk);
    connect(ai, &UBAIBackend::responseComplete,  this, &UBAIChatPanel::onResponseComplete);
    connect(ai, &UBAIBackend::downloadProgress,  this, &UBAIChatPanel::onDownloadProgress);
    connect(ai, &UBAIBackend::downloadFinished,  this, &UBAIChatPanel::onDownloadFinished);
    connect(ai, &UBAIBackend::serverStarted,     this, &UBAIChatPanel::onServerStarted);
    connect(ai, &UBAIBackend::serverFailed,      this, &UBAIChatPanel::onServerFailed);
    connect(ai, &UBAIBackend::statusChanged, m_statusLbl, &QLabel::setText);

    // Trigger server start if model is already downloaded
    if (ai->isModelDownloaded() && !ai->isServerRunning())
        ai->ensureRunning();
}

void UBAIChatPanel::toggleVisibility()
{
    setVisible(!isVisible());
    if (isVisible()) {
        m_input->setFocus();
        // Kick off the backend if not yet running
        UBAIBackend::instance()->ensureRunning();
    }
}

void UBAIChatPanel::keyPressEvent(QKeyEvent* e)
{
    if (e->key() == Qt::Key_Escape) hide();
    else QWidget::keyPressEvent(e);
}

// ── Sending ───────────────────────────────────────────────────────────────────
void UBAIChatPanel::sendMessage()
{
    QString text = m_input->text().trimmed();
    if (text.isEmpty() || m_streaming) return;

    m_input->clear();
    m_streaming = true;
    setInputEnabled(false);

    // Show user bubble
    appendBubble(text.toHtmlEscaped(), true);

    // Start AI response bubble (will be filled by appendChunk)
    m_history->append("<div style='margin:6px 0; text-align:left;'>"
                      "<span style='background:#1e3a6e;color:#e0e0e0;border-radius:12px;"
                      "padding:6px 12px;display:inline-block;max-width:90%;'>"
                      "<span id='ai-streaming'></span></div>");

    UBAIBackend::instance()->sendMessage(text);
}

void UBAIChatPanel::appendChunk(const QString& text)
{
    // Append to the last AI bubble by modifying the document in-place
    QTextCursor cursor(m_history->document());
    cursor.movePosition(QTextCursor::End);
    cursor.insertText(text);
    m_history->verticalScrollBar()->setValue(m_history->verticalScrollBar()->maximum());
}

void UBAIChatPanel::onResponseComplete()
{
    m_streaming = false;
    setInputEnabled(true);
    m_input->setFocus();
    m_history->append(""); // trailing newline
}

// ── Download / server events ──────────────────────────────────────────────────
void UBAIChatPanel::onDownloadProgress(qint64 rx, qint64 total)
{
    m_progress->show();
    if (total > 0) {
        m_progress->setMaximum((int)(total / 1024));
        m_progress->setValue((int)(rx / 1024));
    } else {
        m_progress->setMaximum(0); // indeterminate
    }
}

void UBAIChatPanel::onDownloadFinished(bool ok, const QString& err)
{
    m_progress->hide();
    if (!ok) {
        appendBubble("⚠️ Download failed: " + err.toHtmlEscaped(), false);
        setInputEnabled(false);
    }
}

void UBAIChatPanel::onServerStarted()
{
    setInputEnabled(true);
    appendBubble("✅ AI is ready! Ask me anything.", false);
}

void UBAIChatPanel::onServerFailed(const QString& reason)
{
    appendBubble("⚠️ AI server failed: " + reason.toHtmlEscaped(), false);
    setInputEnabled(false);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
void UBAIChatPanel::appendBubble(const QString& html, bool isUser)
{
    if (isUser) {
        m_history->append(
            "<div style='margin:6px 0; text-align:right;'>"
            "<span style='background:#4285f4;color:#fff;border-radius:12px;"
            "padding:6px 12px;display:inline-block;max-width:90%;'>"
            + html + "</span></div>");
    } else {
        m_history->append(
            "<div style='margin:6px 0; text-align:left;'>"
            "<span style='background:#1e3a6e;color:#e0e0e0;border-radius:12px;"
            "padding:6px 12px;display:inline-block;max-width:90%;'>"
            + html + "</span></div>");
    }
    m_history->verticalScrollBar()->setValue(m_history->verticalScrollBar()->maximum());
}

void UBAIChatPanel::setInputEnabled(bool enabled)
{
    m_input->setEnabled(enabled);
    m_sendBtn->setEnabled(enabled);
    m_sendBtn->setText(enabled ? "Send" : "…");
}
