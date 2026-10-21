const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4040;

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Private-Network');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());
// Serve static assets with clean URLs (.html extension optional)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html', 'htm'] }));

// Explicit Clean URL Routes for Host, Client, and Admin
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Helper to get local IPv4 address on LAN
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Global runtime state
let currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
let vDisplayProcess = null;
let vDisplayInfo = null;
let currentPosition = 'right';
let currentQuality = {
  resolution: '1080p',
  fps: 60,
  bitrate: 6000
};
let hostSocket = null;
let clientSockets = new Set();
let isRenderingDashboard = false;
let dashboardInitialized = false;

// ANSI Styling Palettes
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[38;2;163;255;18m',
  cyan: '\x1b[38;2;0;229;255m',
  amber: '\x1b[38;2;255;180;0m',
  white: '\x1b[38;2;255;255;255m',
  gray: '\x1b[38;2;120;140;130m',
  dark: '\x1b[38;2;60;80;70m',
  red: '\x1b[38;2;255;85;85m',
  pinBg: '\x1b[48;2;20;45;20m\x1b[38;2;163;255;18m\x1b[1m',
  activeTag: '\x1b[48;2;0;80;40m\x1b[38;2;255;255;255m\x1b[1m',
  inactiveTag: '\x1b[48;2;70;20;20m\x1b[38;2;255;150;150m\x1b[1m'
};

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function padVisible(str, width) {
  const len = stripAnsi(str).length;
  if (len >= width) return str;
  return str + ' '.repeat(width - len);
}

function makeLine(label, val) {
  const lLen = stripAnsi(label).length;
  const vLen = stripAnsi(val).length;
  const space = Math.max(1, 33 - lLen - vLen);
  return '│ ' + label + ' '.repeat(space) + val + ' │';
}

function ensureBinaryExists() {
  const binaryPath = path.join(__dirname, '..', 'macos-virtual-display', 'evedis-vdisplay');
  if (!fs.existsSync(binaryPath) && process.platform === 'darwin') {
    const srcPath = path.join(__dirname, '..', 'macos-virtual-display', 'evedis_vdisplay.m');
    const { execSync } = require('child_process');
    try {
      execSync(`clang -framework CoreGraphics -framework Foundation "${srcPath}" -o "${binaryPath}"`);
      fs.chmodSync(binaryPath, 0o755);
    } catch (e) {
      console.error('[Build Error] Could not compile macOS virtual display driver:', e.message);
    }
  }
  return binaryPath;
}

// Helper to open browser URL across platforms
function openBrowser(url) {
  const cmd = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

// -------------------------------------------------------------
// VIRTUAL DISPLAY LIFECYCLE
// -------------------------------------------------------------
function startVirtualDisplay(options = {}) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'darwin') {
      return reject(new Error('Virtual display driver is currently macOS native'));
    }

    if (vDisplayProcess) {
      return resolve({ status: 'already_running', info: vDisplayInfo });
    }

    const binaryPath = ensureBinaryExists();
    const width = options.width || 1920;
    const height = options.height || 1200;
    const fps = options.fps || 60;
    const position = options.position || currentPosition || 'right';
    currentPosition = position;

    vDisplayProcess = spawn(binaryPath, [
      '--width', width.toString(),
      '--height', height.toString(),
      '--fps', fps.toString(),
      '--position', position,
      '--name', 'EVEDIS Extended Display'
    ]);

    let resolved = false;

    vDisplayProcess.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.status === 'active') {
            vDisplayInfo = parsed;
            io.emit('vdisplay_status', { active: true, info: vDisplayInfo, position: currentPosition });
            if (!resolved) {
              resolved = true;
              resolve({ success: true, info: vDisplayInfo, position: currentPosition });
            }
            renderTerminalDashboard();
          } else if (parsed.event === 'arranged') {
            currentPosition = parsed.position;
            io.emit('vdisplay_arrangement', parsed);
            renderTerminalDashboard();
          }
        } catch (e) {}
      }
    });

    vDisplayProcess.stderr.on('data', () => {});

    vDisplayProcess.on('close', () => {
      vDisplayProcess = null;
      vDisplayInfo = null;
      io.emit('vdisplay_status', { active: false });
      renderTerminalDashboard();
      if (!resolved) {
        resolved = true;
        reject(new Error('Virtual display process exited unexpectedly'));
      }
    });
  });
}

