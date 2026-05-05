#include "UBJoinDialog.h"
#include <QPainter>
#include <QStyle>
#include <QIcon>

UBJoinDialog::UBJoinDialog(QWidget* parent) : QDialog(parent)
{
    setWindowTitle(tr("Join Collaboration"));
    setFixedSize(350, 280);
    setStyleSheet("QDialog { background-color: #1a1a1a; color: #ffffff; font-family: 'Inter', sans-serif; border-radius: 12px; }");

    auto* layout = new QVBoxLayout(this);
    layout->setContentsMargins(30, 30, 30, 30);
    layout->setSpacing(15);

    auto* title = new QLabel(tr("Enter Room ID"), this);
    title->setStyleSheet("font-size: 20px; font-weight: bold; color: #10b981; margin-bottom: 5px;");
    layout->addWidget(title);

    m_urlInput = new QLineEdit(this);
    m_urlInput->setPlaceholderText(tr("e.g., https://abcd-123.ngrok-free.app"));
    m_urlInput->setStyleSheet("QLineEdit { background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 10px; color: white; selection-background-color: #10b981; }"
                              "QLineEdit:focus { border: 1px solid #10b981; }");
    layout->addWidget(m_urlInput);

    auto* nameTitle = new QLabel(tr("Your Name"), this);
    nameTitle->setStyleSheet("font-size: 14px; color: #a3a3a3;");
    layout->addWidget(nameTitle);

    m_nameInput = new QLineEdit(this);
    m_nameInput->setPlaceholderText(tr("Guest"));
    m_nameInput->setStyleSheet("QLineEdit { background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 10px; color: white; }"
                               "QLineEdit:focus { border: 1px solid #10b981; }");
    layout->addWidget(m_nameInput);

    layout->addStretch();

    auto* joinBtn = new QPushButton(tr("Join Session"), this);
    joinBtn->setCursor(Qt::PointingHandCursor);
    joinBtn->setStyleSheet("QPushButton { background: #10b981; color: white; border: none; border-radius: 8px; padding: 12px; font-weight: bold; font-size: 14px; }"
                           "QPushButton:hover { background: #059669; }"
                           "QPushButton:pressed { background: #047857; }");
    layout->addWidget(joinBtn);

    connect(joinBtn, &QPushButton::clicked, this, &QDialog::accept);
    connect(m_urlInput, &QLineEdit::returnPressed, this, &QDialog::accept);
}

QString UBJoinDialog::url() const {
    QString u = m_urlInput->text().trimmed();
    if (!u.startsWith("ws://") && !u.startsWith("wss://") && !u.startsWith("http")) {
        // Assume ngrok-free.app or similar
        u = "wss://" + u;
    }
    // Convert https to wss for websockets
    if (u.startsWith("https://")) u.replace("https://", "wss://");
    if (u.startsWith("http://"))  u.replace("http://", "ws://");
    return u;
}

QString UBJoinDialog::userName() const {
    QString n = m_nameInput->text().trimmed();
    return n.isEmpty() ? tr("Guest") : n;
}
