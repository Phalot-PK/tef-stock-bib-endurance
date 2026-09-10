'use client';

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'tef-inventory-bib.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'tef-inventory-bib',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    '1:970198541323:web:1f36afe8347c9d2184930e',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firebaseModulesPromise: Promise<{
  getApp: typeof import('firebase/app').getApp;
  getApps: typeof import('firebase/app').getApps;
  initializeApp: typeof import('firebase/app').initializeApp;
  getAuth: typeof import('firebase/auth').getAuth;
  GoogleAuthProvider: typeof import('firebase/auth').GoogleAuthProvider;
  onAuthStateChanged: typeof import('firebase/auth').onAuthStateChanged;
  signInWithRedirect: typeof import('firebase/auth').signInWithRedirect;
  signOut: typeof import('firebase/auth').signOut;
}> | null = null;

export function isFirebaseAuthEnabled() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const hostedByFirebase =
    host.endsWith('.web.app') || host.endsWith('.firebaseapp.com');
  return Boolean(firebaseConfig.apiKey) &&
    (hostedByFirebase || import.meta.env.VITE_FORCE_FIREBASE_AUTH === 'true');
}

async function getFirebaseAuth() {
  if (!isFirebaseAuthEnabled()) return null;
  if (!firebaseModulesPromise) {
    firebaseModulesPromise = Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]).then(([appModule, authModule]) => ({
      getApp: appModule.getApp,
      getApps: appModule.getApps,
      initializeApp: appModule.initializeApp,
      getAuth: authModule.getAuth,
      GoogleAuthProvider: authModule.GoogleAuthProvider,
      onAuthStateChanged: authModule.onAuthStateChanged,
      signInWithRedirect: authModule.signInWithRedirect,
      signOut: authModule.signOut,
    }));
  }
  const modules = await firebaseModulesPromise;
  if (!app) app = modules.getApps().length ? modules.getApp() : modules.initializeApp(firebaseConfig);
  if (!auth) auth = modules.getAuth(app);
  return { auth, modules };
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void) {
  let cancelled = false;
  let unsubscribe: () => void = () => undefined;
  void getFirebaseAuth().then((result) => {
    if (!result) {
      callback(null);
      return;
    }
    if (!cancelled) unsubscribe = result.modules.onAuthStateChanged(result.auth, callback);
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function signInWithGoogle() {
  const result = await getFirebaseAuth();
  if (!result) throw new Error('Firebase Auth ยังไม่ได้ตั้งค่า');
  const provider = new result.modules.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return result.modules.signInWithRedirect(result.auth, provider);
}

export async function signOutFromFirebase() {
  const result = await getFirebaseAuth();
  if (result) await result.modules.signOut(result.auth);
}

export async function getFirebaseIdToken() {
  const result = await getFirebaseAuth();
  const user = result?.auth.currentUser;
  return user ? user.getIdToken() : null;
}