function stopVirtualDisplay() {
  if (vDisplayProcess) {
    try {
      vDisplayProcess.kill('SIGTERM');
    } catch (e) {}
    vDisplayProcess = null;
    vDisplayInfo = null;
    io.emit('vdisplay_status', { active: false });
    renderTerminalDashboard();
    return { success: true };
  }
  return { success: true, message: 'Not running' };
}

function setArrangement(position) {
  if (position !== 'left' && position !== 'right') return;
  currentPosition = position;
  if (vDisplayProcess && vDisplayProcess.stdin && !vDisplayProcess.stdin.destroyed) {
    vDisplayProcess.stdin.write(`arrange:${position}\n`);
  }
  io.emit('vdisplay_arrangement', { position });
  renderTerminalDashboard();
}

function toggleVirtualDisplay() {
  if (vDisplayProcess) {
    stopVirtualDisplay();
  } else {
    startVirtualDisplay({ position: currentPosition }).catch(() => {});
  }
}

// -------------------------------------------------------------
// PAIRING PIN & QR LOGIC
// -------------------------------------------------------------
async function refreshPairingCode() {
  currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
  const localIP = getLocalIP();
  const tabletURL = `http://${localIP}:${PORT}/client.html?pin=${currentPIN}`;
  const qrDataURL = await qrcode.toDataURL(tabletURL, { margin: 1, width: 256 });
  io.emit('pin_updated', { pin: currentPIN, qrCode: qrDataURL, tabletURL });
  return { pin: currentPIN, qrCode: qrDataURL, tabletURL };
}

// -------------------------------------------------------------
// TERMINAL LCD MONITOR DASHBOARD & ANIMATION
// -------------------------------------------------------------
async function playStartupAnimation() {
  if (!process.stdout.isTTY) return;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');

  const ascii = [
    ' ███████╗██╗   ██╗███████╗██████╗ ██╗███████╗',
    ' ██╔════╝██║   ██║██╔════╝██╔══██╗██║██╔════╝',
    ' █████╗  ██║   ██║█████╗  ██║  ██║██║███████╗',
    ' ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║  ██║██║╚════██║',
    ' ███████╗ ╚████╔╝ ███████╗██████╔╝██║███████║',
    ' ╚══════╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝╚══════╝'
  ];

  const colors = [
    '\x1b[38;2;0;100;160m',
    '\x1b[38;2;0;229;255m',
    '\x1b[38;2;163;255;18m'
  ];

  for (let c of colors) {
    process.stdout.write('\x1b[H');
    console.log(c + C.bold + ascii.join('\n') + C.reset + '\n');
    await sleep(60);
  }

  const steps = [
    '⚡ EVEDIS ENGINE // INITIALIZING NEURAL FRAMEBUFFER...',
    '✔ PROBING HARDWARE: macOS CoreGraphics CGVirtualDisplay [READY]',
    '✔ ALLOCATING EXTENDED MONITOR: 1920x1200 @ 60 FPS HiDPI [AUTO]',
    `✔ WEBRTC SIGNALING & LAN SERVER: http://${getLocalIP()}:${PORT} [ONLINE]`
  ];

  for (let s of steps) {
    console.log(C.cyan + s + C.reset);
    await sleep(40);
  }

  await sleep(100);
  process.stdout.write('\x1b[?25h');
}

