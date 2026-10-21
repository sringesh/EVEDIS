// EVEDIS Tablet Client Receiver & Display Rescaling Engine
// Dual-Mode Architecture: Works with Local Wi-Fi (Socket.io) & Global Cloud (Firebase Firestore)

let socket = null;
const isLocalOrigin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
try {
  if (typeof io !== 'undefined') {
    const socketUrl = isLocalOrigin ? window.location.origin : 'http://localhost:4040';
    socket = io(socketUrl, { autoConnect: true, reconnectionAttempts: 2, timeout: 2000 });
  }
} catch (e) {
  console.warn('[Socket] Operating in Cloud Firestore mode');
}

// DOM elements
const pairingScreen = document.getElementById('pairingScreen');
const pinInput = document.getElementById('pinInput');
const btnConnect = document.getElementById('btnConnect');
const pairingError = document.getElementById('pairingError');

const displayContainer = document.getElementById('displayContainer');
const videoStage = document.getElementById('videoStage');
const remoteVideo = document.getElementById('remoteVideo');
const fullscreenPrompt = document.getElementById('fullscreenPrompt');

// Floating HUD elements
const floatingHUD = document.getElementById('floatingHUD');
const hudStatus = document.getElementById('hudStatus');
const btnLaptopMatch = document.getElementById('btnLaptopMatch');
const btnOpenScaleDrawer = document.getElementById('btnOpenScaleDrawer');
const currentScaleText = document.getElementById('currentScaleText');
const btnOpenQualityDrawer = document.getElementById('btnOpenQualityDrawer');
const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
const btnDisconnect = document.getElementById('btnDisconnect');

// Drawers
const scaleDrawer = document.getElementById('scaleDrawer');
const btnCloseScaleDrawer = document.getElementById('btnCloseScaleDrawer');
const scaleSlider = document.getElementById('scaleSlider');
const sliderValueText = document.getElementById('sliderValueText');
const btnScaleMinus = document.getElementById('btnScaleMinus');
const btnScalePlus = document.getElementById('btnScalePlus');
const scalePresetButtons = document.querySelectorAll('.scale-preset-btn');

const qualityDrawer = document.getElementById('qualityDrawer');
const btnCloseQualityDrawer = document.getElementById('btnCloseQualityDrawer');
const tabQualityButtons = document.querySelectorAll('.tab-quality-btn');

// WebRTC State
let peerConnection = null;
let dataChannel = null;
let wakeLock = null;
let hudTimeout = null;
let activeSessionPin = null;
let firestoreSessionRef = null;

// Display Scale & Pan State
let currentScale = 1.0;
let panX = 0;
let panY = 0;
let isLaptopMatchActive = false;

// Touch Gesture State
let initialPinchDistance = null;
let initialScale = 1.0;
let lastTouchMidX = 0;
let lastTouchMidY = 0;

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

// 1. PIN Auto-Fill from Query String
const urlParams = new URLSearchParams(window.location.search);
const pinFromUrl = urlParams.get('pin');
if (pinFromUrl) {
  pinInput.value = pinFromUrl;
}

// 2. Successful Pairing Transition
function onPairSuccess() {
  console.log('[Client] Paired successfully!');
  pairingScreen.style.display = 'none';
  displayContainer.style.display = 'flex';
  setupWebRTC();
  showFullscreenPrompt();
  autoAdjustForTabletScreen();
}

