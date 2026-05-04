#include "UBThemeManager.h"
#include <QStyleFactory>
#include <QStyle>

static const char* DARK_QSS = R"(
/* ── Main containers ── */
QMainWindow, QWidget#centralwidget {
    background-color: #1e1e1e;
}
QDialog {
    background-color: #252526;
    color: #f0f0f0;
}

/* ── Menus ── */
QMenuBar {
    background-color: #2d2d2d;
    color: #f0f0f0;
}
QMenuBar::item:selected {
    background-color: #4284f4;
    color: #ffffff;
}
QMenu {
    background-color: #252526;
    color: #f0f0f0;
    border: 1px solid #3f3f46;
}
QMenu::item:selected {
    background-color: #4284f4;
    color: #ffffff;
}
QMenu::separator {
    background: #3f3f46;
    height: 1px;
    margin: 3px 0;
}

/* ── Toolbars ── */
QToolBar {
    background-color: #2d2d2d;
    border: none;
    spacing: 2px;
}
QToolButton {
    background-color: transparent;
    color: #f0f0f0;
    border: none;
    padding: 4px;
    border-radius: 4px;
}
QToolButton:hover {
    background-color: #3e3e42;
}
QToolButton:checked, QToolButton:pressed {
    background-color: #4284f4;
    color: #ffffff;
}
QToolBar::separator {
    background: #3f3f46;
    width: 1px;
    margin: 4px 2px;
}

/* ── Status / dock areas ── */
QStatusBar {
    background-color: #007acc;
    color: #ffffff;
}
QDockWidget {
    background-color: #252526;
    color: #f0f0f0;
    titlebar-close-icon: none;
}
QDockWidget::title {
    background-color: #2d2d2d;
    padding: 4px;
}

/* ── Tabs ── */
QTabWidget::pane {
    border: 1px solid #3f3f46;
    background-color: #252526;
}
QTabBar::tab {
    background-color: #2d2d2d;
    color: #c0c0c0;
    padding: 6px 14px;
    border: 1px solid #3f3f46;
    border-bottom: none;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
}
QTabBar::tab:selected {
    background-color: #252526;
    color: #f0f0f0;
    border-bottom: 2px solid #4284f4;
}
QTabBar::tab:hover:!selected {
    background-color: #3e3e42;
}

/* ── Input widgets ── */
QLineEdit, QTextEdit, QPlainTextEdit, QSpinBox, QDoubleSpinBox {
    background-color: #3c3c3c;
    color: #f0f0f0;
    border: 1px solid #3f3f46;
    border-radius: 3px;
    padding: 2px 4px;
    selection-background-color: #4284f4;
}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {
    border: 1px solid #4284f4;
}
QComboBox {
    background-color: #3c3c3c;
    color: #f0f0f0;
    border: 1px solid #3f3f46;
    border-radius: 3px;
    padding: 2px 8px;
}
QComboBox::drop-down {
    border: none;
    background: transparent;
}
QComboBox QAbstractItemView {
    background-color: #252526;
    color: #f0f0f0;
    selection-background-color: #4284f4;
    border: 1px solid #3f3f46;
}

/* ── Buttons ── */
QPushButton {
    background-color: #0e639c;
    color: #ffffff;
    border: none;
    padding: 5px 14px;
    border-radius: 3px;
}
QPushButton:hover {
    background-color: #1177bb;
}
QPushButton:pressed {
    background-color: #094771;
}
QPushButton:disabled {
    background-color: #3c3c3c;
    color: #6a6a6a;
}

/* ── Labels ── */
QLabel {
    color: #f0f0f0;
    background: transparent;
}

/* ── Group boxes ── */
QGroupBox {
    color: #f0f0f0;
    border: 1px solid #3f3f46;
    border-radius: 5px;
    margin-top: 8px;
    padding-top: 8px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    padding: 0 4px;
    color: #c0c0c0;
}

/* ── Checkboxes / radios ── */
QCheckBox, QRadioButton {
    color: #f0f0f0;
    spacing: 6px;
}
QCheckBox::indicator, QRadioButton::indicator {
    width: 14px;
    height: 14px;
    border: 1px solid #3f3f46;
    border-radius: 3px;
    background-color: #3c3c3c;
}
QCheckBox::indicator:checked {
    background-color: #4284f4;
    border-color: #4284f4;
}

/* ── Sliders ── */
QSlider::groove:horizontal {
    background: #3c3c3c;
    height: 4px;
    border-radius: 2px;
}
QSlider::handle:horizontal {
    background: #4284f4;
    width: 14px;
    height: 14px;
    margin: -5px 0;
    border-radius: 7px;
}
QSlider::sub-page:horizontal {
    background: #4284f4;
    border-radius: 2px;
}

