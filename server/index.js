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
const cliArg = (process.argv[2] || '').toLowerCase();

// -------------------------------------------------------------
// FAST CLI SHORTCUTS (help, status, clean, ed, td, pd, stop, kill)
// -------------------------------------------------------------
if (['help', '--help', '-h'].includes(cliArg)) {
  console.log('\n\x1b[1m\x1b[38;2;163;255;18mEVEDIS CLI Commands:\x1b[0m');
  console.log('  \x1b[36mevedis open\x1b[0m       Launch EVEDIS and open the host console in Chrome');
  console.log('  \x1b[36mevedis clean\x1b[0m      Terminate external display & return all windows to Screen 1');
  console.log('  \x1b[36mevedis ed\x1b[0m         Turn ON / create the external display');
  console.log('  \x1b[36mevedis td\x1b[0m         Turn OFF / terminate the external display');
  console.log('  \x1b[36mevedis status\x1b[0m     Check server and display status');
  console.log('  \x1b[36mevedis kill\x1b[0m       Stop server and virtual display completely\n');
  process.exit(0);
}

// "evedis status": Query current server and display status
if (['status', 'info'].includes(cliArg)) {
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/status',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const s = JSON.parse(data);
        console.log('\n\x1b[1m\x1b[32m● EVEDIS Server: ONLINE on port ' + PORT + '\x1b[0m');
        console.log('  Host Console:   http://localhost:' + PORT + '/host');
        console.log('  Tablet Connect: ' + s.tabletURL);
        console.log('  Pairing PIN:    ' + s.pin);
        console.log('  Virtual Display:' + (s.vDisplay && s.vDisplay.status === 'active' ? ' ● ACTIVE (Screen 2)' : ' ○ STANDBY'));
        console.log('  Arrangement:    ' + s.position + '\n');
      } catch (e) {
        console.log(data);
      }
      process.exit(0);
    });
  });

  req.on('error', () => {
    console.log('\n\x1b[33m○ EVEDIS Server is currently STOPPED.\x1b[0m');
    console.log('Run \x1b[1m\x1b[36mevedis open\x1b[0m to launch.\n');
    process.exit(0);
  });

  req.end();
  return;
}

if (['td', 'pd', 'stop', 'terminate', 'off', 'clean'].includes(cliArg)) {
  console.log('\x1b[33m🛑 Terminating EVEDIS Virtual Display and restoring windows...\x1b[0m');
  
  // 1. Notify server if running
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/vdisplay/terminate',
    method: 'POST',
    timeout: 800
  }, () => {});
  req.on('error', () => {});
  req.end();

  // 2. Kill driver process directly if running on macOS
  if (process.platform === 'darwin') {
    const { execSync } = require('child_process');
    try { execSync('pkill -f evedis-vdisplay 2>/dev/null || true'); } catch (e) {}
    try {
      execSync(`
if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  osascript -e 'tell application "Google Chrome" to repeat with w in windows
    try
      set b to bounds of w
      set x1 to item 1 of b
      set y1 to item 2 of b
      set x2 to item 3 of b
      set y2 to item 4 of b
      set wWidth to x2 - x1
      set wHeight to y2 - y1
      if x1 >= 1700 or x1 < 0 then
        set bounds of w to {60, 60, 60 + wWidth, 60 + wHeight}
      end if
    end try
  end repeat' 2>/dev/null || true
fi
`);
    } catch (e) {}
  }

  console.log('\x1b[32m✔ EVEDIS Clean: Virtual display terminated. All windows gathered back to Screen 1.\x1b[0m');
  process.exit(0);
}

