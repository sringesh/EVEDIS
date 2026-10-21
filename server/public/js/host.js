// EVEDIS Host Controller & WebRTC Streamer
// Hybrid Architecture: Works on Localhost (Socket.io) and Cloud (Firebase Firestore)

// Safe Socket.io initialization
let socket = null;
const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
try {
  if (typeof io !== 'undefined') {
    const socketUrl = isLocalOrigin ? window.location.origin : 'http://localhost:4040';
    socket = io(socketUrl, { autoConnect: true, reconnectionAttempts: 3, timeout: 2000 });
  }
} catch (e) {
  console.warn('[Socket] Operating in Cloud mode');
}

// DOM elements
const hostStatusBadge = document.getElementById('hostStatusBadge');
const vdisplayIndicator = document.getElementById('vdisplayIndicator');
const vdisplayStatusText = document.getElementById('vdisplayStatusText');
const vdisplayDetails = document.getElementById('vdisplayDetails');
const btnStartVDisplay = document.getElementById('btnStartVDisplay');
const btnStopVDisplay = document.getElementById('btnStopVDisplay');

const localPreview = document.getElementById('localPreview');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const btnStartCapture = document.getElementById('btnStartCapture');
const btnStopCapture = document.getElementById('btnStopCapture');
const streamStats = document.getElementById('streamStats');
const statRes = document.getElementById('statRes');
const statFps = document.getElementById('statFps');
const statClient = document.getElementById('statClient');

const qrCodeImg = document.getElementById('qrCodeImg');
const pinDisplay = document.getElementById('pinDisplay');
const tabletUrlInput = document.getElementById('tabletUrlInput');
const btnCopyUrl = document.getElementById('btnCopyUrl');
const btnRefreshPin = document.getElementById('btnRefreshPin');
const clientConnectionBadge = document.getElementById('clientConnectionBadge');

// Top Radar Elements (Always Visible Above Fold)
const radarPinDisplay = document.getElementById('radarPinDisplay');
const btnRadarRefreshPin = document.getElementById('btnRadarRefreshPin');
const radarTabletUrlInput = document.getElementById('radarTabletUrlInput');
const btnRadarCopyUrl = document.getElementById('btnRadarCopyUrl');
const radarStatusBadge = document.getElementById('radarStatusBadge');
const radarStatusText = document.getElementById('radarStatusText');
const radarDot = document.getElementById('radarDot');
const radarQrThumb = document.getElementById('radarQrThumb');
const radarQrThumbWrap = document.getElementById('radarQrThumbWrap');

// Companion Guide Elements
const vdisplayCompanionGuide = document.getElementById('vdisplayCompanionGuide');
const btnCloseGuide = document.getElementById('btnCloseGuide');
const btnGuideStartCapture = document.getElementById('btnGuideStartCapture');
const btnCopyCommand = document.getElementById('btnCopyCommand');

// WebRTC State
let localStream = null;
let peerConnection = null;
let currentClientId = null;
let currentPosition = 'right';
let currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
let firestoreUnsubscribe = null;
let currentQuality = {
  resolution: '1080p',
  fps: 60,
  bitrate: 6000
};

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