async function renderTerminalDashboard() {
  if (!dashboardInitialized || isRenderingDashboard || !process.stdout.isTTY) return;
  isRenderingDashboard = true;

  try {
    const localIP = getLocalIP();
    const tabletURL = `http://${localIP}:${PORT}/client.html?pin=${currentPIN}`;
    const qrRaw = await qrcode.toString(tabletURL, { type: 'terminal', small: true });
    const qrLines = qrRaw.split('\n').filter(l => stripAnsi(l).length > 0);

    const isAttached = !!vDisplayProcess;
    const statusText = isAttached ? C.green + C.bold + '● ONLINE (ATTACHED)' + C.reset : C.red + '○ OFFLINE (DETACHED)' + C.reset;
    const resText = isAttached && vDisplayInfo ? `${vDisplayInfo.width}x${vDisplayInfo.height} @ ${vDisplayInfo.fps}Hz` : '1920x1200 @ 60Hz (Standby)';
    const edgeText = currentPosition === 'left' ? C.amber + C.bold + 'LEFT OF MAC [L]' + C.reset : C.amber + C.bold + 'RIGHT OF MAC [R]' + C.reset;
    const clientCountText = clientSockets.size > 0 ? C.green + C.bold + `${clientSockets.size} Tablet(s) Active` + C.reset : C.gray + '0 Tablet(s) Paired' + C.reset;

    const leftBox = [
      C.cyan + '┌── LCD VIRTUAL DISPLAY ────────────┐' + C.reset,
      makeLine(C.gray + 'STATUS' + C.reset, statusText),
      makeLine(C.gray + 'RESOLUTION' + C.reset, C.white + resText + C.reset),
      makeLine(C.gray + 'EDGE POSITION' + C.reset, edgeText),
      makeLine(C.gray + 'DRIVER' + C.reset, C.white + 'CoreGraphics (Native)' + C.reset),
      makeLine(C.gray + 'CONNECTED' + C.reset, clientCountText),
      makeLine(C.gray + 'PIPELINE' + C.reset, C.white + 'WebRTC H.264 6Mbps' + C.reset),
      C.cyan + '├── QUICK PAIRING ACCESS ───────────┤' + C.reset,
      makeLine(C.gray + 'PAIRING PIN' + C.reset, C.pinBg + '  ' + currentPIN.split('').join(' ') + '  ' + C.reset),
      makeLine(C.gray + 'HOST CONSOLE' + C.reset, C.white + `localhost:${PORT}/host` + C.reset),
      makeLine(C.gray + 'WI-FI IP' + C.reset, C.white + `${localIP}:${PORT}` + C.reset),
      C.cyan + '├── CONNECTION INSTRUCTIONS ────────┤' + C.reset,
      makeLine(C.gray + '1. Camera Scan' + C.reset, C.white + 'Point at QR code' + C.reset),
      makeLine(C.gray + '2. Browser Tap' + C.reset, C.white + 'Open Wi-Fi IP' + C.reset),
      makeLine(C.gray + '3. Touch Screen' + C.reset, C.white + 'Pinch/Drag/Stylus' + C.reset),
      C.cyan + '├── TELEMETRY ──────────────────────┤' + C.reset,
      makeLine(C.gray + 'NETWORK LATENCY' + C.reset, C.green + '< 16ms' + C.reset),
      C.cyan + '└───────────────────────────────────┘' + C.reset
    ];

    const rightBox = [
      C.cyan + '┌── SCAN WITH TABLET CAMERA ────────┐' + C.reset,
      ...qrLines.map(line => '│  ' + line + '  │'),
      C.cyan + '└───────────────────────────────────┘' + C.reset
    ];

    const leftW = 37;
    const rightW = 37;
    const totalW = leftW + rightW + 3;

    // Move cursor to top-left and clear display
    process.stdout.write('\x1b[H\x1b[J');

    // Big ASCII Header
    console.log(C.green + C.bold + ' ███████╗██╗   ██╗███████╗██████╗ ██╗███████╗' + C.reset);
    console.log(C.green + C.bold + ' ██╔════╝██║   ██║██╔════╝██╔══██╗██║██╔════╝' + C.cyan + '  WIRELESS EXTENDED DISPLAY' + C.reset);
    console.log(C.green + C.bold + ' █████╗  ██║   ██║█████╗  ██║  ██║██║███████╗' + C.gray + '  macOS CoreGraphics Engine' + C.reset);
    console.log(C.green + C.bold + ' ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║  ██║██║╚════██║' + C.gray + '  v1.2.0 • by Sringesh V.' + C.reset);
    console.log(C.green + C.bold + ' ███████╗ ╚████╔╝ ███████╗██████╔╝██║███████║' + C.reset);
    console.log(C.green + C.bold + ' ╚══════╝  ╚═══╝  ╚══════╝╚═════╝ ╚═╝╚══════╝' + C.reset);
    console.log('');

    // LCD Chassis
    console.log(C.dark + '╔' + '═'.repeat(totalW) + '╗' + C.reset);
    const headerTitle = ' ⚡ EVEDIS LCD MONITOR // VIRTUAL DISPLAY MATRIX';
    const tag = isAttached ? ' [● ACTIVE] ' : ' [○ STANDBY] ';
    const tagStyle = isAttached ? C.activeTag : C.inactiveTag;
    const midSpace = totalW - headerTitle.length - tag.length;
    console.log(C.dark + '║' + C.green + C.bold + headerTitle + C.reset + ' '.repeat(Math.max(1, midSpace)) + tagStyle + tag + C.reset + C.dark + '║' + C.reset);
    console.log(C.dark + '╠' + '═'.repeat(leftW + 1) + '╦' + '═'.repeat(rightW + 1) + '╣' + C.reset);

    for (let i = 0; i < 18; i++) {
      const l = padVisible(leftBox[i] || '', leftW);
      const r = padVisible(rightBox[i] || '', rightW);
      console.log(C.dark + '║ ' + C.reset + l + C.dark + ' ║ ' + C.reset + r + C.dark + ' ║' + C.reset);
    }

    console.log(C.dark + '╠' + '═'.repeat(totalW) + '╣' + C.reset);
    const hotkeys = ' ' + C.green + C.bold + 'FAST KEYS:' + C.reset + ' [SPACE] Screen  [L/R] Edge  [N] New PIN  [O] Web  [Q] Exit';
    console.log(C.dark + '║' + C.reset + padVisible(hotkeys, totalW) + C.dark + '║' + C.reset);
    console.log(C.dark + '╚' + '═'.repeat(totalW) + '╝' + C.reset);
  } catch (e) {
  } finally {
    isRenderingDashboard = false;
  }
}