if (['kill', 'down'].includes(cliArg)) {
  console.log('\x1b[33m🛑 Shutting down EVEDIS server and virtual displays...\x1b[0m');
  if (process.platform === 'darwin') {
    const { execSync } = require('child_process');
    try { execSync('pkill -f evedis-vdisplay 2>/dev/null || true'); } catch (e) {}
    try { execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true`); } catch (e) {}
  }
  console.log('\x1b[32m✔ EVEDIS fully shut down. All windows restored to Screen 1.\x1b[0m');
  process.exit(0);
}

if (['shortcuts', 'alias', 'aliases'].includes(cliArg)) {
  const scriptPath = path.resolve(__dirname, '..', 'evedis');
  console.log('\x1b[36m⚡ EVEDIS Fast Command Shortcuts for your shell (~/.zshrc):\x1b[0m\n');
  console.log(`alias ed="${scriptPath} ed"      # Create / Turn ON Extended Display`);
  console.log(`alias td="${scriptPath} td"      # Terminate / Turn OFF Extended Display`);
  console.log(`alias pd="${scriptPath} td"      # Terminate / Turn OFF Extended Display`);
  console.log(`alias evedis="${scriptPath}"     # Launch EVEDIS Host Server`);
  console.log('\nTo install them permanently into your shell:');
  console.log(`echo 'alias ed="${scriptPath} ed"' >> ~/.zshrc`);
  console.log(`echo 'alias td="${scriptPath} td"' >> ~/.zshrc`);
  console.log(`echo 'alias pd="${scriptPath} td"' >> ~/.zshrc\n`);
  process.exit(0);
}

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
app.use(express.text({ type: '*/*' }));
// Serve static assets with clean URLs (.html extension optional)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html', 'htm'] }));

// Explicit Clean URL Routes for Host, Client, and Admin
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, 'public', 'client.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Helper to get network interface details with Wi-Fi prioritization
function getNetworkDetails() {
  const interfaces = os.networkInterfaces();
  
  // 1. Prioritize real Wi-Fi adapter (en0 on macOS, wlan0 / wlp on Linux, 'Wi-Fi' on Windows)
  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (lower.includes('wi-fi') || lower.includes('wlan') || lower === 'en0') {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return { ip: iface.address, iface: name, type: 'Wi-Fi Direct (5GHz/LAN)' };
        }
      }
    }
  }

  // 2. Active physical LAN interfaces (skip docker, bridge, utun/vpn, etc.)
  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (lower.includes('docker') || lower.includes('veth') || lower.includes('utun') || lower.includes('bridge') || lower.includes('lo')) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return { ip: iface.address, iface: name, type: 'LAN' };
      }
    }
  }

  // 3. Fallback to any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return { ip: iface.address, iface: name, type: 'LAN' };
      }
    }
  }

  return { ip: '127.0.0.1', iface: 'lo', type: 'Localhost' };
}

function getLocalIP() {
  return getNetworkDetails().ip;
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
  const srcPath = path.join(__dirname, '..', 'macos-virtual-display', 'evedis_vdisplay.m');
  if (process.platform === 'darwin') {
    let needRebuild = !fs.existsSync(binaryPath);
    if (!needRebuild && fs.existsSync(srcPath)) {
      const srcStat = fs.statSync(srcPath);
      const binStat = fs.statSync(binaryPath);
      if (srcStat.mtimeMs > binStat.mtimeMs) {
        needRebuild = true;
      }
    }
    if (needRebuild && fs.existsSync(srcPath)) {
      const { execSync } = require('child_process');
      try {
        execSync(`clang -framework CoreGraphics -framework Foundation "${srcPath}" -o "${binaryPath}"`);
        fs.chmodSync(binaryPath, 0o755);
      } catch (e) {
        console.error('[Build Error] Could not compile macOS virtual display driver:', e.message);
      }
    }
  }
  return binaryPath;
}

// Safely pin Google Chrome host page to Screen 1 so macOS never moves it to the virtual screen
function pinChromeToMainScreen() {
  if (process.platform !== 'darwin') return;
  const script = `
tell application "System Events"
  if exists (process "Google Chrome") then
    tell application "Google Chrome"
      repeat with w in windows
        try
          set b to bounds of w
          set x1 to item 1 of b
          set y1 to item 2 of b
          set x2 to item 3 of b
          set y2 to item 4 of b
          set wWidth to x2 - x1
          set wHeight to y2 - y1
          if x1 < 0 or x1 >= 1700 then
            set newX1 to 60
            set newY1 to 60
            set bounds of w to {newX1, newY1, newX1 + wWidth, newY1 + wHeight}
          end if
        end try
      end repeat
    end tell
  end if
end tell
`;
  exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, () => {});
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
            pinChromeToMainScreen();
            setTimeout(pinChromeToMainScreen, 150);
            setTimeout(pinChromeToMainScreen, 400);
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

