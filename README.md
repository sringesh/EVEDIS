# EVEDIS 📺
> **Open-Source Wireless Extended Secondary Display System for Mac, PC & Android Tablets**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: macOS & Windows](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue.svg)](https://github.com/SR1GESH/evedis)
[![Protocol: WebRTC 60 FPS](https://img.shields.io/badge/Protocol-WebRTC%2060%20FPS-brightgreen.svg)](https://github.com/SR1GESH/evedis)
[![Auth: Firebase Google SSO](https://img.shields.io/badge/Auth-Firebase%20SSO-orange.svg)](https://evedis.web.app)

**EVEDIS** transforms any Android tablet (or any web device) into an ultra-low latency, hardware-accelerated **wireless secondary monitor** for your laptop or desktop.

Unlike basic screen mirroring, EVEDIS creates a **genuine independent secondary desktop space** recognized by your operating system, complete with seamless mouse cursor traversal between screens.

---

## ⚡ Quick Start (Run Locally in 1 Command)

Running EVEDIS locally gives you **full native OS hardware display privileges** with zero browser sandbox restrictions!

### 🍎 macOS (1-Line Terminal Install)
Open Terminal and run:
```bash
curl -fsSL https://raw.githubusercontent.com/SR1GESH/evedis/main/install.sh | bash
```

**Or Clone & Run Manually:**
```bash
git clone https://github.com/SR1GESH/evedis.git
cd evedis
./start.sh
```
> **Tip for Mac Users:** You can also just double-click **`start.command`** in Finder to launch EVEDIS instantly!

---

### 🪟 Windows (1-Line Quick Start)
1. Ensure [Node.js](https://nodejs.org) is installed.
2. Open Command Prompt or PowerShell:
```cmd
git clone https://github.com/SR1GESH/evedis.git
cd evedis
start.bat
```
*(Or double-click `start.bat` in Windows Explorer).*

---

## 📱 Connecting Your Tablet (2 Steps)

1. Open your browser on the host computer at `http://localhost:4040/host`.
2. On your tablet (connected to the same Wi-Fi):
   * Scan the dynamic **QR code** on the host screen, or
   * Navigate to `http://<YOUR_LAPTOP_IP>:4040/client` and enter the 6-digit PIN.
3. Tap the screen to enter **Immersive Fullscreen**. You now have a wireless second monitor!

---

## ✨ Core Features

* **Genuine Extended Desktop Space (Not Just Mirroring)**:
  Uses Apple's private SPI (`CGVirtualDisplay`) on macOS to create a true 1920×1200 @ 60fps monitor with HiDPI Retina support in *System Settings > Displays*.
* **Dynamic Display Arrangement (⬅️ Left vs ➡️ Right)**:
  Instantly toggle whether your tablet sits on the left or right edge of your main screen with 1 click. Move your mouse past the chosen edge to enter the tablet smoothly!
* **Sub-50ms Low-Latency WebRTC Pipeline**:
  Zero jitter buffer (`playoutDelayHint = 0`), hardware-accelerated H.264 video encoding, and motion content hints for fluid 60 FPS cursor tracking.
* **"Laptop Match" Subpixel Text Scaling**:
  Auto-adjusts window text and UI elements on 10.1-inch tablets so reading feels as natural and comfortable as a physical 14-inch laptop screen.
* **Dual-Mode Architecture**:
  * **Localhost Mode**: 100% native OS integration, hardware virtual displays, low-latency LAN streaming.
  * **Cloud Mode (`https://evedis.web.app`)**: Instant in-browser window & screen sharing with Google SSO authentication and Cloud Firestore signaling.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EVEDIS ARCHITECTURE                             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   HOST LAPTOP (Mac / PC)                  RECEIVER (Android Tablet)    │
│  ┌───────────────────────┐               ┌──────────────────────────┐  │
│  │ EVEDIS Local Daemon   │               │ EVEDIS Web / Kiosk Client│  │
│  │ (Node.js + Express)   │               │ (Full Screen Video Stage)│  │
│  └──────────┬────────────┘               └─────────────▲────────────┘  │
│             │                                          │               │
│             ├─────── 1. Spawns Virtual Display         │               │
│             ▼        (macos-virtual-display)           │               │
│  ┌───────────────────────┐                             │               │
│  │ OS Virtual Desktop    │                             │               │
│  │ (1920x1200 @ 60fps)   │                             │               │
│  └──────────┬────────────┘                             │               │
│             │                                          │               │
│             ├─────── 2. WebRTC Peer-to-Peer Stream ────┤               │
│             ▼        (H.264 Hardware 60fps Pipeline)   │               │
│  ┌───────────────────────┐                             │               │
│  │ Screen Capture Engine │─────────────────────────────┘               │
│  └───────────────────────┘                                             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ☁️ Cloud Hosting & Firebase Deployment

EVEDIS is fully configured for cloud hosting with Google Authentication and Cloud Firestore rules:

```bash
# 1. Login to Firebase CLI
npx firebase-tools login

# 2. Select project
npx firebase-tools use evedis

# 3. Deploy
npm run deploy:firebase
```

Live cloud portal: **[https://evedis.web.app](https://evedis.web.app)**

---

## 📁 Repository Structure

```
evedis/
├── start.sh                     # 1-Click launcher for macOS & Linux
├── start.command                # Double-clickable macOS Desktop launcher
├── start.bat                    # 1-Click launcher for Windows
├── install.sh                   # 1-Line curl installer from GitHub
├── package.json                 # Project root package configuration
├── firebase.json                # Firebase Hosting & Firestore deployment spec
├── firestore.rules              # Cloud Firestore security rules
├── macos-virtual-display/       # Native macOS CoreGraphics display driver
│   ├── evedis_vdisplay.m        # Virtual display source & cursor arrangement
│   └── evedis-vdisplay          # Compiled native Mach-O binary
├── server/
│   ├── index.js                 # Local Express & WebRTC signaling server
│   ├── package.json
│   └── public/                  # Retro LCD Web UI & Client Receiver
│       ├── index.html           # Landing portal & Google SSO
│       ├── host.html            # Host controller & arrangement switcher
│       ├── client.html          # Tablet receiver & Laptop-Match scaler
│       ├── admin.html           # Admin audit console
│       ├── css/                 # Cyberpunk retro LCD styling
│       └── js/                  # WebRTC, Firestore, & QRCode logic
└── android/                     # Standalone Android Studio Kiosk App
```

---

## 👨‍💻 About the Creator

**Hey, I'm Sringesh — an engineering student, tech enthusiast, and builder of ideas.**

I enjoy exploring the world of technology, experimenting with new concepts, and turning simple ideas into meaningful digital experiences.

**EVEDIS** was created from my interest in making technology more seamless and accessible, with a focus on simplifying the wireless display experience. I believe the best innovations don't always have to be complicated — sometimes, a simple idea can make a real difference.

For me, building EVEDIS is more than just creating a website. It's about learning, experimenting, solving problems, and bringing an idea to life.

*Curious by nature. Driven by ideas. Always building what's next.*

— **Sringesh V.**

* 𝕏 Profile: [@SR1GESH](https://x.com/SR1GESH)
* 📬 Connect: [reachsringesh@gmail.com](mailto:reachsringesh@gmail.com)

---

## 📄 License

This project is open-source and released under the [MIT License](LICENSE).  
Feel free to use, modify, and distribute it for personal and commercial projects!
