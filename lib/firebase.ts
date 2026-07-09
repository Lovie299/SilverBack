/**
 * lib/firebase.ts
 * ---------------------------------------------------------------------------
 * Single source of truth for Firebase client initialization.
 *
 * - Config is read from EXPO_PUBLIC_* environment variables (inlined by the
 *   Expo bundler — they MUST be referenced statically, never via a dynamic
 *   `process.env[key]` lookup).
 * - Firestore is configured for offline-first operation: persistent local
 *   cache where the platform supports it (web/IndexedDB), with an in-memory
 *   cache fallback on native. On native, queued writes additionally survive
 *   restarts via the media/data queue in lib/sync.ts.
 * - Auth state persists across app restarts through AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { Auth, getAuth, initializeAuth, Persistence } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

/* ========================================================================== *
 * Environment configuration
 * ========================================================================== */

/**
 * EXPO_PUBLIC_* variables are substituted at bundle time, so each one must be
 * written out literally. `.env` example:
 *
 *   EXPO_PUBLIC_FIREBASE_API_KEY=...
 *   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
 *   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
 *   EXPO_PUBLIC_FIREBASE_APP_ID=...
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
} as const;

/** Fail fast at startup instead of surfacing cryptic SDK errors later. */
function assertConfigComplete(config: typeof firebaseConfig): void {
  const missing = (Object.keys(config) as Array<keyof typeof config>).filter(
    (key) => config[key].length === 0,
  );
  if (missing.length > 0) {
    throw new Error(
      `[firebase] Missing environment configuration for: ${missing.join(', ')}. ` +
        'Check your .env file — every key must use the EXPO_PUBLIC_FIREBASE_ prefix.',
    );
  }
}

assertConfigComplete(firebaseConfig);

/* ========================================================================== *
 * App (guard against double-init during Fast Refresh)
 * ========================================================================== */

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/* ========================================================================== *
 * Auth — AsyncStorage-backed persistence on native
 * ========================================================================== */

/** Structural subset of AsyncStorage required by the RN persistence layer. */
interface AsyncStorageLike {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

/**
 * `getReactNativePersistence` only exists in the React Native bundle of
 * firebase/auth (which Metro resolves at runtime); the published web typings
 * omit it, so it is pulled off the namespace with a structural cast instead
 * of a named import that would fail type-checking.
 */
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence(storage: AsyncStorageLike): Persistence;
  }
).getReactNativePersistence;

function createAuth(firebaseApp: FirebaseApp): Auth {
  if (Platform.OS === 'web' || typeof getReactNativePersistence !== 'function') {
    // Browser persistence (localStorage/indexedDB) is the SDK default on web.
    return getAuth(firebaseApp);
  }
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if called twice for the same app (Fast Refresh);
    // the already-initialized instance is returned instead.
    return getAuth(firebaseApp);
  }
}

/* ========================================================================== *
 * Firestore — offline-first local cache
 * ========================================================================== */

function createFirestore(firebaseApp: FirebaseApp): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      // Durable multi-tab persistent cache. Fully supported on web; on native
      // the JS SDK falls through to the catch below because IndexedDB is
      // unavailable there.
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      // Zero-connectivity forest context: WebChannel streaming is flaky on
      // some Android network stacks; auto-detected long polling degrades
      // gracefully when the stream cannot be established.
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    try {
      // Native fallback: memory cache still gives full offline mutation
      // queueing for the lifetime of the process; cross-restart durability of
      // pending media/data is handled by lib/sync.ts.
      return initializeFirestore(firebaseApp, {
        localCache: memoryLocalCache(),
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      // Both initializeFirestore calls throw only when Firestore has already
      // been initialized for this app (Fast Refresh) — reuse that instance.
      return getFirestore(firebaseApp);
    }
  }
}

/* ========================================================================== *
 * Exports
 * ========================================================================== */

export const auth: Auth = createAuth(app);
export const db: Firestore = createFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;