// Retro Toast Helper
function showRetroToast(message, isWarning = false) {
  let toast = document.getElementById('retroToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'retroToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0e1410;
      border: 1px solid #a3ff12;
      color: #a3ff12;
      font-family: 'Silkscreen', cursive;
      font-size: 11px;
      padding: 12px 18px;
      z-index: 9999;
      box-shadow: 0 0 20px rgba(163, 255, 18, 0.3);
      transition: opacity 0.3s ease;
      max-width: 420px;
      line-height: 1.5;
    `;
    document.body.appendChild(toast);
  }
  toast.style.borderColor = isWarning ? '#ffb800' : '#a3ff12';
  toast.style.color = isWarning ? '#ffb800' : '#a3ff12';
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 5000);
}

// Tablet Connection State UI Updater
function updateTabletConnectedUI(connected, clientLabel = 'Android Tablet') {
  if (connected) {
    if (clientConnectionBadge) {
      clientConnectionBadge.innerHTML = '<span class="dot dot-connected"></span> Android Tablet Connected';
      clientConnectionBadge.style.color = '#3fb950';
    }
    if (radarStatusBadge) radarStatusBadge.classList.add('connected');
    if (radarStatusText) radarStatusText.textContent = 'Tablet Connected';
    if (radarDot) radarDot.className = 'dot dot-connected';
    if (statClient) {
      statClient.textContent = `Connected (${clientLabel})`;
      statClient.style.color = '#3fb950';
    }
  } else {
    if (clientConnectionBadge) {
      clientConnectionBadge.innerHTML = '<span class="dot dot-waiting"></span> Waiting for tablet to join...';
      clientConnectionBadge.style.color = 'var(--text-muted)';
    }
    if (radarStatusBadge) radarStatusBadge.classList.remove('connected');
    if (radarStatusText) radarStatusText.textContent = 'Waiting for tablet...';
    if (radarDot) radarDot.className = 'dot dot-waiting';
    if (statClient) {
      statClient.textContent = 'Disconnected';
      statClient.style.color = 'var(--text-muted)';
    }
  }
}

// 1. Instant Client-Side PIN & QR Code Generation (Offline & Online 100% Reliable)
function generateAndDisplayPairingInfo(customPin = null) {
  if (customPin) {
    currentPIN = customPin;
  } else {
    currentPIN = Math.floor(100000 + Math.random() * 900000).toString();
  }

  const tabletURL = `${window.location.origin}/client.html?pin=${currentPIN}`;

  // Update all PIN elements (Top Radar + Step 3 Card)
  document.querySelectorAll('.pin-digits-target').forEach(el => {
    el.textContent = currentPIN;
  });
  if (pinDisplay) pinDisplay.textContent = currentPIN;
  if (radarPinDisplay) radarPinDisplay.textContent = currentPIN;

  // Update direct link inputs
  if (tabletUrlInput) tabletUrlInput.value = tabletURL;
  if (radarTabletUrlInput) radarTabletUrlInput.value = tabletURL;

  // Render QR Code: 1st choice is offline client-side QRCode (0ms latency)
  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=6&data=${encodeURIComponent(tabletURL)}`;

  if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
    QRCode.toDataURL(tabletURL, { margin: 1, width: 256, color: { dark: '#000000', light: '#ffffff' } }, (err, url) => {
      const finalUrl = (!err && url) ? url : fallbackQrUrl;
      if (qrCodeImg) qrCodeImg.src = finalUrl;
      if (radarQrThumb) radarQrThumb.src = finalUrl;
    });
  } else {
    if (qrCodeImg) qrCodeImg.src = fallbackQrUrl;
    if (radarQrThumb) radarQrThumb.src = fallbackQrUrl;
  }

  // Sync to Cloud Firestore for global cloud signaling
  syncSessionToFirestore(currentPIN);
}

// 2. Cloud Firestore WebRTC Signaling
async function syncSessionToFirestore(pin) {
  if (typeof firebase === 'undefined' || !firebase.firestore || !window.__IS_FIREBASE_CONFIGURED__) {
    return;
  }

  try {
    const db = firebase.firestore();
    const sessionRef = db.collection('sessions').doc(pin);

    await sessionRef.set({
      pin,
      hostOrigin: window.location.origin,
      status: 'waiting',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }

    // Listen for tablet client connection & answer
    firestoreUnsubscribe = sessionRef.onSnapshot(async (doc) => {
      if (!doc.exists) return;
      const data = doc.data();

      // Tablet connected
      if (data.clientJoined && !currentClientId) {
        currentClientId = data.clientUid || 'cloud-tablet';
        updateTabletConnectedUI(true, 'Cloud WebRTC');
        showRetroToast('📱 Tablet paired successfully! Ready to stream.');

        if (localStream) {
          initiateWebRTC();
        }
      }

      // Received WebRTC Answer from tablet
      if (data.webrtc_answer && peerConnection && peerConnection.signalingState === 'have-local-offer') {
        console.log('[Firestore] Received WebRTC answer from tablet client');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.webrtc_answer));
      }
    });

    // Listen for ICE candidates from tablet
    sessionRef.collection('candidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          const candData = change.doc.data();
          if (candData.sender === 'client' && peerConnection) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candData.candidate));
            } catch (e) {}
          }
        }
      });
    });
  } catch (err) {
    console.warn('[Firestore Signaling Error]:', err.message);
  }
}

