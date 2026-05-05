#include "UBJoinDialog.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>

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

    m_urlEdit = new QLineEdit(this);
    m_urlEdit->setPlaceholderText(tr("e.g., https://abcd-123.ngrok-free.app"));
    m_urlEdit->setStyleSheet("QLineEdit { background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 10px; color: white; selection-background-color: #10b981; }"
                              "QLineEdit:focus { border: 1px solid #10b981; }");
    layout->addWidget(m_urlEdit);

    auto* nameTitle = new QLabel(tr("Your Name"), this);
    nameTitle->setStyleSheet("font-size: 14px; color: #a3a3a3;");
    layout->addWidget(nameTitle);

    m_nameEdit = new QLineEdit(this);
    m_nameEdit->setPlaceholderText(tr("Guest"));
    m_nameEdit->setStyleSheet("QLineEdit { background: #262626; border: 1px solid #404040; border-radius: 8px; padding: 10px; color: white; }"
                               "QLineEdit:focus { border: 1px solid #10b981; }");
    layout->addWidget(m_nameEdit);

    layout->addStretch();

    auto* joinBtn = new QPushButton(tr("Join Session"), this);
    joinBtn->setCursor(Qt::PointingHandCursor);
    joinBtn->setStyleSheet("QPushButton { background: #10b981; color: white; border: none; border-radius: 8px; padding: 12px; font-weight: bold; font-size: 14px; }"
                           "QPushButton:hover { background: #059669; }"
                           "QPushButton:pressed { background: #047857; }");
    layout->addWidget(joinBtn);

    connect(joinBtn, &QPushButton::clicked, this, &QDialog::accept);
    connect(m_urlEdit, &QLineEdit::returnPressed, this, &QDialog::accept);
}

QString UBJoinDialog::url() const {
    QString u = m_urlEdit->text().trimmed();
    if (u.isEmpty()) return QString();

    // Remove any trailing slashes
    while (u.endsWith('/')) u.chop(1);

    // If it's a raw domain or ngrok ID (no protocol at all)
    if (!u.contains("://")) {
        // Most modern web-based sharing uses wss
        u = "wss://" + u;
    }

    // Convert https to wss and http to ws for websocket compatibility
    if (u.startsWith("https://")) {
        u.replace("https://", "wss://");
    } else if (u.startsWith("http://")) {
        u.replace("http://", "ws://");
    }

    // Ensure we have a protocol
    if (!u.startsWith("ws://") && !u.startsWith("wss://")) {
         u = "wss://" + u;
    }

    return u;
}

QString UBJoinDialog::userName() const {
    QString n = m_nameEdit->text().trimmed();
    return n.isEmpty() ? tr("Guest") : n;
}