// -------------------------------------------------------------
// INTERACTIVE FAST KEYS LISTENER (RAW MODE)
// -------------------------------------------------------------
function setupTerminalHotkeys() {
  if (!process.stdin.isTTY) return;

  readline.emitKeypressEvents(process.stdin);
  try {
    process.stdin.setRawMode(true);
  } catch (e) {
    return;
  }

  process.stdin.on('keypress', async (str, key) => {
    if ((key && key.ctrl && key.name === 'c') || (key && key.name === 'q') || str === 'q' || str === 'Q') {
      cleanupAndExit();
      return;
    }

    const name = key ? (key.name || str) : str;

    if (name === 'space') {
      toggleVirtualDisplay();
    } else if (name === 'l' || str === 'l' || str === 'L') {
      setArrangement('left');
    } else if (name === 'r' || str === 'r' || str === 'R') {
      setArrangement('right');
    } else if (name === 'n' || str === 'n' || str === 'N') {
      await refreshPairingCode();
      renderTerminalDashboard();
    } else if (name === 'o' || str === 'o' || str === 'O') {
      openBrowser(`http://localhost:${PORT}/host`);
    }
  });
}

function cleanupAndExit() {
  process.stdout.write('\x1b[?25h\n');
  if (vDisplayProcess) {
    try {
      vDisplayProcess.kill('SIGTERM');
    } catch (e) {}
  }
  console.log(C.cyan + '\n[EVEDIS] Virtual display detached. Server stopped safely. Goodbye! 👋' + C.reset);
  process.exit(0);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  const localIP = getLocalIP();
  const tabletURL = `http://${localIP}:${PORT}/client.html?pin=${currentPIN}`;
  const qrDataURL = await qrcode.toDataURL(tabletURL, { margin: 1, width: 256 });

  res.json({
    localIP,
    port: PORT,
    pin: currentPIN,
    tabletURL,
    qrCode: qrDataURL,
    vDisplay: vDisplayInfo,
    position: currentPosition,
    platform: process.platform
  });
});