// 3. Initial State Load (tries local backend if reachable, falls back to instant client generation)
async function loadStatus() {
  // Always generate PIN & QR code immediately so UI is 100% ready
  generateAndDisplayPairingInfo();

  // Try local backend for hardware display driver status
  const apiUrls = isLocalOrigin 
    ? ['/api/status'] 
    : ['http://localhost:4040/api/status', '/api/status'];

  for (const url of apiUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data.vDisplay && data.vDisplay.status === 'active') {
          updateVDisplayUI(true, data.vDisplay);
        }
        if (data.position) {
          updateArrangementUI(data.position);
        }
        break;
      }
    } catch (e) {
      // Local daemon not reachable, cloud mode remains active
    }
  }
}

// Display Arrangement (Left vs Right)
const btnArrangeLeft = document.getElementById('btnArrangeLeft');
const btnArrangeRight = document.getElementById('btnArrangeRight');

async function setDisplayArrangement(position) {
  currentPosition = position;
  updateArrangementUI(position);

  const endpoints = isLocalOrigin 
    ? ['/api/vdisplay/arrange'] 
    : ['http://localhost:4040/api/vdisplay/arrange', '/api/vdisplay/arrange'];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) break;
    } catch (e) {}
  }
}

function updateArrangementUI(position) {
  if (btnArrangeLeft && btnArrangeRight) {
    btnArrangeLeft.classList.toggle('active', position === 'left');
    btnArrangeRight.classList.toggle('active', position === 'right');
  }
}

if (btnArrangeLeft) {
  btnArrangeLeft.addEventListener('click', () => setDisplayArrangement('left'));
}
if (btnArrangeRight) {
  btnArrangeRight.addEventListener('click', () => setDisplayArrangement('right'));
}

function updateVDisplayUI(active, info = null) {
  if (active) {
    vdisplayIndicator.classList.add('active');
    vdisplayStatusText.textContent = 'Virtual Display ACTIVE';
    vdisplayDetails.textContent = info ? `Display ID: ${info.displayID} (${info.width}x${info.height} @ ${info.fps}fps)` : 'Active';
    btnStartVDisplay.disabled = true;
    btnStopVDisplay.disabled = false;
  } else {
    vdisplayIndicator.classList.remove('active');
    vdisplayStatusText.textContent = 'Virtual Display Inactive';
    vdisplayDetails.textContent = 'Target: 1920x1200 (10.1" Tablet Ratio, 60fps)';
    btnStartVDisplay.disabled = false;
    btnStopVDisplay.disabled = true;
  }
}

// 4. Virtual Display Controls
if (btnStartVDisplay) {
  btnStartVDisplay.addEventListener('click', async () => {
    btnStartVDisplay.disabled = true;
    vdisplayStatusText.textContent = 'Checking EVEDIS Local Companion...';

    // Ensure Pairing PIN & QR Code are always fresh & active
    if (!currentPIN || currentPIN === '------') {
      generateAndDisplayPairingInfo();
    }

    const endpoints = isLocalOrigin 
      ? ['/api/vdisplay/start'] 
      : [
          'http://127.0.0.1:4040/api/vdisplay/start',
          'http://localhost:4040/api/vdisplay/start',
          '/api/vdisplay/start'
        ];

    let started = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ width: 1920, height: 1200, fps: 60, position: currentPosition || 'right' }),
          signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success || data.status === 'already_running') {
            updateVDisplayUI(true, data.info);
            showRetroToast('✨ Virtual secondary display activated on your system!');
            if (vdisplayCompanionGuide) vdisplayCompanionGuide.style.display = 'none';
            started = true;
            break;
          }
        }
      } catch (err) {}
    }

    if (!started) {
      // Local daemon is not running on machine or browser sandbox blocked
      vdisplayStatusText.textContent = 'Virtual Display Inactive';
      btnStartVDisplay.disabled = false;
      if (vdisplayCompanionGuide) {
        vdisplayCompanionGuide.style.display = 'flex';
      }
      showRetroToast(
        "⚡ Browser sandbox detected! Run 'node server/index.js' in terminal for native 2nd desktop, or click 'Select Screen to Share' to stream in browser!",
        true
      );
    }
  });
}

// Companion Guide Button Handlers
if (btnGuideStartCapture) {
  btnGuideStartCapture.addEventListener('click', () => {
    if (btnStartCapture) btnStartCapture.click();
  });
}