function bringWindowsToMainScreen() {
  if (process.platform !== 'darwin') return;
  const script = `
if pgrep -x "Google Chrome" >/dev/null 2>&1; then
  osascript -e 'tell application "Google Chrome" to repeat with w in windows
    try
      set b to bounds of w
      set x1 to item 1 of b
      set y1 to item 2 of b
      set x2 to item 3 of b
      set y2 to item 4 of b
      set wWidth to x2 - x1
      set wHeight to y2 - y1
      if x1 >= 1700 or x1 < 0 then
        set bounds of w to {60, 60, 60 + wWidth, 60 + wHeight}
      end if
    end try
  end repeat' 2>/dev/null || true
fi
if pgrep -x "Brave Browser" >/dev/null 2>&1; then
  osascript -e 'tell application "Brave Browser" to repeat with w in windows
    try
      set b to bounds of w
      set x1 to item 1 of b
      set y1 to item 2 of b
      set x2 to item 3 of b
      set y2 to item 4 of b
      set wWidth to x2 - x1
      set wHeight to y2 - y1
      if x1 >= 1700 or x1 < 0 then
        set bounds of w to {60, 60, 60 + wWidth, 60 + wHeight}
      end if
    end try
  end repeat' 2>/dev/null || true
fi
`;
  exec(script, () => {});
}

