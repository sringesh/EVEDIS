const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4040;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Private-Network');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Global state
let currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
let vDisplayProcess = null;
let vDisplayInfo = null;
let currentPosition = 'right';
let currentQuality = {
  resolution: '1080p',
  fps: 60,
  bitrate: 6000
};

// Helper to generate a new PIN & QR code
async function refreshPairingCode() {
  currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
  const localIP = getLocalIP();
  const tabletURL = `http://${localIP}:${PORT}/client.html?pin=${currentPIN}`;
  const qrDataURL = await qrcode.toDataURL(tabletURL, { margin: 1, width: 256 });
  io.emit('pin_updated', { pin: currentPIN, qrCode: qrDataURL, tabletURL });
  return { pin: currentPIN, qrCode: qrDataURL, tabletURL };
}

// Route: Get current status and connection info
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

// Route: Start macOS Virtual Display
app.post('/api/vdisplay/start', (req, res) => {
  if (process.platform !== 'darwin') {
    return res.status(400).json({ error: 'Virtual display driver is currently macOS native' });
  }

  if (vDisplayProcess) {
    return res.json({ status: 'already_running', info: vDisplayInfo });
  }

  const binaryPath = path.join(__dirname, '..', 'macos-virtual-display', 'evedis-vdisplay');
  const width = req.body.width || 1920;
  const height = req.body.height || 1200;
  const fps = req.body.fps || 60;
  const position = req.body.position || currentPosition || 'right';
  currentPosition = position;

  console.log(`[VDisplay] Launching EVEDIS virtual display (${width}x${height} @ ${fps}fps, position: ${position})...`);
  vDisplayProcess = spawn(binaryPath, [
    '--width', width.toString(),
    '--height', height.toString(),
    '--fps', fps.toString(),
    '--position', position,
    '--name', 'EVEDIS Extended Display'
  ]);

  let responded = false;

  vDisplayProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.status === 'active') {
          vDisplayInfo = parsed;
          console.log('[VDisplay] Virtual Display is ACTIVE:', vDisplayInfo);
          if (!responded) {
            responded = true;
            io.emit('vdisplay_status', { active: true, info: vDisplayInfo, position: currentPosition });
            return res.json({ success: true, info: vDisplayInfo, position: currentPosition });
          }
        } else if (parsed.event === 'arranged') {
          currentPosition = parsed.position;
          console.log('[VDisplay] Arrangement changed:', parsed);
          io.emit('vdisplay_arrangement', parsed);
        }
      } catch (e) {
        console.log('[VDisplay output]:', line);
      }
    }
  });

  vDisplayProcess.stderr.on('data', (data) => {
    console.error('[VDisplay Error]:', data.toString());
  });

  vDisplayProcess.on('close', (code) => {
    console.log(`[VDisplay] Process exited with code ${code}`);
    vDisplayProcess = null;
    vDisplayInfo = null;
    io.emit('vdisplay_status', { active: false });
    if (!responded) {
      responded = true;
      res.status(500).json({ error: 'Virtual display failed to start' });
    }
  });
});

// Route: Switch Arrangement (Left vs Right of Mac)
app.post('/api/vdisplay/arrange', (req, res) => {
  const position = req.body.position;
  if (!position || (position !== 'left' && position !== 'right')) {
    return res.status(400).json({ error: 'Position must be "left" or "right"' });
  }

  currentPosition = position;
  if (vDisplayProcess && vDisplayProcess.stdin && !vDisplayProcess.stdin.destroyed) {
    console.log(`[VDisplay] Switching display position to: ${position}`);
    vDisplayProcess.stdin.write(`arrange:${position}\n`);
    res.json({ success: true, position });
  } else {
    // If not currently running, save preference for next launch
    res.json({ success: true, position, note: 'Saved for when virtual display starts' });
  }
});

// Route: Stop macOS Virtual Display
app.post('/api/vdisplay/stop', (req, res) => {
  if (vDisplayProcess) {
    console.log('[VDisplay] Stopping virtual display...');
    vDisplayProcess.kill('SIGTERM');
    vDisplayProcess = null;
    vDisplayInfo = null;
    io.emit('vdisplay_status', { active: false });
    res.json({ success: true });
  } else {
    res.json({ success: true, message: 'Not running' });
  }
});

// Route: Generate a new PIN
app.post('/api/refresh-pin', async (req, res) => {
  const result = await refreshPairingCode();
  res.json(result);
});

// WebRTC Signaling & Socket.io handling
let hostSocket = null;
let clientSockets = new Set();

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Host registers itself
  socket.on('register_host', () => {
    hostSocket = socket;
    console.log(`[Host] Host registered: ${socket.id}`);
    socket.emit('vdisplay_status', { active: !!vDisplayProcess, info: vDisplayInfo });
    socket.emit('quality_state', currentQuality);
  });

  // Client requests quality state or change
  socket.on('change_quality', (newQuality) => {
    currentQuality = { ...currentQuality, ...newQuality };
    console.log('[Quality] Stream quality updated:', currentQuality);
    io.emit('quality_state', currentQuality);
    if (hostSocket) {
      hostSocket.emit('apply_quality', currentQuality);
    }
  });

  // Client validates PIN and pairs
  socket.on('pair_client', async ({ pin }, callback) => {
    if (pin === currentPIN) {
      clientSockets.add(socket);
      console.log(`[Client] Client paired successfully: ${socket.id}`);
      if (typeof callback === 'function') {
        callback({ success: true, message: 'Connected' });
      }
      if (hostSocket) {
        hostSocket.emit('client_connected', { clientId: socket.id });
      }
      // Single-use QR / PIN security: rotate immediately for any subsequent connection
      console.log('[Security] Rotating pairing PIN & QR code after successful connection');
      await refreshPairingCode();
    } else {
      console.log(`[Client] Pairing rejected for PIN: ${pin}`);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Invalid pairing PIN' });
      }
    }
  });

  // WebRTC Signaling: Offer (Host -> Client)
  socket.on('webrtc_offer', (data) => {
    console.log('[WebRTC] Relaying offer from Host to Client...');
    socket.broadcast.emit('webrtc_offer', data);
  });

  // WebRTC Signaling: Answer (Client -> Host)
  socket.on('webrtc_answer', (data) => {
    console.log('[WebRTC] Relaying answer from Client to Host...');
    if (hostSocket) {
      hostSocket.emit('webrtc_answer', data);
    }
  });

  // WebRTC Signaling: ICE Candidate exchange
  socket.on('webrtc_ice_candidate', (data) => {
    socket.broadcast.emit('webrtc_ice_candidate', data);
  });

  // Tablet touch event forwarded back to host
  socket.on('touch_event', (eventData) => {
    if (hostSocket) {
      hostSocket.emit('touch_event', eventData);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    if (socket === hostSocket) {
      console.log('[Host] Host disconnected');
      hostSocket = null;
      io.emit('host_disconnected');
    } else if (clientSockets.has(socket)) {
      clientSockets.delete(socket);
      if (hostSocket) {
        hostSocket.emit('client_disconnected', { clientId: socket.id });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log(`====================================================`);
  console.log(`🚀 EVEDIS Host Server running on:`);
  console.log(`   Host Console:    http://localhost:${PORT}/host.html`);
  console.log(`   Tablet Connect:  http://${localIP}:${PORT}/client.html?pin=${currentPIN}`);
  console.log(`   Pairing PIN:     ${currentPIN}`);
  console.log(`====================================================`);
});
