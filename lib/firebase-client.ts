'use client';

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    'tef-inventory-bib.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'tef-inventory-bib',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
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
  signInWithPopup: typeof import('firebase/auth').signInWithPopup;
  signInWithRedirect: typeof import('firebase/auth').signInWithRedirect;
  getRedirectResult: typeof import('firebase/auth').getRedirectResult;
  signOut: typeof import('firebase/auth').signOut;
}> | null = null;

export function isFirebaseAuthEnabled() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const hostedByTarget =
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com') ||
    host.endsWith('.vercel.app') ||
    host === 'localhost' ||
    host === '127.0.0.1';
  return Boolean(firebaseConfig.apiKey) &&
    (hostedByTarget || process.env.NEXT_PUBLIC_FORCE_FIREBASE_AUTH === 'true');
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
      signInWithPopup: authModule.signInWithPopup,
      signInWithRedirect: authModule.signInWithRedirect,
      getRedirectResult: authModule.getRedirectResult,
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
  void getFirebaseAuth().then(async (result) => {
    if (!result) {
      callback(null);
      return;
    }
    try {
      const redirectRes = await result.modules.getRedirectResult(result.auth);
      if (redirectRes?.user) {
        callback(redirectRes.user);
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      console.warn('Redirect auth check notice:', errObj?.message || err);
    }
    if (!cancelled) {
      unsubscribe = result.modules.onAuthStateChanged(result.auth, callback);
    }
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function signInWithGoogle() {
  const result = await getFirebaseAuth();
  if (!result) throw new Error('Firebase Auth ยังไม่ได้ตั้งค่า (ตรวจสอบ NEXT_PUBLIC_FIREBASE_API_KEY)');
  const provider = new result.modules.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await result.modules.signInWithPopup(result.auth, provider);
  } catch (popupError: unknown) {
    const err = popupError as { code?: string; message?: string };
    if (err?.code === 'auth/unauthorized-domain') {
      throw new Error(
        'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase (auth/unauthorized-domain): กรุณาเพิ่มโดเมนของ Vercel ใน Firebase Console > Authentication > Settings > Authorized domains',
      );
    }
    if (err?.code === 'auth/popup-blocked') {
      return await result.modules.signInWithRedirect(result.auth, provider);
    }
    throw popupError;
  }
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