if (btnCloseGuide) {
  btnCloseGuide.addEventListener('click', () => {
    if (vdisplayCompanionGuide) vdisplayCompanionGuide.style.display = 'none';
  });
}

if (btnCopyCommand) {
  btnCopyCommand.addEventListener('click', () => {
    navigator.clipboard.writeText('node server/index.js').then(() => {
      btnCopyCommand.textContent = 'Copied!';
      setTimeout(() => { btnCopyCommand.textContent = 'Copy'; }, 2000);
    }).catch(() => {
      btnCopyCommand.textContent = 'Copied!';
    });
  });
}

// Top Radar Action Handlers
if (btnRadarCopyUrl) {
  btnRadarCopyUrl.addEventListener('click', () => {
    if (radarTabletUrlInput) {
      radarTabletUrlInput.select();
      navigator.clipboard.writeText(radarTabletUrlInput.value).then(() => {
        btnRadarCopyUrl.textContent = 'Copied!';
        setTimeout(() => { btnRadarCopyUrl.textContent = 'Copy'; }, 2000);
      }).catch(() => {
        btnRadarCopyUrl.textContent = 'Copied!';
      });
    }
  });
}

if (btnRadarRefreshPin) {
  btnRadarRefreshPin.addEventListener('click', () => {
    btnRadarRefreshPin.disabled = true;
    btnRadarRefreshPin.textContent = 'Generating...';
    generateAndDisplayPairingInfo();
    showRetroToast('🔄 Generated fresh 6-digit PIN & QR code.');
    setTimeout(() => {
      btnRadarRefreshPin.disabled = false;
      btnRadarRefreshPin.textContent = '🔄 New Code';
    }, 600);
  });
}

if (radarQrThumbWrap) {
  radarQrThumbWrap.addEventListener('click', () => {
    const step3 = document.querySelector('.card-wide');
    if (step3) step3.scrollIntoView({ behavior: 'smooth' });
  });
}

if (btnStopVDisplay) {
  btnStopVDisplay.addEventListener('click', async () => {
    btnStopVDisplay.disabled = true;
    const endpoints = isLocalOrigin 
      ? ['/api/vdisplay/stop'] 
      : ['http://localhost:4040/api/vdisplay/stop', '/api/vdisplay/stop'];

    for (const url of endpoints) {
      try {
        await fetch(url, { method: 'POST', signal: AbortSignal.timeout(2000) });
      } catch (e) {}
    }
    updateVDisplayUI(false);
  });
}

// 5. Screen Capture & WebRTC Setup
if (btnStartCapture) {
  btnStartCapture.addEventListener('click', async () => {
    try {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1200 }
        },
        audio: false
      });

      const track = localStream.getVideoTracks()[0];
      if ('contentHint' in track) {
        track.contentHint = 'motion';
      }
      localPreview.srcObject = localStream;
      previewPlaceholder.style.display = 'none';
      btnStartCapture.disabled = true;
      btnStopCapture.disabled = false;
      streamStats.style.display = 'flex';
      hostStatusBadge.textContent = 'Streaming';
      hostStatusBadge.className = 'badge badge-streaming';

      const settings = track.getSettings();
      statRes.textContent = `${settings.width}x${settings.height}`;
      statFps.textContent = `${settings.frameRate || 60}`;

      track.onended = () => {
        stopCapture();
      };

      if (currentClientId) {
        initiateWebRTC();
      }
      showRetroToast('🖥️ Screen capture active. Ready to stream!');
    } catch (err) {
      console.error('Error starting screen capture:', err);
    }
  });
}

function stopCapture() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  localPreview.srcObject = null;
  previewPlaceholder.style.display = 'flex';
  btnStartCapture.disabled = false;
  btnStopCapture.disabled = true;
  streamStats.style.display = 'none';
  hostStatusBadge.textContent = 'Ready';
  hostStatusBadge.className = 'badge badge-idle';

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}

if (btnStopCapture) {
  btnStopCapture.addEventListener('click', stopCapture);
}

// Copy URL Button
if (btnCopyUrl) {
  btnCopyUrl.addEventListener('click', () => {
    tabletUrlInput.select();
    document.execCommand('copy');
    btnCopyUrl.textContent = 'Copied!';
    setTimeout(() => { btnCopyUrl.textContent = 'Copy'; }, 2000);
  });
}

