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
    explicit UBJoinDialog(QWidget* parent = nullptr);

    QString url() const;
    QString userName() const;

private:
    QLineEdit* m_urlEdit;
    QLineEdit* m_nameEdit;
};

#endif