// 3. Pairing Attempt (Dual: Socket.io or Firestore)
async function attemptPairing() {
  const pin = pinInput.value.trim();
  if (pin.length !== 6) {
    pairingError.textContent = 'Please enter a 6-digit PIN';
    return;
  }

  pairingError.textContent = '';
  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting...';
  activeSessionPin = pin;

  // Mode A: Local Socket.io if connected
  if (socket && socket.connected) {
    socket.emit('pair_client', { pin }, (response) => {
      btnConnect.disabled = false;
      btnConnect.textContent = 'Connect to Host';
      if (response && response.success) {
        onPairSuccess();
      } else {
        pairingError.textContent = response ? response.message : 'Connection failed. Check PIN.';
      }
    });
    return;
  }

  // Mode B: Cloud Firestore WebRTC Signaling
  if (typeof firebase !== 'undefined' && firebase.firestore && window.__IS_FIREBASE_CONFIGURED__) {
    try {
      const db = firebase.firestore();
      firestoreSessionRef = db.collection('sessions').doc(pin);
      const doc = await firestoreSessionRef.get();

      if (!doc.exists) {
        pairingError.textContent = 'Invalid PIN. Check the 6-digit code on the host.';
        btnConnect.disabled = false;
        btnConnect.textContent = 'Connect to Host';
        return;
      }

      await firestoreSessionRef.update({
        clientJoined: true,
        clientUid: 'tablet-' + Math.floor(Math.random() * 89999 + 10000),
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      onPairSuccess();

      // Listen for WebRTC offer from host
      firestoreSessionRef.onSnapshot(async (snap) => {
        if (!snap.exists) return;
        const sData = snap.data();
        if (sData.webrtc_offer && (!peerConnection || peerConnection.signalingState === 'stable' || peerConnection.signalingState === 'have-remote-offer')) {
          await handleCloudWebRTCOffer(sData.webrtc_offer);
        }
        if (sData.quality) {
          updateClientQualityUI(sData.quality);
        }
      });

      // Listen for ICE candidates from host
      firestoreSessionRef.collection('candidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === 'added') {
            const candData = change.doc.data();
            if (candData.sender === 'host' && peerConnection) {
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candData.candidate));
              } catch (e) {}
            }
          }
        });
      });

      return;
    } catch (err) {
      console.warn('[Firestore Client Pairing]', err);
      pairingError.textContent = 'Pairing error: ' + err.message;
      btnConnect.disabled = false;
      btnConnect.textContent = 'Connect to Host';
      return;
    }
  }

  pairingError.textContent = 'Waiting for Host connection...';
  btnConnect.disabled = false;
  btnConnect.textContent = 'Connect to Host';
}

btnConnect.addEventListener('click', attemptPairing);
pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptPairing();
});

// Auto-pair on load if PIN provided in query string
if (pinFromUrl && pinFromUrl.length === 6) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(attemptPairing, 400);
    });
  } else {
    setTimeout(attemptPairing, 400);
  }
}

// 4. Immersive Fullscreen & Screen Wake Lock
async function requestImmersiveFullscreen() {
  try {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      await elem.requestFullscreen({ navigationUI: 'hide' });
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen error:', err);
  }

  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen awake active');
    }
  } catch (err) {}
}

function showFullscreenPrompt() {
  fullscreenPrompt.style.display = 'flex';
}

fullscreenPrompt.addEventListener('click', async () => {
  await requestImmersiveFullscreen();
  remoteVideo.play().catch(() => {});
  fullscreenPrompt.style.opacity = '0';
  setTimeout(() => {
    fullscreenPrompt.style.display = 'none';
  }, 300);
  triggerHUD();
});

