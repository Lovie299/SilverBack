/**
 * lib/sync.ts
 * ---------------------------------------------------------------------------
 * Offline media & data synchronization queue.
 *
 * Firestore's local cache transparently queues *text* mutations, but it cannot
 * hold binary payloads (photos from expo-image-picker, voice notes from
 * expo-audio). This module bridges that gap:
 *
 *   1. `enqueueMediaUpload()` copies the binary into an app-owned directory
 *      (expo-file-system) and records queue metadata in AsyncStorage, so the
 *      pending upload survives app restarts and OS cache eviction.
 *   2. A NetInfo listener watches connectivity; the moment the device comes
 *      back online, `flushPendingQueue()` fires automatically.
 *   3. The flush uploads each file to Firebase Storage, resolves its download
 *      URL, patches the owning Firestore document, and finally notifies any
 *      registered RefreshControl listeners so pull-to-refresh UIs update.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Directory, File, Paths } from 'expo-file-system';
import {
  arrayUnion,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import uuid from 'react-native-uuid';

import { db, storage } from './firebase';
import type {
  MediaTargetCollection,
  MediaTargetField,
  PendingMediaUpload,
} from './types';

/* ========================================================================== *
 * Constants & module state
 * ========================================================================== */

/** AsyncStorage key holding the serialized queue metadata. */
const QUEUE_STORAGE_KEY = '@silverback/pending-media-queue';

/** Give up on an individual item after this many failed attempts. */
const MAX_ATTEMPTS = 8;

/** App-owned directory where queued binaries live until uploaded. */
const queueDirectory = new Directory(Paths.document, 'sync-queue');

/** Callback signature for pull-to-refresh / UI invalidation listeners. */
export type RefreshListener = () => void;

const refreshListeners = new Set<RefreshListener>();

/** Re-entrancy guard: only one flush may run at a time. */
let flushInFlight: Promise<FlushResult> | null = null;

/** NetInfo subscription teardown, kept so initSyncEngine is idempotent. */
let netInfoUnsubscribe: (() => void) | null = null;

/** Result summary returned by flushPendingQueue(). */
export interface FlushResult {
  uploaded: number;
  failed: number;
  remaining: number;
}

/* ========================================================================== *
 * Queue persistence helpers (AsyncStorage)
 * ========================================================================== */

async function readQueue(): Promise<PendingMediaUpload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingMediaUpload[]) : [];
  } catch {
    // Corrupt queue metadata — reset rather than crash the sync engine.
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    return [];
  }
}

async function writeQueue(queue: PendingMediaUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

function ensureQueueDirectory(): void {
  if (!queueDirectory.exists) {
    queueDirectory.create({ intermediates: true });
  }
}

/* ========================================================================== *
 * Public API — enqueue
 * ========================================================================== */

export interface EnqueueMediaParams {
  /** Source file URI from expo-image-picker / expo-audio (cache directory). */
  sourceUri: string;
  /** MIME type of the binary, e.g. 'image/jpeg', 'audio/m4a'. */
  contentType: string;
  /** Collection owning the document that will receive the download URL. */
  targetCollection: MediaTargetCollection;
  /** Document id inside `targetCollection`. */
  targetDocId: string;
  /**
   * Field to patch once uploaded: 'images' is treated as an arrayUnion,
   * 'imageUrl' / 'voiceNoteUrl' as scalar sets.
   */
  targetField: MediaTargetField;
}

/**
 * Copies the media file into durable app storage and registers it in the
 * upload queue. If the device is currently online the queue is flushed
 * immediately; otherwise the NetInfo listener flushes it on reconnection.
 */
export async function enqueueMediaUpload(
  params: EnqueueMediaParams,
): Promise<PendingMediaUpload> {
  ensureQueueDirectory();

  const id = uuid.v4() as string;
  const extension = params.sourceUri.split('.').pop() ?? 'bin';
  const queuedFile = new File(queueDirectory, `${id}.${extension}`);

  // Copy out of the picker/recorder cache — the OS may purge cache files
  // long before connectivity returns in the forest.
  new File(params.sourceUri).copy(queuedFile);

  const entry: PendingMediaUpload = {
    id,
    localUri: queuedFile.uri,
    storagePath: `${params.targetCollection}/${params.targetDocId}/${id}.${extension}`,
    contentType: params.contentType,
    targetCollection: params.targetCollection,
    targetDocId: params.targetDocId,
    targetField: params.targetField,
    createdAt: Date.now(),
    attempts: 0,
  };

  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);

  // Opportunistic immediate flush when we already have connectivity.
  const state = await NetInfo.fetch();
  if (isOnline(state)) {
    void flushPendingQueue();
  }

  return entry;
}

