<p align="center">
  <img src="resources/images/ContraryWhiteboard.png" alt="Contrary Whiteboard" width="140" />
</p>

<h1 align="center">Contrary Whiteboard</h1>

<p align="center">
  <a href="https://github.com/AroseEditor/Contrary-Whiteboard/releases/latest"><img src="https://img.shields.io/github/v/release/AroseEditor/Contrary-Whiteboard?style=flat-square&color=00b4d8" alt="Latest Release" /></a>
  <a href="https://github.com/AroseEditor/Contrary-Whiteboard/releases"><img src="https://img.shields.io/github/downloads/AroseEditor/Contrary-Whiteboard/total?style=flat-square&color=7209b7" alt="Total Downloads" /></a>
  <a href="https://github.com/AroseEditor/Contrary-Whiteboard/stargazers"><img src="https://img.shields.io/github/stars/AroseEditor/Contrary-Whiteboard?style=flat-square&color=f72585" alt="Stars" /></a>
  <a href="https://github.com/AroseEditor/Contrary-Whiteboard/blob/main/LICENSE"><img src="https://img.shields.io/github/license/AroseEditor/Contrary-Whiteboard?style=flat-square&color=4cc9f0" alt="License" /></a>
</p>

<p align="center">
  <b>A powerful, cross-platform interactive whiteboard for education and presentations.</b><br/>
  Built with C++ &amp; Qt — fast, reliable, and feature-rich.
</p>

<p align="center">
  <sub>Fork of <a href="https://github.com/OpenBoard-org/OpenBoard">OpenBoard</a></sub>
</p>

---

## ✨ Features

### 🖊️ Drawing Tools
- **Pen, Marker, Eraser** — Pressure-sensitive with customizable widths and colors
- **Line Tool** — Straight lines with configurable thickness
- **Highlighter/Marker** — Semi-transparent overlay strokes
- **Selector** — Move, resize, rotate any canvas object

### 📐 Geometry & Math
- Ruler, protractor, compass, triangle/set square, axes
- Rich text editing and mathematical equation input (LaTeX)

### 📄 Document & Media
- Import/export **PDFs** as pages
- Import **images, audio, video** directly onto the board
- **Multi-page documents** with unlimited pages
- Save and load in native **`.cwb`** (Contrary WhiteBoard) format

### 🌐 Live Collaboration — Host Whiteboard
- **One-click hosting** via [ngrok](https://ngrok.com) — generates a public URL instantly
- Guests join from any browser (PC, tablet, iPhone, Android — no install needed)
- **Real-time bidirectional sync**: host canvas → all guests, guest strokes → host canvas
- Both host and guests can **draw, erase, and add text** simultaneously
- **Live cursors** — see everyone's cursor in real time
- Guests can **follow the host view** (double-tap) or pan/zoom independently
- Pinch-to-zoom and touch drawing on mobile/iPad

### ⌨️ Keyboard Shortcuts
- `P` Pen · `E` Eraser · `M` Marker · `S` Selector · `T` Text · `G` Pointer · `J` Line
- `Ctrl+Z` Undo · `Ctrl+Y` Redo
- All shortcuts are **fully customizable** in Preferences → Controls

### 🎨 Themes & Appearance
- **Dark / Light mode** — switch instantly from Preferences
- Theme persists across restarts
- Backgrounds: plain, grid, ruled, white, black, custom color

### 🤖 AI Assistant
- Built-in AI chatbot powered by **Qwen 2.5 0.5B** — fully offline & private
- ~300 MB one-time download · Docked panel on the right side

### 🖥️ Presentation
- **Dual-screen** support — present on external display, control privately
- **Podcast/recording** — record your board sessions
- Laser pointer tool

### 🔧 Other
- **Auto-update** from GitHub Releases
- **35+ languages** — full internationalization
- **Stylus button mapping** — customize barrel/eraser buttons in Preferences → Controls

---

## 📥 Download

| Platform | Download |
|----------|----------|
| **Windows** (64-bit) | [ContraryWhiteboard-Setup.exe](https://github.com/AroseEditor/Contrary-Whiteboard/releases/latest) |
| **macOS** (Universal) | [ContraryWhiteboard.dmg](https://github.com/AroseEditor/Contrary-Whiteboard/releases/latest) |

---

## 🌐 Live Whiteboard Sharing — Quick Start

1. Open Contrary Whiteboard
2. Click **"Host Whiteboard"** in the toolbar
3. Follow the ngrok login prompt (one-time setup — creates a free account)
4. A public URL is copied to your clipboard automatically
5. Share it with anyone — they open it in a browser, no install required
6. Draw on your board → guests see it instantly
7. Guests draw → you see it on your Qt canvas in real time

> **Tip:** Guests can double-tap the canvas to sync their view to yours.

---

## 🛠️ Building from Source

### Prerequisites
- **Qt 6.8+** with modules: `WebEngine · Multimedia · SVG · WebSockets · OpenGL · UiTools`
- **MSVC 2022** (Windows) or **Clang** (macOS)
- **vcpkg** dependencies: Poppler, QuaZip, OpenSSL, zlib

### Windows
```bat
git clone https://github.com/AroseEditor/Contrary-Whiteboard.git
cd Contrary-Whiteboard
build_windows_classic.bat
```

### macOS
```bash
git clone https://github.com/AroseEditor/Contrary-Whiteboard.git
cd Contrary-Whiteboard
./build_macos.sh
```

### Qt Creator
1. Open `ContraryWhiteboard.pro`
2. Configure with your Qt 6.8 kit
3. Build & Run

---

## 🆚 Contrary Whiteboard vs OpenBoard

| Feature | OpenBoard | Contrary Whiteboard |
|---------|:---------:|:-------------------:|
| Native `.cwb` file format | ❌ | ✅ |
| Dark UI theme | ❌ | ✅ |
| Live collaboration (ngrok) | ❌ | ✅ |
| Mobile guest support | ❌ | ✅ |
| Real-time cursor sync | ❌ | ✅ |
| Customizable keyboard shortcuts | ❌ | ✅ |
| Stylus button mapping | ❌ | ✅ |
| AI Assistant (offline) | ❌ | ✅ |
| Auto-update | Manual | ✅ GitHub Releases |
| Equation tool | ❌ | ✅ |

---

## 📜 License

Contrary Whiteboard is licensed under the **GNU General Public License v3.0**.  
See [LICENSE](LICENSE) for full details.

---

## 👤 Author

**AroseEditor** — [@AroseEditor](https://github.com/AroseEditor)

<sub>Contrary Whiteboard is a fork of <a href="https://github.com/OpenBoard-org/OpenBoard">OpenBoard</a>, originally developed by the Open Education Foundation and DIP-SEM.</sub>
