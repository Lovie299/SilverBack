/**
 * lib/types.ts
 * ---------------------------------------------------------------------------
 * Canonical, strictly-typed data models for SilverBack Sentry.
 *
 * Every Firestore read/write in the app MUST go through these types.
 * Geospatial coordinates are always stored as native Firestore `GeoPoint`s
 * so that server-side (Cloud Functions / Turf.js) and client-side code agree
 * on a single wire format.
 */

import type { GeoPoint, Timestamp } from 'firebase/firestore';

/* ========================================================================== *
 * Controlled vocabularies
 * ========================================================================== */

/** Every account in the system holds exactly one role. */
export type UserRole = 'community' | 'ranger' | 'tourist' | 'admin';

/** Species observable around Bwindi Impenetrable National Park. */
export type Species =
  | 'mountain_gorilla'
  | 'african_elephant'
  | 'bushpig'
  | 'monkey'
  | 'antelope'
  | 'other';

/** Escalation severity attached to human–wildlife conflict reports. */
export type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Categories of human–wildlife conflict incidents. */
export type ReportType =
  | 'crop_raiding'
  | 'livestock_predation'
  | 'dangerous_sighting'
  | 'human_injury';

/** Lifecycle of a conflict report as rangers act on it. */
export type ReportStatus = 'pending' | 'investigating' | 'resolved';

/** Lifecycle of a discovered snare. */
export type SnareStatus = 'active' | 'deactivated';

/**
 * Local persistence state of any record created on-device.
 * - 'pending'  → written to the local cache only (offline)
 * - 'syncing'  → media upload / server write in flight
 * - 'synced'   → confirmed on the server
 */
export type SyncStatus = 'pending' | 'syncing' | 'synced';

/* ========================================================================== *
 * User session & roles
 * ========================================================================== */

/** Fields shared by every user profile document (`users/{uid}`). */
interface BaseUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  syncStatus: SyncStatus;
  /** Expo push token registered for this device, if notifications enabled. */
  pushToken?: string;
  /** Last reported device position — used by Cloud Functions to target alerts. */
  lastKnownLocation?: GeoPoint;
  /** E.164 phone number used for critical SMS dispatch (Africa's Talking). */
  phoneNumber?: string;
}

/** Community members must register with their national ID. */
export interface CommunityUserProfile extends BaseUserProfile {
  role: 'community';
  nationalId: string;
}

/** Rangers carry both a national ID and a UWA-issued ranger ID. */
export interface RangerUserProfile extends BaseUserProfile {
  role: 'ranger';
  nationalId: string;
  rangerId: string;
}

/** Tourists register with a permit/tourist ID instead of a national ID. */
export interface TouristUserProfile extends BaseUserProfile {
  role: 'tourist';
  touristId: string;
}

/** Admins have no extra identity fields; privileges come from custom claims. */
export interface AdminUserProfile extends BaseUserProfile {
  role: 'admin';
}

/**
 * Discriminated union over `role` — narrowing on `profile.role` gives you
 * compile-time access to the correct role-specific fields.
 */
export type UserProfile =
  | CommunityUserProfile
  | RangerUserProfile
  | TouristUserProfile
  | AdminUserProfile;

/* ========================================================================== *
 * Core collections
 * ========================================================================== */

/** `sightings/{id}` — wildlife observation logged by any authenticated user. */
export interface Sighting {
  id: string;
  reporterId: string;
  species: Species;
  coordinate: GeoPoint;
  timestamp: Timestamp;
  notes: string;
  /** Firebase Storage download URLs (populated after offline queue flush). */
  images: string[];
  /** Set by the sync engine once the record is confirmed server-side. */
  syncedAt: Timestamp | null;
}

/** `reports/{id}` — human–wildlife conflict incident report. */
export interface ConflictReport {
  id: string;
  reporterId: string;
  type: ReportType;
  severity: ReportSeverity;
  coordinate: GeoPoint;
  /** Storage URL of an `expo-audio` recording, once uploaded. */
  voiceNoteUrl?: string;
  /** Storage URL of an `expo-image-picker` photo, once uploaded. */
  imageUrl?: string;
  timestamp: Timestamp;
  isArchived: boolean;
  status: ReportStatus;
}

/** `snares/{id}` — poaching snare discovery (ranger/admin writable only). */
export interface Snare {
  id: string;
  discoveredBy: string;
  coordinate: GeoPoint;
  status: SnareStatus;
  timestamp: Timestamp;
}

/** `certifications/{id}` — tourist/guide quiz certification record. */
export interface Certification {
  userId: string;
  quizId: string;
  score: number;
  passed: boolean;
  certifiedUntil: Timestamp;
}

/* ========================================================================== *
 * Client → server payloads (documents before Firestore assigns metadata)
 * ========================================================================== */

/** Payload used when creating a sighting locally (id assigned client-side). */
export type NewSighting = Omit<Sighting, 'syncedAt'> & { syncedAt: null };

/** Payload used when creating a conflict report locally. */
export type NewConflictReport = Omit<ConflictReport, 'isArchived' | 'status'> & {
  isArchived: false;
  status: 'pending';
};

/* ========================================================================== *
 * AI chat (handleAIChatSession callable) shared contract
 * ========================================================================== */

/** A single turn in the Bwindi Conservation Guide conversation. */
export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Request body sent to the `handleAIChatSession` callable function. */
export interface AIChatRequest {
  messages: AIChatMessage[];
  /** BCP-47 language tag for localized fallback translations (e.g. 'rw', 'en'). */
  language: string;
}

/** Response body returned by the `handleAIChatSession` callable function. */
export interface AIChatResponse {
  reply: string;
  model: string;
}

/* ========================================================================== *
 * Offline sync queue (see lib/sync.ts)
 * ========================================================================== */

/** Collections whose documents can carry queued media attachments. */
export type MediaTargetCollection = 'sightings' | 'reports';

/** Document fields that receive an uploaded media URL. */
export type MediaTargetField = 'images' | 'imageUrl' | 'voiceNoteUrl';

/** One queued binary upload awaiting connectivity. */
export interface PendingMediaUpload {
  /** Stable queue-entry id (uuid). */
  id: string;
  /** file:// URI inside the app-owned sync-queue directory. */
  localUri: string;
  /** Destination object path in Firebase Storage. */
  storagePath: string;
  /** MIME type, e.g. 'image/jpeg' or 'audio/m4a'. */
  contentType: string;
  targetCollection: MediaTargetCollection;
  targetDocId: string;
  targetField: MediaTargetField;
  /** Epoch millis when the item was enqueued. */
  createdAt: number;
  /** Number of failed flush attempts so far. */
  attempts: number;
}