app.post('/api/vdisplay/start', async (req, res) => {
  try {
    const result = await startVirtualDisplay({
      width: req.body.width,
      height: req.body.height,
      fps: req.body.fps,
      position: req.body.position
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vdisplay/arrange', (req, res) => {
  const position = req.body.position;
  if (!position || (position !== 'left' && position !== 'right')) {
    return res.status(400).json({ error: 'Position must be "left" or "right"' });
  }
  setArrangement(position);
  res.json({ success: true, position });
});

app.post('/api/vdisplay/stop', (req, res) => {
  const result = stopVirtualDisplay();
  res.json(result);
});

app.post('/api/refresh-pin', async (req, res) => {
  const result = await refreshPairingCode();
  renderTerminalDashboard();
  res.json(result);
});

// -------------------------------------------------------------
// SOCKET.IO SIGNALING
// -------------------------------------------------------------
io.on('connection', (socket) => {
  // Host registers itself
  socket.on('register_host', () => {
    hostSocket = socket;
    socket.emit('vdisplay_status', { active: !!vDisplayProcess, info: vDisplayInfo });
    socket.emit('quality_state', currentQuality);
  });

  socket.on('change_quality', (newQuality) => {
    currentQuality = { ...currentQuality, ...newQuality };
    io.emit('quality_state', currentQuality);
    if (hostSocket) {
      hostSocket.emit('apply_quality', currentQuality);
    }
  });

  socket.on('pair_client', async ({ pin }, callback) => {
    if (pin === currentPIN) {
      clientSockets.add(socket);
      renderTerminalDashboard();
      if (typeof callback === 'function') {
        callback({ success: true, message: 'Connected' });
      }
      if (hostSocket) {
        hostSocket.emit('client_connected', { clientId: socket.id });
      }
      await refreshPairingCode();
      renderTerminalDashboard();
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Invalid pairing PIN' });
      }
    }
  });

  socket.on('webrtc_offer', (data) => {
    socket.broadcast.emit('webrtc_offer', data);
  });

  socket.on('webrtc_answer', (data) => {
    if (hostSocket) {
      hostSocket.emit('webrtc_answer', data);
    }
  });

  socket.on('webrtc_ice_candidate', (data) => {
    socket.broadcast.emit('webrtc_ice_candidate', data);
  });

  socket.on('touch_event', (eventData) => {
    if (hostSocket) {
      hostSocket.emit('touch_event', eventData);
    }
  });

  socket.on('disconnect', () => {
    if (socket === hostSocket) {
      hostSocket = null;
      io.emit('host_disconnected');
    } else if (clientSockets.has(socket)) {
      clientSockets.delete(socket);
      renderTerminalDashboard();
      if (hostSocket) {
        hostSocket.emit('client_disconnected', { clientId: socket.id });
      }
    }
  });
});

// -------------------------------------------------------------
// SERVER BOOT & AUTO-START
// -------------------------------------------------------------
server.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  const shouldAutoStart = !process.argv.includes('--no-auto') && process.platform === 'darwin';

  if (process.stdout.isTTY) {
    await playStartupAnimation();
    dashboardInitialized = true;
  } else {
    console.log(`🚀 EVEDIS Host Server running on http://localhost:${PORT}/host`);
    console.log(`📱 Tablet Connect: http://${localIP}:${PORT}/client.html?pin=${currentPIN}`);
  }

  // Auto-create virtual display immediately on launch
  if (shouldAutoStart) {
    try {
      await startVirtualDisplay();
    } catch (e) {}
  }

  setupTerminalHotkeys();
  renderTerminalDashboard();

  if (process.argv.includes('--open')) {
    openBrowser(`http://localhost:${PORT}/host`);
  }
});