function stopVirtualDisplay(options = { bringWindowsHome: true }) {
  let wasRunning = false;
  if (vDisplayProcess) {
    wasRunning = true;
    try {
      vDisplayProcess.kill('SIGTERM');
    } catch (e) {}
    vDisplayProcess = null;
    vDisplayInfo = null;
  } else if (process.platform === 'darwin') {
    try {
      exec('pkill -f evedis-vdisplay 2>/dev/null || true', () => {});
    } catch (e) {}
  }

  io.emit('vdisplay_status', { active: false });
  io.emit('display_terminated', {
    reason: 'host_terminated',
    message: 'The host computer has terminated the external display session. Scan the new QR code or enter the 6-digit PIN on the host to reconnect.'
  });
  renderTerminalDashboard();

  if (options && options.bringWindowsHome) {
    bringWindowsToMainScreen();
    setTimeout(bringWindowsToMainScreen, 200);
    setTimeout(bringWindowsToMainScreen, 600);
  }

  return {
    success: true,
    wasRunning,
    message: wasRunning ? 'Virtual display terminated and windows gathered to Screen 1' : 'Not running'
  };
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
    stopVirtualDisplay({ bringWindowsHome: true });
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
// TERMINAL LCD MONITOR DASHBOARD (CLEAN & SNAPPY)
// -------------------------------------------------------------
function showStartupBanner() {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\x1b[2J\x1b[H');
}

function makeBoxLine(label, val, innerW = 67) {
  const lLen = stripAnsi(label).length;
  const vLen = stripAnsi(val).length;
  const space = Math.max(1, innerW - lLen - vLen);
  return '   │ ' + label + ' '.repeat(space) + val + ' │';
}

async function renderTerminalDashboard() {
  if (!dashboardInitialized || isRenderingDashboard || !process.stdout.isTTY) return;
  isRenderingDashboard = true;

  try {
    const net = getNetworkDetails();
    const localIP = net.ip;
    const isAttached = !!vDisplayProcess;
    const W = 77;
    const innerW = 67;

    const vDispText = isAttached 
      ? C.green + C.bold + `● ACTIVE (${vDisplayInfo ? vDisplayInfo.width + 'x' + vDisplayInfo.height : '1920x1200'} @ ${currentPosition})` + C.reset 
      : C.amber + '○ STANDBY (Press [E] or Web Console)' + C.reset;

    const resText = isAttached && vDisplayInfo 
      ? `${vDisplayInfo.width}x${vDisplayInfo.height} @ ${vDisplayInfo.fps}Hz (Active)` 
      : '1920x1200 @ 60Hz (On Web Activation)';

    const edgeText = currentPosition === 'left' 
      ? C.amber + C.bold + 'LEFT OF PRIMARY [L]' + C.reset 
      : C.amber + C.bold + 'RIGHT OF PRIMARY [R]' + C.reset;

    const clientCountText = clientSockets.size > 0 
      ? C.green + C.bold + `${clientSockets.size} Tablet(s) Active` + C.reset 
      : C.gray + '0 Tablet(s) Paired' + C.reset;

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
    console.log(C.dark + '╔' + '═'.repeat(W) + '╗' + C.reset);
    const headerTitle = ' ⚡ EVEDIS LCD MONITOR // HOST SERVER STARTED';
    const tag = isAttached ? ' [● ACTIVE] ' : ' [○ STANDBY] ';
    const tagStyle = isAttached ? C.activeTag : C.inactiveTag;
    const midSpace = W - headerTitle.length - tag.length;
    console.log(C.dark + '║' + C.green + C.bold + headerTitle + C.reset + ' '.repeat(Math.max(1, midSpace)) + tagStyle + tag + C.reset + C.dark + '║' + C.reset);
    console.log(C.dark + '╠' + '═'.repeat(W) + '╣' + C.reset);

    const lines = [
      '',
      '   ' + C.green + C.bold + '● EVEDIS SERVER STARTED ON LOCALHOST' + C.reset,
      '     ' + C.gray + 'Host controller is active. Create your external display in web console:' + C.reset,
      '',
      '   ' + C.gray + 'HOST WEB CONSOLE:   ' + C.white + C.bold + 'http://localhost:' + PORT + '/host' + C.reset,
      '   ' + C.gray + 'TABLET CONNECT URL: ' + C.cyan + 'http://' + localIP + ':' + PORT + '/client.html?pin=' + currentPIN + C.reset,
      '   ' + C.gray + 'PAIRING PIN:        ' + C.pinBg + '  ' + currentPIN.split('').join(' ') + '  ' + C.reset,
      '',
      '   ' + C.cyan + '┌── DISPLAY & NETWORK STATUS ' + '─'.repeat(innerW - 25) + '┐' + C.reset,
      makeBoxLine(C.gray + 'VIRTUAL DISPLAY:' + C.reset, vDispText),
      makeBoxLine(C.gray + 'RESOLUTION:' + C.reset, C.white + resText + C.reset),
      makeBoxLine(C.gray + 'EDGE POSITION:' + C.reset, edgeText),
      makeBoxLine(C.gray + 'WI-FI INTERFACE:' + C.reset, C.white + net.type + ' (' + localIP + ':' + PORT + ')' + C.reset),
      makeBoxLine(C.gray + 'TABLET CLIENTS:' + C.reset, clientCountText),
      '   ' + C.cyan + '└' + '─'.repeat(innerW + 2) + '┘' + C.reset,
      '',
      '   ' + C.green + '👉 Open http://localhost:' + PORT + '/host in your browser to create display!' + C.reset,
      ''
    ];

    lines.forEach(l => {
      const interior = padVisible(l, W);
      console.log(C.dark + '║' + C.reset + interior + C.dark + '║' + C.reset);
    });

    console.log(C.dark + '╠' + '═'.repeat(W) + '╣' + C.reset);
    const hotkeys = ' FAST KEYS: [E] Create/Toggle  [T] Terminate  [O] Web  [N] PIN  [Q] Exit';
    console.log(C.dark + '║ ' + C.green + C.bold + padVisible(hotkeys, W - 2) + C.dark + ' ║' + C.reset);
    console.log(C.dark + '╚' + '═'.repeat(W) + '╝' + C.reset);
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

    if (name === 'e' || str === 'e' || str === 'E') {
      toggleVirtualDisplay();
    } else if (name === 't' || str === 't' || str === 'T' || name === 'd' || str === 'd' || str === 'D') {
      stopVirtualDisplay({ bringWindowsHome: true });
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
  stopVirtualDisplay({ bringWindowsHome: true });
  console.log(C.cyan + '\n[EVEDIS] Virtual display detached. All windows returned to Screen 1. Server stopped. Goodbye! 👋' + C.reset);
  process.exit(0);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  const net = getNetworkDetails();
  const localIP = net.ip;
  const tabletURL = `http://${localIP}:${PORT}/client.html?pin=${currentPIN}`;
  const qrDataURL = await qrcode.toDataURL(tabletURL, { margin: 1, width: 256 });

  res.json({
    localIP,
    networkType: net.type,
    interfaceName: net.iface,
    port: PORT,
    pin: currentPIN,
    tabletURL,
    qrCode: qrDataURL,
    vDisplay: vDisplayInfo,
    position: currentPosition,
    quality: currentQuality,
    platform: process.platform,
    connectedClients: clientSockets.size
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
  const result = stopVirtualDisplay({ bringWindowsHome: true });
  res.json(result);
});

app.post('/api/vdisplay/terminate', (req, res) => {
  const result = stopVirtualDisplay({ bringWindowsHome: true });
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
let hostDisconnectTimer = null;

io.on('connection', (socket) => {
  // Host registers itself
  socket.on('register_host', () => {
    hostSocket = socket;
    if (hostDisconnectTimer) {
      clearTimeout(hostDisconnectTimer);
      hostDisconnectTimer = null;
    }
    socket.emit('vdisplay_status', { active: !!vDisplayProcess, info: vDisplayInfo });
    socket.emit('quality_state', currentQuality);
    if (clientSockets.size > 0) {
      socket.emit('client_connected', { clientId: Array.from(clientSockets)[0].id, count: clientSockets.size });
    }
  });

  socket.on('host_closing', () => {
    if (socket === hostSocket) {
      hostSocket = null;
      if (vDisplayProcess) {
        stopVirtualDisplay({ bringWindowsHome: true });
      }
    }
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
        hostSocket.emit('client_connected', { clientId: socket.id, count: clientSockets.size });
      }
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
      // If browser closed, give 2.5s grace period for reloads, then auto-terminate display
      if (vDisplayProcess) {
        if (hostDisconnectTimer) clearTimeout(hostDisconnectTimer);
        hostDisconnectTimer = setTimeout(() => {
          if (!hostSocket && vDisplayProcess) {
            stopVirtualDisplay({ bringWindowsHome: true });
          }
        }, 2500);
      }
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
// SERVER BOOT (VIRTUAL DISPLAY IN STANDBY UNTIL ACTIVATED IN WEB CONSOLE)
// -------------------------------------------------------------
function bootServer() {
  server.listen(PORT, '0.0.0.0', async () => {
    const localIP = getLocalIP();

    if (process.stdout.isTTY) {
      dashboardInitialized = true;
      showStartupBanner();
      renderTerminalDashboard();
    } else {
      console.log(`🚀 EVEDIS Host Server running on http://localhost:${PORT}/host`);
      console.log(`📱 Tablet Connect: http://${localIP}:${PORT}/client.html?pin=${currentPIN}`);
    }

    setupTerminalHotkeys();

    if (process.argv.includes('--open')) {
      openBrowser(`http://localhost:${PORT}/host`);
    }

    if (process.argv.includes('--auto-display')) {
      startVirtualDisplay({ position: currentPosition }).catch(() => {});
    }
  });
}

// Check CLI subcommands
if (['open', 'start', 'launch'].includes(cliArg)) {
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/status',
    method: 'GET',
    timeout: 800
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('\x1b[32m✔ EVEDIS server is active!\x1b[0m');
      console.log('\x1b[36m🚀 Opening http://localhost:' + PORT + '/host in Google Chrome...\x1b[0m');
      openBrowser(`http://localhost:${PORT}/host`);
      process.exit(0);
    });
  });

  req.on('error', () => {
    process.argv.push('--open');
    bootServer();
  });

  req.end();
} else if (['ed', 'create', 'on', 'start-display'].includes(cliArg)) {
  const postData = JSON.stringify({ width: 1920, height: 1200, fps: 60, position: 'right' });
  const req = http.request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/vdisplay/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 1200
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('\x1b[32m✔ EVEDIS Virtual Display created and active on Screen 2!\x1b[0m');
      console.log('\x1b[90m(Web controller: http://localhost:' + PORT + '/host)\x1b[0m');
      process.exit(0);
    });
  });

  req.on('error', () => {
    console.log('\x1b[33m⚡ EVEDIS server not running. Starting host server with external display enabled...\x1b[0m');
    process.argv.push('--auto-display');
    bootServer();
  });

  req.write(postData);
  req.end();
} else {
  bootServer();
}
