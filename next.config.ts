import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
      process.env.VITE_FIREBASE_AUTH_DOMAIN ??
      'tef-inventory-bib.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      process.env.VITE_FIREBASE_PROJECT_ID ??
      'tef-inventory-bib',
    NEXT_PUBLIC_FIREBASE_APP_ID:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
      process.env.VITE_FIREBASE_APP_ID ??
      '1:970198541323:web:1f36afe8347c9d2184930e',
    NEXT_PUBLIC_FORCE_FIREBASE_AUTH:
      process.env.NEXT_PUBLIC_FORCE_FIREBASE_AUTH ??
      process.env.VITE_FORCE_FIREBASE_AUTH,
  },
};

export default nextConfig;
