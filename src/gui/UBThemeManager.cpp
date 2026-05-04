#include "UBThemeManager.h"
#include <QStyleFactory>

void UBThemeManager::applyTheme(const QString& theme)
{
    if (theme == "Dark") {
        qApp->setPalette(darkPalette());
        qApp->setStyle(QStyleFactory::create("Fusion"));
    } else {
        // Light — restore default Fusion + system palette
        qApp->setStyle(QStyleFactory::create("Fusion"));
        qApp->setPalette(lightPalette());
    }
}

QPalette UBThemeManager::darkPalette()
{
    QPalette p;
    p.setColor(QPalette::Window,          QColor(0x1e, 0x1e, 0x1e));
    p.setColor(QPalette::WindowText,      QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Base,            QColor(0x2d, 0x2d, 0x2d));
    p.setColor(QPalette::AlternateBase,   QColor(0x25, 0x25, 0x25));
    p.setColor(QPalette::ToolTipBase,     QColor(0x1e, 0x1e, 0x1e));
    p.setColor(QPalette::ToolTipText,     QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Text,            QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Button,          QColor(0x3a, 0x3a, 0x3a));
    p.setColor(QPalette::ButtonText,      QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::BrightText,      Qt::red);
    p.setColor(QPalette::Link,            QColor(0x42, 0xa5, 0xf5));
    p.setColor(QPalette::Highlight,       QColor(0x42, 0x84, 0xf4));
    p.setColor(QPalette::HighlightedText, Qt::white);
    p.setColor(QPalette::Disabled, QPalette::ButtonText, QColor(0x70, 0x70, 0x70));
    p.setColor(QPalette::Disabled, QPalette::WindowText, QColor(0x70, 0x70, 0x70));
    p.setColor(QPalette::Disabled, QPalette::Text,       QColor(0x70, 0x70, 0x70));
    return p;
}

QPalette UBThemeManager::lightPalette()
{
    // Standard system light palette via Fusion style
    return QApplication::style()->standardPalette();
}