// 5. WebRTC Setup
function setupWebRTC() {
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.ontrack = (event) => {
    console.log('[WebRTC] Received remote stream track:', event.track.kind);
    remoteVideo.srcObject = event.streams[0];
    
    const receivers = peerConnection.getReceivers();
    const videoReceiver = receivers.find(r => r.track && r.track.kind === 'video');
    if (videoReceiver && 'playoutDelayHint' in videoReceiver) {
      videoReceiver.playoutDelayHint = 0;
      console.log('[WebRTC] Playout delay set to 0ms (instant render)');
    }

    remoteVideo.play().catch(() => {});
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      if (socket && socket.connected) {
        socket.emit('webrtc_ice_candidate', event.candidate);
      }
      if (firestoreSessionRef) {
        firestoreSessionRef.collection('candidates').add({
          sender: 'client',
          candidate: event.candidate.toJSON(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    console.log('[WebRTC] DataChannel established');
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      hudStatus.textContent = 'Live (P2P)';
    } else if (peerConnection.connectionState === 'disconnected') {
      hudStatus.textContent = 'Reconnecting...';
    }
  };
}

// Cloud WebRTC Offer Handler
async function handleCloudWebRTCOffer(offer) {
  console.log('[WebRTC] Processing offer from Cloud Firestore');
  if (!peerConnection) setupWebRTC();

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  if (firestoreSessionRef) {
    await firestoreSessionRef.update({
      webrtc_answer: { type: 'answer', sdp: answer.sdp }
    });
    console.log('[WebRTC] Answer dispatched to Cloud Firestore');
  }
}

// 6. Socket.io Event Listeners (for Local Wi-Fi mode)
if (socket) {
  socket.on('webrtc_offer', async (offer) => {
    console.log('[WebRTC] Received offer via Socket.io');
    if (!peerConnection) setupWebRTC();

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('webrtc_answer', answer);
  });

  socket.on('webrtc_ice_candidate', async (candidate) => {
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {}
    }
  });

  socket.on('quality_state', (quality) => {
    console.log('[Socket] Received quality update from Host:', quality);
    updateClientQualityUI(quality);
  });

  socket.on('host_disconnected', () => {
    alert('Host disconnected.');
    location.reload();
  });
}

function updateClientQualityUI(quality) {
  if (!quality) return;
  tabQualityButtons.forEach(btn => {
    const isMatch = btn.dataset.res === quality.resolution && 
                    parseInt(btn.dataset.fps) === parseInt(quality.fps);
    btn.classList.toggle('active', isMatch);
  });
  if (hudStatus) {
    hudStatus.textContent = `${quality.resolution} ${quality.fps}fps`;
  }
}

// 7. Display Scale & "Laptop Size Match" Readjustment Engine
function calculateLaptopMatchScale() {
  const w = window.innerWidth;
  if (w <= 850) {
    return 1.40;
  } else if (w <= 1100) {
    return 1.22;
  } else if (w <= 1300) {
    return 1.12;
  } else {
    return 1.0;
  }
}

function applyDisplayScale(scale, resetPan = false) {
  currentScale = Math.max(0.7, Math.min(2.0, scale));

  if (resetPan || currentScale <= 1.0) {
    panX = 0;
    panY = 0;
  } else {
    clampPan();
  }

  videoStage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentScale})`;

  if (currentScaleText) currentScaleText.textContent = `${Math.round(currentScale * 100)}%`;
  if (scaleSlider) scaleSlider.value = currentScale;
  if (sliderValueText) sliderValueText.textContent = `${Math.round(currentScale * 100)}%`;

  scalePresetButtons.forEach(btn => {
    if (Math.abs(parseFloat(btn.dataset.scale) - currentScale) < 0.05) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function clampPan() {
  const maxPanX = ((currentScale - 1) * window.innerWidth) / 2;
  const maxPanY = ((currentScale - 1) * window.innerHeight) / 2;
  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function autoAdjustForTabletScreen() {
  const matchScale = calculateLaptopMatchScale();
  applyDisplayScale(matchScale, true);
  isLaptopMatchActive = true;
  if (btnLaptopMatch) btnLaptopMatch.classList.add('active');
}

if (btnLaptopMatch) {
  btnLaptopMatch.addEventListener('click', () => {
    if (isLaptopMatchActive) {
      applyDisplayScale(1.0, true);
      isLaptopMatchActive = false;
      btnLaptopMatch.classList.remove('active');
    } else {
      autoAdjustForTabletScreen();
    }
  });
}

// Touch Gestures: Pinch-to-zoom & two-finger pan
videoStage.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialPinchDistance = Math.hypot(dx, dy);
    initialScale = currentScale;
    lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
}, { passive: true });

videoStage.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const newScale = initialScale * (dist / initialPinchDistance);

    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    panX += (midX - lastTouchMidX);
    panY += (midY - lastTouchMidY);
    lastTouchMidX = midX;
    lastTouchMidY = midY;

    applyDisplayScale(newScale, false);
    isLaptopMatchActive = false;
    if (btnLaptopMatch) btnLaptopMatch.classList.remove('active');
  }
}, { passive: true });

videoStage.addEventListener('touchend', () => {
  initialPinchDistance = null;
});

// Floating HUD controls
function triggerHUD() {
  floatingHUD.classList.add('visible');
  clearTimeout(hudTimeout);
  hudTimeout = setTimeout(() => {
    floatingHUD.classList.remove('visible');
  }, 4500);
}

document.addEventListener('click', (e) => {
  if (!scaleDrawer.classList.contains('open') && !qualityDrawer.classList.contains('open')) {
    triggerHUD();
  }
});

if (btnOpenScaleDrawer) {
  btnOpenScaleDrawer.addEventListener('click', (e) => {
    e.stopPropagation();
    scaleDrawer.classList.add('open');
    qualityDrawer.classList.remove('open');
  });
}

if (btnCloseScaleDrawer) {
  btnCloseScaleDrawer.addEventListener('click', () => {
    scaleDrawer.classList.remove('open');
  });
}

if (scaleSlider) {
  scaleSlider.addEventListener('input', (e) => {
    const s = parseFloat(e.target.value);
    applyDisplayScale(s);
    isLaptopMatchActive = false;
    if (btnLaptopMatch) btnLaptopMatch.classList.remove('active');
  });
}

if (btnScaleMinus) {
  btnScaleMinus.addEventListener('click', () => {
    applyDisplayScale(currentScale - 0.1);
    isLaptopMatchActive = false;
    if (btnLaptopMatch) btnLaptopMatch.classList.remove('active');
  });
}

if (btnScalePlus) {
  btnScalePlus.addEventListener('click', () => {
    applyDisplayScale(currentScale + 0.1);
    isLaptopMatchActive = false;
    if (btnLaptopMatch) btnLaptopMatch.classList.remove('active');
  });
}

scalePresetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const s = parseFloat(btn.dataset.scale);
    applyDisplayScale(s, true);
    isLaptopMatchActive = false;
    if (btnLaptopMatch) btnLaptopMatch.classList.remove('active');
  });
});

if (btnOpenQualityDrawer) {
  btnOpenQualityDrawer.addEventListener('click', (e) => {
    e.stopPropagation();
    qualityDrawer.classList.add('open');
    scaleDrawer.classList.remove('open');
  });
}

if (btnCloseQualityDrawer) {
  btnCloseQualityDrawer.addEventListener('click', () => {
    qualityDrawer.classList.remove('open');
  });
}

// Tablet Quality Profile Buttons
tabQualityButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const res = btn.dataset.res;
    const fps = parseInt(btn.dataset.fps);
    const bitrate = parseInt(btn.dataset.bitrate);

    tabQualityButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const quality = { resolution: res, fps, bitrate };
    console.log('[Client] Requested streaming quality change:', quality);

    if (hudStatus) {
      hudStatus.textContent = `${res} ${fps}fps`;
    }

    // 1. Send over Socket.io to Host
    if (socket && socket.connected) {
      socket.emit('change_quality', quality);
    }

    // 2. Sync to Firestore in Cloud mode
    if (firestoreSessionRef) {
      firestoreSessionRef.update({ quality }).catch(() => {});
    }

    triggerHUD();
    setTimeout(() => {
      qualityDrawer.classList.remove('open');
    }, 300);
  });
});

if (btnToggleFullscreen) {
  btnToggleFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      requestImmersiveFullscreen();
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

if (btnDisconnect) {
  btnDisconnect.addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    location.reload();
  });
}