// Manual PIN & QR Code Refresh Button (Always generates a fresh PIN)
if (btnRefreshPin) {
  btnRefreshPin.addEventListener('click', () => {
    btnRefreshPin.disabled = true;
    btnRefreshPin.textContent = 'Generating...';
    generateAndDisplayPairingInfo();
    showRetroToast('🔄 Generated fresh 6-digit PIN & QR code.');
    setTimeout(() => {
      btnRefreshPin.disabled = false;
      btnRefreshPin.textContent = '🔄 New Code';
    }, 600);
  });
}

// 6. WebRTC Connection Offer & Handshake
async function initiateWebRTC() {
  if (!localStream) {
    console.log('[WebRTC] Waiting for screen capture before sending offer...');
    return;
  }

  console.log('[WebRTC] Creating RTCPeerConnection...');
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      if (socket && socket.connected) {
        socket.emit('webrtc_ice_candidate', event.candidate);
      }
      // Firestore cloud candidate sync
      if (typeof firebase !== 'undefined' && firebase.firestore && window.__IS_FIREBASE_CONFIGURED__) {
        const db = firebase.firestore();
        db.collection('sessions').doc(currentPIN).collection('candidates').add({
          sender: 'host',
          candidate: event.candidate.toJSON(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'connected') {
      statClient.textContent = 'Streaming (P2P)';
      statClient.style.color = '#3fb950';
      showRetroToast('🟢 WebRTC peer-to-peer connection active!');
    } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      statClient.textContent = 'Disconnected';
      statClient.style.color = '#da3633';
    }
  };

  const dataChannel = peerConnection.createDataChannel('touch_events');
  dataChannel.onmessage = (e) => {
    console.log('[Touch DataChannel received]:', e.data);
  };

  const offer = await peerConnection.createOffer({
    offerToReceiveVideo: false,
    offerToReceiveAudio: false
  });

  let sdp = offer.sdp;
  if (!sdp.includes('a=playout-delay:min=0,max=0')) {
    sdp = sdp.replace(/(m=video .*\r\n)/, '$1a=playout-delay:min=0,max=0\r\n');
  }
  sdp = sdp.replace(/a=fmtp:(\d+) (.*)/g, 'a=fmtp:$1 $2;x-google-min-bitrate=4000;x-google-max-bitrate=16000;x-google-playout-delay=0/0');

  await peerConnection.setLocalDescription({ type: 'offer', sdp });

  console.log('[WebRTC] Dispatching offer to tablet...');
  if (socket && socket.connected) {
    socket.emit('webrtc_offer', { type: 'offer', sdp });
  }

  // Sync offer to Firestore so cloud tablet receives it
  if (typeof firebase !== 'undefined' && firebase.firestore && window.__IS_FIREBASE_CONFIGURED__) {
    const db = firebase.firestore();
    db.collection('sessions').doc(currentPIN).update({
      webrtc_offer: { type: 'offer', sdp }
    }).catch(e => console.warn(e));
  }
}

// 7. Socket.io Event Listeners (if local socket connected)
if (socket) {
  socket.on('connect', () => {
    console.log('[Socket] Connected to local host backend');
    socket.emit('register_host');
  });

  socket.on('client_connected', ({ clientId }) => {
    console.log('[Socket] Client joined via local Wi-Fi:', clientId);
    currentClientId = clientId;
    clientConnectionBadge.innerHTML = '<span class="dot dot-connected"></span> Android Tablet Connected';
    clientConnectionBadge.style.color = '#3fb950';
    statClient.textContent = 'Connected (Local Wi-Fi)';

    if (localStream) {
      initiateWebRTC();
    }
  });

  socket.on('client_disconnected', () => {
    currentClientId = null;
    clientConnectionBadge.innerHTML = '<span class="dot dot-waiting"></span> Waiting for tablet to join Wi-Fi...';
    clientConnectionBadge.style.color = 'var(--text-muted)';
    statClient.textContent = 'Disconnected';
  });

  socket.on('webrtc_answer', async (answer) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on('webrtc_ice_candidate', async (candidate) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  });
}

// Load status and initialize immediately (handles both pre- and post-DOMContentLoaded states)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadStatus);
} else {
  loadStatus();
}
