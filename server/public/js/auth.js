// EVEDIS Authentication & Profile Management
// Supports Real Firebase Auth + Seamless Local Dev Simulation Mode
(function() {
  const loggedOutState = document.getElementById('loggedOutState');
  const loggedInState = document.getElementById('loggedInState');
  const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
  const btnSignOut = document.getElementById('btnSignOut');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const btnAdminLink = document.getElementById('btnAdminLink');
  const authGateStatus = document.getElementById('authGateStatus');

  let currentAuthUser = null;

  // 1. Toast Notification Helper
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
        max-width: 380px;
        line-height: 1.4;
      `;
      document.body.appendChild(toast);
    }
    if (isWarning) {
      toast.style.borderColor = '#ffb800';
      toast.style.color = '#ffb800';
    } else {
      toast.style.borderColor = '#a3ff12';
      toast.style.color = '#a3ff12';
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 4000);
  }

  // Top Navigation Signed-in Indicator Helper
  function updateTopUserBadge(user) {
    const topBadge = document.getElementById('topUserBadge');
    if (!topBadge) return;

    if (user) {
      const avatarSrc = user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (user.uid || 'evedis');
      const displayName = user.displayName || user.email || 'USER';
      const shortName = displayName.split(' ')[0];
      topBadge.innerHTML = `
        <div class="top-auth-logged-in" title="Signed in as ${displayName} (${user.email || ''})">
          <span class="top-auth-symbol"></span>
          <img class="top-auth-avatar" src="${avatarSrc}" alt="Avatar" />
          <span class="top-auth-name">${shortName}</span>
          <button id="btnTopSignOut" class="top-auth-signout" title="Sign Out">✕</button>
        </div>
      `;
      const btnTopSignOut = document.getElementById('btnTopSignOut');
      if (btnTopSignOut) {
        btnTopSignOut.addEventListener('click', (e) => {
          e.stopPropagation();
          if (btnSignOut) btnSignOut.click();
        });
      }
    } else {
      topBadge.innerHTML = `
        <button id="btnTopSignIn" class="top-auth-login-btn">
          <span>🔒</span> GOOGLE SIGN IN
        </button>
      `;
      const btnTopSignIn = document.getElementById('btnTopSignIn');
      if (btnTopSignIn) {
        btnTopSignIn.addEventListener('click', () => {
          if (btnGoogleSignIn) btnGoogleSignIn.click();
        });
      }
    }
  }

  // 2. Render Logged In State
  function renderLoggedIn(user) {
    currentAuthUser = user;
    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'flex';

    if (userAvatar) userAvatar.src = user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (user.uid || 'evedis');
    if (userName) userName.textContent = user.displayName || 'EVEDIS User';
    if (userEmail) userEmail.textContent = user.email || 'user@evedis.local';

    if (authGateStatus) {
      authGateStatus.textContent = 'AUTHENTICATED';
      authGateStatus.className = 'lcd-badge';
    }

    if (btnAdminLink) {
      if (user.role === 'admin' || user.isDevMode) {
        btnAdminLink.style.display = 'inline-flex';
      } else {
        btnAdminLink.style.display = 'none';
      }
    }

    // Update Top Right Signed In Badge Symbol
    updateTopUserBadge(user);
  }

  // 3. Render Logged Out State
  function renderLoggedOut() {
    currentAuthUser = null;
    if (loggedOutState) loggedOutState.style.display = 'block';
    if (loggedInState) loggedInState.style.display = 'none';
    if (btnAdminLink) btnAdminLink.style.display = 'none';
    if (authGateStatus) {
      authGateStatus.textContent = 'GOOGLE SSO REQUIRED';
      authGateStatus.className = 'lcd-badge lcd-badge-amber';
    }

    // Update Top Right Signed In Badge Symbol
    updateTopUserBadge(null);
  }

  // 4. Check for Saved Local Dev Session
  const savedDevUser = localStorage.getItem('evedis_dev_user');
  if (savedDevUser) {
    try {
      const parsed = JSON.parse(savedDevUser);
      renderLoggedIn(parsed);
    } catch (e) {
      localStorage.removeItem('evedis_dev_user');
      renderLoggedOut();
    }
  } else {
    renderLoggedOut();
  }

  // 5. Firebase Auth Listener (if Firebase is initialized)
  if (typeof firebase !== 'undefined' && firebase.auth && window.__IS_FIREBASE_CONFIGURED__) {
    try {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          console.log('[Auth] Firebase user detected:', user.email);
          const profile = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: 'user',
            isDevMode: false
          };

          // Sync to Firestore if available
          try {
            const db = firebase.firestore();
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
              await userRef.set({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
              });
            } else {
              profile.role = doc.data().role || 'user';
              await userRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          } catch (e) {
            console.warn('[Firestore] Profile sync deferred:', e.message);
          }

          renderLoggedIn(profile);
        } else if (!localStorage.getItem('evedis_dev_user')) {
          renderLoggedOut();
        }
      });
    } catch (err) {
      console.warn('[Firebase Auth] Listener failed:', err);
    }
  }

  // 6. Sign In Action
  if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', async () => {
      // If Firebase is configured with a real API key, attempt Google Sign-In
      if (window.__IS_FIREBASE_CONFIGURED__ && typeof firebase !== 'undefined' && firebase.auth) {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await firebase.auth().signInWithPopup(provider);
          return;
        } catch (err) {
          console.warn('[Firebase Auth] Google popup failed or cancelled:', err.code, err.message);
          // Only show alert if it's NOT an api-key issue (we handle invalid keys smoothly below)
          if (err.code !== 'auth/api-key-not-valid' && err.code !== 'auth/invalid-api-key') {
            showRetroToast('Google Auth: ' + err.message, true);
            return;
          }
        }
      }

      // Seamless Local Developer / Simulation Sign-In Fallback
      console.log('[Auth] Activating zero-friction Local Dev Session...');
      const devProfile = {
        uid: 'dev-admin-' + Math.floor(Math.random() * 8999 + 1000),
        displayName: 'Local Admin (Dev Mode)',
        email: 'admin@evedis.local',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=evedis',
        role: 'admin',
        isDevMode: true
      };
      localStorage.setItem('evedis_dev_user', JSON.stringify(devProfile));
      renderLoggedIn(devProfile);
      showRetroToast('⚡ LOGGED IN AS LOCAL ADMIN (DEV SIMULATION ACTIVE)');
    });
  }

  // 7. Sign Out Action
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      localStorage.removeItem('evedis_dev_user');
      if (typeof firebase !== 'undefined' && firebase.auth && window.__IS_FIREBASE_CONFIGURED__) {
        try {
          await firebase.auth().signOut();
        } catch (e) {}
      }
      renderLoggedOut();
      showRetroToast('SIGNED OUT SUCCESSFULLY');
    });
  }

  // Expose helper to configure Firebase dynamically
  window.evedisConfigureFirebase = function(configJson) {
    try {
      localStorage.setItem('evedis_firebase_config', JSON.stringify(configJson));
      location.reload();
    } catch (e) {
      alert('Invalid config JSON');
    }
  };
})();