/* ========================================================================== *
 * Public API — flush
 * ========================================================================== */

/**
 * Background sync processor. Uploads every queued binary to Firebase Storage,
 * resolves download URLs, patches the owning Firestore documents, and pings
 * registered refresh listeners. Safe to call repeatedly — concurrent calls
 * coalesce onto the in-flight run.
 */
export function flushPendingQueue(): Promise<FlushResult> {
  if (flushInFlight !== null) return flushInFlight;

  flushInFlight = doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { uploaded: 0, failed: 0, remaining: 0 };

  const survivors: PendingMediaUpload[] = [];
  let uploaded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await uploadQueueItem(item);
      uploaded += 1;
      // Binary delivered — remove the durable local copy.
      deleteLocalFileSafe(item.localUri);
    } catch (error) {
      failed += 1;
      const attempts = item.attempts + 1;
      if (attempts < MAX_ATTEMPTS) {
        survivors.push({ ...item, attempts });
      } else {
        // Poison item: drop it so it cannot block the rest of the queue.
        console.warn(
          `[sync] Dropping upload ${item.id} after ${attempts} failed attempts`,
          error,
        );
        deleteLocalFileSafe(item.localUri);
      }
    }
  }

  await writeQueue(survivors);

  if (uploaded > 0) notifyRefreshListeners();

  return { uploaded, failed, remaining: survivors.length };
}

/** Upload one binary, resolve its URL, and patch the owning document. */
async function uploadQueueItem(item: PendingMediaUpload): Promise<void> {
  const file = new File(item.localUri);
  if (!file.exists) {
    throw new Error(`[sync] Queued file missing on disk: ${item.localUri}`);
  }

  // fetch() on a file:// URI yields a Blob in React Native — the supported
  // path for handing local binaries to the Firebase JS SDK.
  const response = await fetch(item.localUri);
  const blob = await response.blob();

  const storageRef = ref(storage, item.storagePath);
  await uploadBytes(storageRef, blob, { contentType: item.contentType });
  const downloadUrl = await getDownloadURL(storageRef);

  const targetDoc = doc(db, item.targetCollection, item.targetDocId);
  if (item.targetField === 'images') {
    await updateDoc(targetDoc, {
      images: arrayUnion(downloadUrl),
      syncedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(targetDoc, {
      [item.targetField]: downloadUrl,
      syncedAt: serverTimestamp(),
    });
  }
}

function deleteLocalFileSafe(localUri: string): void {
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // Non-fatal: orphaned files are re-checked on the next enqueue.
  }
}

/* ========================================================================== *
 * Public API — connectivity engine & refresh listeners
 * ========================================================================== */

function isOnline(state: NetInfoState): boolean {
  // isInternetReachable can be null while probing; treat "connected but
  // unverified" as online so the flush attempt itself becomes the probe.
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Starts the connectivity listener. Call once at app bootstrap (e.g. in the
 * root layout). Returns a teardown function; calling init twice is a no-op.
 */
export function initSyncEngine(): () => void {
  if (netInfoUnsubscribe !== null) return netInfoUnsubscribe;

  let wasOnline = false;
  netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const online = isOnline(state);
    // Fire only on the offline → online transition edge.
    if (online && !wasOnline) {
      void flushPendingQueue();
    }
    wasOnline = online;
  });

  return () => {
    netInfoUnsubscribe?.();
    netInfoUnsubscribe = null;
  };
}

/**
 * Registers a callback invoked after every successful flush — wire this to
 * the screen's RefreshControl / query invalidation so freshly-synced media
 * appears without a manual reload. Returns an unsubscribe function.
 */
export function registerRefreshListener(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

function notifyRefreshListeners(): void {
  for (const listener of refreshListeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[sync] Refresh listener threw', error);
    }
  }
}

/** Read-only snapshot of the queue, for badge counts / diagnostics screens. */
export async function getPendingQueue(): Promise<readonly PendingMediaUpload[]> {
  return readQueue();
}
