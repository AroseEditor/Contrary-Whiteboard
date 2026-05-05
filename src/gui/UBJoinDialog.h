#ifndef UBJOINDIALOG_H
#define UBJOINDIALOG_H

#include <QDialog>
#include <QLineEdit>
#include <QVBoxLayout>
#include <QLabel>
#include <QPushButton>

class UBJoinDialog : public QDialog
{
    Q_OBJECT
public:
    explicit UBJoinDialog(QWidget* parent = nullptr) : QDialog(parent) {
        setWindowTitle(tr("Join Collaboration Session"));
        setMinimumWidth(400);

        auto* layout = new QVBoxLayout(this);
        layout->setSpacing(15);
        layout->setContentsMargins(20, 20, 20, 20);

        auto* title = new QLabel(tr("Enter Room ID (ngrok URL) to collaborate:"), this);
        title->setStyleSheet("font-weight: bold; font-size: 14px;");
        layout->addWidget(title);

        m_urlEdit = new QLineEdit(this);
        m_urlEdit->setPlaceholderText("https://xxxx-xxx.ngrok-free.app");
        m_urlEdit->setStyleSheet("padding: 8px; border-radius: 4px; border: 1px solid #ccc;");
        layout->addWidget(m_urlEdit);

        auto* nameLabel = new QLabel(tr("Your Name:"), this);
        layout->addWidget(nameLabel);

        m_nameEdit = new QLineEdit(this);
        m_nameEdit->setPlaceholderText(tr("App Guest"));
        m_nameEdit->setStyleSheet("padding: 8px; border-radius: 4px; border: 1px solid #ccc;");
        layout->addWidget(m_nameEdit);

        auto* btnLayout = new QHBoxLayout();
        auto* cancelBtn = new QPushButton(tr("Cancel"), this);
        auto* joinBtn = new QPushButton(tr("Join Session"), this);
        joinBtn->setStyleSheet("background-color: #10b981; color: white; font-weight: bold; padding: 8px 16px; border-radius: 4px;");
        
        btnLayout->addStretch();
        btnLayout->addWidget(cancelBtn);
        btnLayout->addWidget(joinBtn);
        layout->addLayout(btnLayout);

        connect(cancelBtn, &QPushButton::clicked, this, &QDialog::reject);
        connect(joinBtn, &QPushButton::clicked, this, &QDialog::accept);
        connect(m_urlEdit, &QLineEdit::returnPressed, this, &QDialog::accept);
    }

    QString url() const { return m_urlEdit->text().trimmed(); }
    QString userName() const { return m_nameEdit->text().trimmed(); }

private:
    QLineEdit* m_urlEdit;
    QLineEdit* m_nameEdit;
};

#endif
