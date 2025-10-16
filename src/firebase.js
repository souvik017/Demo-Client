import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Firebase config using env variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// const firebaseConfig = {
//   apiKey: "AIzaSyBDSV33V6VTKjO-sQhInUHie7-HjciLPqE",
//   authDomain: "fir-app-knickglobal.firebaseapp.com",
//   projectId: "fir-app-knickglobal",
//   storageBucket: "fir-app-knickglobal.firebasestorage.app",
//   messagingSenderId: "183317000503",
//   appId: "1:183317000503:web:1213250aa6455775772ab2",
//   measurementId: "G-1XFBY311KT"
// };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Google Sign-In function
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const token = await result.user.getIdToken(); // JWT token
    return { user: result.user, token };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

export { auth };
