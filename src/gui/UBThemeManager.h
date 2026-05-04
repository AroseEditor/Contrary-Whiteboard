#ifndef UBTHEMEMANAGER_H
#define UBTHEMEMANAGER_H

#include <QString>
#include <QApplication>
#include <QPalette>

class UBThemeManager
{
public:
    static void applyTheme(const QString& theme);
    static QPalette darkPalette();
    static QPalette lightPalette();
};

#endif // UBTHEMEMANAGER_H
