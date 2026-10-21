// EVEDIS Firebase Configuration
// Checks localStorage for user-provided credentials or uses deployed Firebase config

let customConfig = null;
try {
  const saved = localStorage.getItem('evedis_firebase_config');
  if (saved) customConfig = JSON.parse(saved);
} catch (e) {}

const defaultDummyKey = "AIzaSyDummyKeyForEVEDIS-ReplaceWithYours";

const firebaseConfig = window.__EVEDIS_FIREBASE_CONFIG__ || customConfig || {
  apiKey: "AIzaSyBbLnqEu58urSvpAtg1tdJ_KyiqhJ0Dy9g",
  authDomain: "evedis.firebaseapp.com",
  projectId: "evedis",
  storageBucket: "evedis.firebasestorage.app",
  messagingSenderId: "165896198273",
  appId: "1:165896198273:web:c6882ca6e883746ef31580",
  measurementId: "G-J8GF8G8QWM"
};

// Check if credentials are placeholders or production
window.__IS_FIREBASE_CONFIGURED__ = (
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== defaultDummyKey && 
  !firebaseConfig.apiKey.includes("Dummy")
);

// Initialize Firebase only if valid or available
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('[Firebase] Init deferred or running in offline mode:', err.message);
  }
}
