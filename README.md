<div align="center">

```text
███████╗██╗   ██╗███████╗██████╗ ██╗███████╗
██╔════╝██║   ██║██╔════╝██╔══██╗██║██╔════╝
█████╗  ██║   ██║█████╗  ██║  ██║██║███████╗
██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║  ██║██║╚════██║
███████╗ ╚████╔╝ ███████╗██████╔╝██║███████║
╚══════╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝╚══════╝
```

### `>>> WIRELESS SECONDARY DISPLAY SYSTEM // RETRO LCD EDITION <<<`

[![Platform: macOS & Windows](https://img.shields.io/badge/PLATFORM-macOS%20%7C%20WINDOWS-080c09?style=for-the-badge&logo=apple&logoColor=a3ff12&labelColor=0e1410&color=a3ff12)](https://github.com/sringesh/EVEDIS)
[![Protocol: WebRTC 60 FPS](https://img.shields.io/badge/PROTOCOL-WEBRTC%2060%20FPS-080c09?style=for-the-badge&logoColor=a3ff12&labelColor=0e1410&color=a3ff12)](https://github.com/sringesh/EVEDIS)
[![Latency: Sub-50ms](https://img.shields.io/badge/LATENCY-%3C%2050MS-080c09?style=for-the-badge&labelColor=0e1410&color=3fb950)](https://evedis.web.app)
[![Auth: Google SSO](https://img.shields.io/badge/AUTH-GOOGLE%20SSO-080c09?style=for-the-badge&logo=google&logoColor=58a6ff&labelColor=0e1410&color=58a6ff)](https://evedis.web.app)
[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-080c09?style=for-the-badge&labelColor=0e1410&color=ffb800)](LICENSE)

**Turn any Android tablet, iPad, phone, or browser into an ultra-low latency, hardware-accelerated wireless second monitor for Mac & Windows.**

[🌐 Live Cloud Portal](https://evedis.web.app) • [🍎 macOS Guide](#-macos-setup--usage) • [🪟 Windows Guide](#-windows-setup--usage) • [📱 Tablet Client](#-tablet--client-usage) • [⌨️ Shortcuts](#️-interactive-keys--fast-shortcuts)

---

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [SYS_TELEMETRY] STATUS: ONLINE  •  PIPELINE: H.264 60FPS  •  P2P: LIVE  │
└────────────────────────────────────────────────────────────────────────┘
```

</div>

Unlike basic screen mirroring, **EVEDIS** creates a **genuine independent secondary desktop space** recognized by your operating system. Drag windows, code editors, and media players onto your tablet screen with smooth, seamless mouse traversal across display edges.

---

## ⚡ 1-Line Fast Installers (Zero Setup)

If you are setting up EVEDIS on a computer for the first time, open your terminal and paste the command for your OS:

### 🍎 macOS Instant Installer
```bash
curl -fsSL https://raw.githubusercontent.com/sringesh/EVEDIS/main/install.sh | bash
```
*(Or via web mirror: `curl -fsSL https://evedis.web.app/install.sh | bash`)*

> **What it does automatically:**
> 1. Clones EVEDIS into `~/evedis`.
> 2. Builds the native macOS CoreGraphics Virtual Display Driver (`CGVirtualDisplay`).
> 3. Installs global CLI commands (`evedis`, `ed`, `td`) into your shell PATH.
> 4. Starts the local host server and opens the web console in Chrome.

---

### 🪟 Windows Instant Installer (PowerShell)
Open **PowerShell** (Run as Administrator recommended) and paste:
```powershell
irm https://raw.githubusercontent.com/sringesh/EVEDIS/main/install.ps1 | iex
```
*(Or via web mirror: `irm https://evedis.web.app/install.ps1 | iex`)*

> **What it does automatically:**
> 1. Verifies/installs Node.js & Git automatically via `winget`.
> 2. Clones EVEDIS into `%USERPROFILE%\evedis`.
> 3. Installs all required project dependencies.
> 4. Creates a 1-click **EVEDIS** shortcut on your Desktop and opens the Host Console.

---

## 🍎 macOS Setup & Usage

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          macOS CONTROL FLOW                            │
├────────────────────────────────────────────────────────────────────────┤
│  1. Run 'evedis open' in Terminal                                      │
│  2. In Host Console (http://localhost:4040/host):                      │
│     • Step 1: Click "Create Virtual Display" (spawns Screen 2)         │
│     • Step 2: Click "Select Screen to Share" -> choose "Screen 2"      │
│  3. Tablet scans QR code or enters 6-digit PIN -> Stream goes LIVE!     │
└────────────────────────────────────────────────────────────────────────┘
```

### Daily Terminal Commands
Once installed, run these from **any folder in Terminal**:

| Command | Action | Description |
|---|---|---|
| `evedis open` | 🚀 **Launch EVEDIS** | Starts host server and opens `http://localhost:4040/host` |
| `evedis clean` | 🧹 **Gather Windows & Exit** | Safely terminates virtual display and brings all windows back to Screen 1 |
| `evedis ed` *(or `ed`)* | 🖥️ **Create Display** | Instantly activates native Screen 2 |
| `evedis td` *(or `td`)* | 🛑 **Terminate Display** | Turns off Screen 2 and gathers windows home |
| `evedis status` | 📊 **System Status** | Displays server health, connected clients, and display ID |
| `evedis kill` | ⚡ **Force Stop** | Kills background daemon and display drivers |

---

## 🪟 Windows Setup & Usage

Windows users can use EVEDIS in two flexible modes:

### Mode 1: Zero-Setup In-Browser Window & Desktop Streamer (No drivers needed)
1. Run EVEDIS by double-clicking the **EVEDIS** desktop shortcut or launching `start.bat`:
   ```cmd
   cd %USERPROFILE%\evedis
   start.bat
   ```
2. Open `http://localhost:4040/host` in Chrome or Edge.
3. In **Step 2 (Screen Streamer)**, click **"📡 Select Screen to Share"**.
4. Choose any application window (e.g. VS Code, Chrome, Spotify) or your desktop monitor to broadcast to your tablet.
5. On your tablet, open the connect URL or scan the QR code to view the stream with hardware acceleration!

---

### Mode 2: True OS-Level Extended Virtual Monitor on Windows
To have Windows recognize a physical secondary display in *Settings > System > Display*:

1. **Install a Virtual Display Driver**:
   * We recommend the open-source **[IddSampleDriver](https://github.com/ge9/IddSampleDriver/releases)** or **[Amyuni USB Mobile Monitor Driver](https://www.amyuni.com/forum/viewtopic.php?t=3030)**.
2. In Windows **Display Settings**, you will now see **Display 2**.
3. Set Display 2 to **"Extend desktop to this display"** and select **1920×1080** or **1920×1200**.
4. In the EVEDIS Host Console, click **"Select Screen to Share"** and select **Display 2**.
5. Your tablet is now a 100% genuine Windows second desktop!

---

## 📱 Tablet / Client Usage

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TABLET CONNECTION MODES                         │
├────────────────────────────────────────────────────────────────────────┤
│  Option A: Scan the dynamic QR code displayed on the host dashboard    │
│  Option B: Browse to http://<HOST_IP>:4040/client.html?pin=XXXXXX      │
│  Option C: Cloud Mode at https://evedis.web.app/client.html            │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Connect to the Same Wi-Fi**: Ensure your tablet and host computer are on the same local network.
2. **Scan or Enter PIN**: Scan the QR code with your tablet camera or enter the 6-digit PIN.
3. **Tap for Fullscreen**: Tap anywhere on the screen to enter **Immersive Fullscreen Kiosk Mode**.
4. **Touch Controls & HUD**:
   * **Single Tap**: Toggles floating HUD controls.
   * **Pinch-to-Zoom**: Dynamically scale the view.
   * **Two-Finger Drag**: Pan across zoomed screen areas.
   * **"Laptop Match"**: Auto-adjusts UI scale so reading on a 10.1" tablet feels like a 14" laptop.
   * **Wi-Fi Quality Drawer**: Switch dynamically between **1080p @ 60 FPS**, **720p @ 60 FPS**, or **Balanced 30 FPS**.

### 🛑 Zero Frozen Frame Guarantee
When the host computer terminates the external display (via web console button, `evedis clean`, keyboard shortcut, or closing the browser), the tablet receiver immediately stops the video stream, purges the media buffer (no stuck frozen frame!), and returns to the pairing screen with a clear alert banner prompting for a new connection.

---

## ⌨️ Interactive Keys & Fast Shortcuts

### Terminal Interactive Keys (While EVEDIS is running in Terminal)
```text
┌───────┬──────────────────────────────────────────────────────────────┐
│  KEY  │ ACTION                                                       │
├───────┼──────────────────────────────────────────────────────────────┤
│  <E>  │ Toggle Virtual Display ON / OFF                              │
│  <T>  │ Terminate Display & safely gather windows home to Screen 1   │
│  <D>  │ Terminate Display & safely gather windows home to Screen 1   │
│  <O>  │ Open Web Host Console in Google Chrome                       │
│  <N>  │ Rotate & refresh 6-digit pairing PIN                         │
│  <L>  │ Set cursor arrangement edge to LEFT of laptop                │
│  <R>  │ Set cursor arrangement edge to RIGHT of laptop               │
│  <Q>  │ Clean detach, gather windows, and exit                       │
└───────┴──────────────────────────────────────────────────────────────┘
```

### Browser Console Hotkeys (Mac & Windows)
* **`⌘ + Shift + E`** / **`Ctrl + Shift + E`**: Create Extended Display.
* **`⌘ + Shift + T`** / **`Ctrl + Shift + T`**: Terminate Display & Gather Windows.
* **`⌘ + Shift + D`** / **`Ctrl + Shift + D`**: Emergency Detach & Return Windows.
* **Auto-Termination on Browser Exit**: Closing the host browser tab automatically tears down the virtual display within 2.5 seconds and gathers all off-screen windows back onto Screen 1!

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        EVEDIS DUAL-ENGINE STACK                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   HOST MACHINE (Mac / Windows)            CLIENT (Tablet / Phone / PC) │
│  ┌────────────────────────┐              ┌──────────────────────────┐  │
│  │ EVEDIS Core Daemon     │              │ EVEDIS Web Receiver      │  │
│  │ (Node.js + Express)    │              │ (HTML5 Canvas + Video)   │  │
│  └───────────┬────────────┘              └────────────▲─────────────┘  │
│              │                                        │                │
│              ├─────── 1. Spawns Virtual Monitor       │                │
│              ▼        (CoreGraphics SPI / Idd)        │                │
│  ┌────────────────────────┐                           │                │
│  │ OS Secondary Desktop   │                           │                │
│  │ (1920x1200 @ 60 FPS)   │                           │                │
│  └───────────┬────────────┘                           │                │
│              │                                        │                │
│              ├─────── 2. Low-Latency WebRTC P2P ──────┤                │
│              ▼        (H.264 Zero-Buffer Pipeline)    │                │
│  ┌────────────────────────┐                           │                │
│  │ Screen Capture Stream  │───────────────────────────┘                │
│  └────────────────────────┘                                            │
│                                                                        │
│  ──────────────────────── SIGNALS & TELEMETRY ──────────────────────── │
│  • Local Wi-Fi: Direct LAN WebSockets via Socket.io (Port 4040)        │
│  • Cloud Mode: Global WebRTC Signaling via Cloud Firestore             │
│  • Security: Role-based Firestore Security Rules & Google OAuth 2.0    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🌐 Cloud Deployment (Firebase Hosting)

EVEDIS includes production Firebase Hosting and Cloud Firestore configurations:

```bash
# 1. Log in to Firebase CLI
npx firebase-tools login

# 2. Select project
npx firebase-tools use evedis

# 3. Deploy hosting & rules
npm run deploy:firebase
```

Official Cloud Web Portal: **[https://evedis.web.app](https://evedis.web.app)**

---

## 📁 Repository Structure

```text
evedis/
├── install.sh                  # macOS/Linux 1-line curl installer
├── install.ps1                 # Windows 1-line PowerShell installer
├── start.sh                    # Shell script launcher
├── start.command               # Double-clickable macOS desktop shortcut
├── start.bat                   # 1-Click launcher for Windows
├── evedis                      # Unified global CLI command wrapper
├── bin/evedis.js               # CLI subcommand dispatcher
├── firebase.json               # Firebase Hosting configuration
├── firestore.rules             # Cloud Firestore declarative security rules
├── macos-virtual-display/      # Native macOS CoreGraphics SPI display driver
│   ├── evedis_vdisplay.m       # Objective-C display driver source
│   └── evedis-vdisplay         # Compiled Mach-O binary
├── server/
│   ├── index.js                # Express, Socket.io & WebRTC signaling server
│   └── public/                 # Cyberpunk Retro LCD Web Application
│       ├── index.html          # Landing portal & Google SSO
│       ├── host.html           # Host controller & arrangement switcher
│       ├── client.html         # Tablet receiver & Laptop-Match scaler
│       ├── admin.html          # Admin telemetry console
│       ├── css/                # Retro green phosphor LCD styling
│       └── js/                 # WebRTC, ICE buffering, and touch gestures
└── android/                    # Native Android Kiosk Application
```

---

## ❓ Troubleshooting & FAQ

<details>
<summary><b>Q: My windows are stuck off-screen after disconnecting!</b></summary>
<br>
Run <code>evedis clean</code> or press <b>&lt;T&gt;</b> in your terminal. EVEDIS will query macOS/Windows WindowServer and automatically gather all open windows back onto your primary monitor.
</details>

<details>
<summary><b>Q: What if port 4040 is already in use?</b></summary>
<br>
Run <code>evedis kill</code> to terminate any zombie instances, or specify a custom port: <code>PORT=5050 evedis open</code>.
</details>

<details>
<summary><b>Q: How do I change which side my mouse exits the screen?</b></summary>
<br>
In the Host Console, click <b>"⬅️ Left Display"</b> or <b>"➡️ Right Display"</b> under Cursor Transition Edge. You can also press <b>&lt;L&gt;</b> or <b>&lt;R&gt;</b> in the interactive terminal dashboard at any time.
</details>

<details>
<summary><b>Q: Can I stream over mobile hotspot?</b></summary>
<br>
Yes! Both devices just need to be on the same local hotspot network, or you can use Cloud Mode via <a href="https://evedis.web.app">https://evedis.web.app</a>.
</details>

---

## 👨‍💻 About the Creator

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CREATOR PROFILE                               │
├────────────────────────────────────────────────────────────────────────┤
│  Builder:   Sringesh V.                                                │
│  Location:  India                                                      │
│  Mission:   Curious by nature. Driven by ideas. Building what's next.  │
│  Connect:   reachsringesh@gmail.com                                    │
│  Twitter/X: @SR1GESH (https://x.com/SR1GESH)                           │
│  GitHub:    https://github.com/sringesh                                │
└────────────────────────────────────────────────────────────────────────┘
```

**Hey, I'm Sringesh — an engineering student, tech enthusiast, and builder of ideas.**

I enjoy exploring the world of technology, experimenting with new concepts, and turning simple ideas into meaningful digital experiences.

**EVEDIS** was created from my interest in making technology more seamless and accessible, with a focus on simplifying the wireless display experience. I believe the best innovations don't always have to be complicated — sometimes, a simple idea can make a real difference.

---

## 📄 License

This project is open-source and released under the **[MIT License](LICENSE)**.  
Free for personal, academic, and commercial use.

```text
EVEDIS // [SYSTEM TERMINATED: NORMAL] // COPYRIGHT (C) 2026 SRINGESH V.
```