/* ── Scroll bars ── */
QScrollBar:vertical {
    background: #252526;
    width: 10px;
    border-radius: 5px;
}
QScrollBar::handle:vertical {
    background: #5a5a5a;
    border-radius: 5px;
    min-height: 20px;
}
QScrollBar::handle:vertical:hover {
    background: #888;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }

QScrollBar:horizontal {
    background: #252526;
    height: 10px;
    border-radius: 5px;
}
QScrollBar::handle:horizontal {
    background: #5a5a5a;
    border-radius: 5px;
    min-width: 20px;
}
QScrollBar::handle:horizontal:hover { background: #888; }
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; }

/* ── List / tree / table views ── */
QListView, QTreeView, QTableView {
    background-color: #252526;
    color: #f0f0f0;
    border: 1px solid #3f3f46;
    selection-background-color: #4284f4;
    alternate-background-color: #2a2a2a;
}
QHeaderView::section {
    background-color: #2d2d2d;
    color: #c0c0c0;
    border: 1px solid #3f3f46;
    padding: 3px 6px;
}
QTableView::item:selected, QListView::item:selected, QTreeView::item:selected {
    background-color: #4284f4;
    color: #ffffff;
}

/* ── Tooltip ── */
QToolTip {
    background-color: #252526;
    color: #f0f0f0;
    border: 1px solid #3f3f46;
    padding: 4px;
    border-radius: 3px;
}

/* ── Splitter ── */
QSplitter::handle {
    background: #3f3f46;
}

/* ── Progress bar ── */
QProgressBar {
    background-color: #3c3c3c;
    border: 1px solid #3f3f46;
    border-radius: 3px;
    text-align: center;
    color: #f0f0f0;
}
QProgressBar::chunk {
    background-color: #4284f4;
    border-radius: 3px;
}

/* ── DO NOT touch the board canvas or floating palettes ── */
/* UBBoardView and UBGraphicsScene background are controlled by board logic */
)";

void UBThemeManager::applyTheme(const QString& theme)
{
    qApp->setStyle(QStyleFactory::create("Fusion"));

    if (theme == "Dark") {
        qApp->setPalette(darkPalette());
        qApp->setStyleSheet(QString::fromLatin1(DARK_QSS));
    } else {
        qApp->setPalette(lightPalette());
        qApp->setStyleSheet(QString()); // clear any dark overrides
    }
}

QPalette UBThemeManager::darkPalette()
{
    QPalette p;
    p.setColor(QPalette::Window,          QColor(0x1e, 0x1e, 0x1e));
    p.setColor(QPalette::WindowText,      QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Base,            QColor(0x25, 0x25, 0x26));
    p.setColor(QPalette::AlternateBase,   QColor(0x2a, 0x2a, 0x2a));
    p.setColor(QPalette::ToolTipBase,     QColor(0x25, 0x25, 0x26));
    p.setColor(QPalette::ToolTipText,     QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Text,            QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::Button,          QColor(0x3a, 0x3a, 0x3a));
    p.setColor(QPalette::ButtonText,      QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::BrightText,      Qt::red);
    p.setColor(QPalette::Link,            QColor(0x42, 0xa5, 0xf5));
    p.setColor(QPalette::Highlight,       QColor(0x42, 0x84, 0xf4));
    p.setColor(QPalette::HighlightedText, Qt::white);
    p.setColor(QPalette::Disabled, QPalette::ButtonText, QColor(0x6a, 0x6a, 0x6a));
    p.setColor(QPalette::Disabled, QPalette::WindowText, QColor(0x6a, 0x6a, 0x6a));
    p.setColor(QPalette::Disabled, QPalette::Text,       QColor(0x6a, 0x6a, 0x6a));
    return p;
}

QPalette UBThemeManager::lightPalette()
{
    // Standard Fusion light palette — don't call QApplication::style() here
    // because style() may return null during early startup
    QPalette p;
    p.setColor(QPalette::Window,          QColor(0xf0, 0xf0, 0xf0));
    p.setColor(QPalette::WindowText,      Qt::black);
    p.setColor(QPalette::Base,            Qt::white);
    p.setColor(QPalette::AlternateBase,   QColor(0xf7, 0xf7, 0xf7));
    p.setColor(QPalette::ToolTipBase,     Qt::white);
    p.setColor(QPalette::ToolTipText,     Qt::black);
    p.setColor(QPalette::Text,            Qt::black);
    p.setColor(QPalette::Button,          QColor(0xe0, 0xe0, 0xe0));
    p.setColor(QPalette::ButtonText,      Qt::black);
    p.setColor(QPalette::BrightText,      Qt::red);
    p.setColor(QPalette::Link,            QColor(0x00, 0x78, 0xd4));
    p.setColor(QPalette::Highlight,       QColor(0x00, 0x78, 0xd4));
    p.setColor(QPalette::HighlightedText, Qt::white);
    return p;
}
