/**
 * functions/src/index.ts
 * ---------------------------------------------------------------------------
 * SilverBack Sentry — serverless backend (Firebase Cloud Functions v2).
 *
 * Exported functions:
 *   - onSnareReported     Firestore trigger → push alerts to nearby rangers
 *   - onBoundaryBreach    Firestore trigger → Turf.js park-exit detection
 *   - onCriticalReport    Firestore trigger → push + Africa's Talking SMS
 *   - handleAIChatSession HTTPS callable   → secure OpenRouter proxy
 *   - syncUserRoleClaim   Firestore trigger → mirrors profile role into
 *                         custom auth claims so firestore.rules can read it
 *
 * Secrets (set with `firebase functions:secrets:set <NAME>`):
 *   OPENROUTER_API_KEY, AT_API_KEY, AT_USERNAME, AT_SENDER_ID
 */

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { point, polygon } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import distance from '@turf/distance';

initializeApp();
const db = getFirestore();
const expo = new Expo();

/* ========================================================================== *
 * Secrets
 * ========================================================================== */

/**
 * The OpenRouter key formerly shipped to clients as EXPO_PUBLIC_OPENROUTER_KEY
 * now lives ONLY here, server-side, as a Cloud Functions secret.
 */
const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');
const AT_API_KEY = defineSecret('AT_API_KEY');
const AT_USERNAME = defineSecret('AT_USERNAME');
const AT_SENDER_ID = defineSecret('AT_SENDER_ID');

/* ========================================================================== *
 * Shared domain types (server-side mirror of lib/types.ts)
 * ========================================================================== */

type UserRole = 'community' | 'ranger' | 'tourist' | 'admin';
type ReportSeverity = 'low' | 'medium' | 'high' | 'critical';
type ReportType =
  | 'crop_raiding'
  | 'livestock_predation'
  | 'dangerous_sighting'
  | 'human_injury';

interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  pushToken?: string;
  lastKnownLocation?: GeoPoint;
  phoneNumber?: string;
}

interface SnareDoc {
  discoveredBy: string;
  coordinate: GeoPoint;
  status: 'active' | 'deactivated';
  timestamp: Timestamp;
}

interface ReportDoc {
  reporterId: string;
  type: ReportType;
  severity: ReportSeverity;
  coordinate: GeoPoint;
  timestamp: Timestamp;
}

/** `trackingEvents/{id}` — GPS fixes streamed from collared-animal ingest. */
interface TrackingEventDoc {
  animalId: string;
  species: string;
  coordinate: GeoPoint;
  timestamp: Timestamp;
}

/* ========================================================================== *
 * Park boundary (must stay in sync with lib/geo.ts BWINDI_PARK_POLYGON)
 * ========================================================================== */

/** GeoJSON positions: [longitude, latitude]. Ring is closed explicitly. */
const BWINDI_RING: [number, number][] = [
  [29.575, -0.99],
  [29.6, -0.885],
  [29.685, -0.85],
  [29.77, -0.93],
  [29.775, -1.06],
  [29.7, -1.125],
  [29.6, -1.09],
  [29.575, -0.99],
];
const BWINDI_POLYGON = polygon([BWINDI_RING]);

/** Radius (km) around an incident within which users receive push alerts. */
const ALERT_GRID_RADIUS_KM = 5;

/* ========================================================================== *
 * Recipient targeting
 * ========================================================================== */

interface AlertRecipient {
  uid: string;
  role: UserRole;
  pushToken: string | null;
  phoneNumber: string | null;
}

/**
 * Finds users whose last known location falls inside the affected grid area
 * (ALERT_GRID_RADIUS_KM around the incident). Optionally restricted by role.
 *
 * Firestore has no native radius queries, so we pull candidates that have a
 * location on file and filter with Turf — fine at community scale; swap in
 * geohash range queries if the user base grows past a few thousand.
 */
async function collectNearbyRecipients(
  center: GeoPoint,
  roles: readonly UserRole[] | null,
): Promise<AlertRecipient[]> {
  const snapshot = await db
    .collection('users')
    .orderBy('lastKnownLocation') // presence filter: only users with a location
    .get();

  const origin = point([center.longitude, center.latitude]);
  const recipients: AlertRecipient[] = [];

  for (const docSnap of snapshot.docs) {
    const user = docSnap.data() as UserDoc;
    if (roles !== null && !roles.includes(user.role)) continue;
    if (user.lastKnownLocation === undefined) continue;

    const km = distance(
      origin,
      point([user.lastKnownLocation.longitude, user.lastKnownLocation.latitude]),
      { units: 'kilometers' },
    );
    if (km > ALERT_GRID_RADIUS_KM) continue;

    recipients.push({
      uid: docSnap.id,
      role: user.role,
      pushToken: typeof user.pushToken === 'string' ? user.pushToken : null,
      phoneNumber: typeof user.phoneNumber === 'string' ? user.phoneNumber : null,
    });
  }
  return recipients;
}

/* ========================================================================== *
 * Expo push delivery (chunked)
 * ========================================================================== */

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

/**
 * Batch-sends push notifications through the Expo Push API.
 * `expo.chunkPushNotifications` splits into API-safe chunks (100/request);
 * chunks are dispatched sequentially so a single failure can't sink the run.
 */
async function sendExpoPush(
  tokens: readonly string[],
  payload: PushPayload,
): Promise<number> {
  const messages: ExpoPushMessage[] = tokens
    .filter((token) => Expo.isExpoPushToken(token))
    .map((token) => ({
      to: token,
      sound: 'default',
      priority: 'high',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

  if (messages.length === 0) return 0;

  let delivered = 0;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
      delivered += tickets.filter((t) => t.status === 'ok').length;
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          logger.warn('Expo push ticket error', {
            message: ticket.message,
            details: ticket.details,
          });
        }
      }
    } catch (error) {
      logger.error('Expo push chunk failed', { error: String(error) });
    }
  }
  return delivered;
}

/* ========================================================================== *
 * Africa's Talking SMS dispatch
 * ========================================================================== */

interface AfricasTalkingRecipient {
  number: string;
  status: string;
  statusCode: number;
}

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricasTalkingRecipient[];
  };
}

/**
 * Sends a critical SMS blast via the Africa's Talking bulk SMS REST endpoint.
 * Called with the community phone numbers gathered by collectNearbyRecipients.
 */
async function sendCriticalSms(
  phoneNumbers: readonly string[],
  message: string,
): Promise<number> {
  if (phoneNumbers.length === 0) return 0;

  const body = new URLSearchParams({
    username: AT_USERNAME.value(),
    to: phoneNumbers.join(','),
    message,
    from: AT_SENDER_ID.value(),
  });

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: AT_API_KEY.value(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    logger.error("Africa's Talking dispatch failed", {
      status: response.status,
      body: await response.text(),
    });
    return 0;
  }

  const json = (await response.json()) as AfricasTalkingResponse;
  const recipients = json.SMSMessageData?.Recipients ?? [];
  const sent = recipients.filter((r) => r.statusCode === 101 || r.statusCode === 100).length;
  logger.info("Africa's Talking dispatch complete", {
    requested: phoneNumbers.length,
    sent,
  });
  return sent;
}

/* ========================================================================== *
 * Trigger 1: onSnareReported
 * ========================================================================== */

export const onSnareReported = onDocumentCreated(
  {
    document: 'snares/{snareId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
  },
  async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined) {
      logger.warn('onSnareReported fired without a snapshot');
      return;
    }
    const snare = snapshot.data() as SnareDoc;
    if (snare.status !== 'active') return;

    // Rangers and admins in the affected grid get an immediate push.
    const recipients = await collectNearbyRecipients(snare.coordinate, [
      'ranger',
      'admin',
    ]);
    const tokens = recipients
      .map((r) => r.pushToken)
      .filter((t): t is string => t !== null);

    const delivered = await sendExpoPush(tokens, {
      title: '⚠️ Active snare reported',
      body: `A snare was discovered near ${snare.coordinate.latitude.toFixed(4)}, ${snare.coordinate.longitude.toFixed(4)}. Open the map for the exact location.`,
      data: { kind: 'snare', snareId: event.params.snareId },
    });

    logger.info('Snare alert dispatched', {
      snareId: event.params.snareId,
      recipients: recipients.length,
      delivered,
    });
  },
);

/* ========================================================================== *
 * Trigger 2: onBoundaryBreach
 * ========================================================================== */

export const onBoundaryBreach = onDocumentCreated(
  {
    document: 'trackingEvents/{eventId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
  },
  async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined) return;
    const fix = snapshot.data() as TrackingEventDoc;

    // Turf.js point-in-polygon: only fixes OUTSIDE the park are breaches.
    const inside = booleanPointInPolygon(
      point([fix.coordinate.longitude, fix.coordinate.latitude]),
      BWINDI_POLYGON,
    );
    if (inside) return;

    logger.info('Boundary breach detected', {
      animalId: fix.animalId,
      species: fix.species,
    });

    // Everyone in the affected grid — community members are the ones at risk.
    const recipients = await collectNearbyRecipients(fix.coordinate, null);
    const tokens = recipients
      .map((r) => r.pushToken)
      .filter((t): t is string => t !== null);

    await sendExpoPush(tokens, {
      title: '🦍 Wildlife outside park boundary',
      body: `A ${fix.species.replace(/_/g, ' ')} has left the park near your area. Keep children and livestock secured.`,
      data: { kind: 'boundary_breach', animalId: fix.animalId },
    });

    // Elephants and gorillas near settlements warrant an SMS fallback for
    // community members without smartphones / data.
    const phoneNumbers = recipients
      .filter((r) => r.role === 'community')
      .map((r) => r.phoneNumber)
      .filter((n): n is string => n !== null);

    await sendCriticalSms(
      phoneNumbers,
      `SILVERBACK SENTRY ALERT: ${fix.species.replace(/_/g, ' ')} sighted outside the park near your village. Stay alert and report sightings.`,
    );
  },
);

/* ========================================================================== *
 * Trigger 3: onCriticalReport (severe crop-raiding / human injury → SMS)
 * ========================================================================== */

export const onCriticalReport = onDocumentCreated(
  {
    document: 'reports/{reportId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
  },
  async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined) return;
    const report = snapshot.data() as ReportDoc;

    const isCritical =
      report.severity === 'critical' ||
      (report.severity === 'high' &&
        (report.type === 'crop_raiding' || report.type === 'human_injury'));
    if (!isCritical) return;

    const recipients = await collectNearbyRecipients(report.coordinate, null);

    const tokens = recipients
      .map((r) => r.pushToken)
      .filter((t): t is string => t !== null);
    const phoneNumbers = recipients
      .map((r) => r.phoneNumber)
      .filter((n): n is string => n !== null);

    const label = report.type.replace(/_/g, ' ');

    // Push and SMS run concurrently — neither channel should wait on the other.
    const [delivered, smsSent] = await Promise.all([
      sendExpoPush(tokens, {
        title: `🚨 Critical incident: ${label}`,
        body: 'A critical incident was reported in your area. Open SilverBack Sentry for details.',
        data: { kind: 'critical_report', reportId: event.params.reportId },
      }),
      sendCriticalSms(
        phoneNumbers,
        `SILVERBACK SENTRY ALERT: critical ${label} incident reported near your area. Rangers have been notified.`,
      ),
    ]);

    logger.info('Critical report alerts dispatched', {
      reportId: event.params.reportId,
      push: delivered,
      sms: smsSent,
    });
  },
);

/* ========================================================================== *
 * Trigger 4: syncUserRoleClaim
 * ========================================================================== */

/**
 * Mirrors `users/{uid}.role` into the user's custom auth claims so that
 * firestore.rules can evaluate `request.auth.token.role` without extra reads.
 * Role changes therefore only take effect via this privileged path — clients
 * cannot self-escalate (see firestore.rules).
 */
export const syncUserRoleClaim = onDocumentWritten(
  { document: 'users/{uid}', region: 'europe-west1' },
  async (event) => {
    const after = event.data?.after;
    if (after === undefined || !after.exists) return;

    const user = after.data() as UserDoc;
    const uid = event.params.uid;

    const before = event.data?.before;
    const previousRole = before?.exists ? (before.data() as UserDoc).role : null;
    if (previousRole === user.role) return; // no change, skip the Auth write

    await getAuth().setCustomUserClaims(uid, { role: user.role });
    logger.info('Custom role claim synced', { uid, role: user.role });
  },
);

/* ========================================================================== *
 * Callable: handleAIChatSession (OpenRouter proxy)
 * ========================================================================== */

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatRequest {
  messages: AIChatMessage[];
  language: string;
}

interface AIChatResponse {
  reply: string;
  model: string;
}

interface OpenRouterChoice {
  message?: { role?: string; content?: string };
}

interface OpenRouterCompletion {
  model?: string;
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

const OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

/** Runtime validation — callable payloads arrive untyped from the wire. */
function parseChatRequest(raw: unknown): AIChatRequest {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Request body must be an object.');
  }
  const candidate = raw as { messages?: unknown; language?: unknown };

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    throw new HttpsError('invalid-argument', 'messages must be a non-empty array.');
  }
  const messages: AIChatMessage[] = candidate.messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry: unknown): AIChatMessage => {
      const msg = entry as { role?: unknown; content?: unknown };
      if (
        (msg.role !== 'user' && msg.role !== 'assistant') ||
        typeof msg.content !== 'string' ||
        msg.content.length === 0 ||
        msg.content.length > MAX_MESSAGE_LENGTH
      ) {
        throw new HttpsError('invalid-argument', 'Malformed chat message.');
      }
      return { role: msg.role, content: msg.content };
    });

  const language = typeof candidate.language === 'string' ? candidate.language : 'en';
  return { messages, language };
}

/** System prompt anchoring the assistant as a Bwindi conservation guide. */
function buildSystemPrompt(language: string): string {
  return [
    'You are the SilverBack Sentry Conservation Guide, a specialized assistant',
    'for communities, rangers, and tourists around Bwindi Impenetrable National',
    'Park, Uganda. You are an expert on mountain gorillas, human–wildlife',
    'conflict mitigation (crop raiding, livestock predation), snare awareness,',
    'park regulations, and safe wildlife-viewing practices.',
    'Give practical, concise, safety-first guidance. Never advise approaching',
    'wildlife. For emergencies, direct users to the in-app report feature and',
    'local ranger posts.',
    `Respond in the language with BCP-47 tag "${language}". If you cannot,`,
    'respond in English followed by a brief simplified summary.',
  ].join(' ');
}

export const handleAIChatSession = onCall<unknown, Promise<AIChatResponse>>(
  {
    region: 'europe-west1',
    secrets: [OPENROUTER_API_KEY],
    enforceAppCheck: false, // enable once App Check is rolled out to clients
  },
  async (request): Promise<AIChatResponse> => {
    // Only signed-in users may consume paid LLM quota.
    if (request.auth === undefined) {
      throw new HttpsError('unauthenticated', 'Sign in to use the AI guide.');
    }

    const chat = parseChatRequest(request.data);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY.value()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://silverbacksentry.lovable.app',
        'X-Title': 'SilverBack Sentry',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(chat.language) },
          ...chat.messages,
        ],
        max_tokens: 1024,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      logger.error('OpenRouter request failed', {
        status: response.status,
        body: await response.text(),
      });
      throw new HttpsError('unavailable', 'The AI guide is temporarily unavailable.');
    }

    const completion = (await response.json()) as OpenRouterCompletion;
    const reply = completion.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || reply.length === 0) {
      logger.error('OpenRouter returned an empty completion', {
        error: completion.error?.message,
      });
      throw new HttpsError('internal', 'The AI guide returned an empty response.');
    }

    return { reply, model: completion.model ?? OPENROUTER_MODEL };
  },
);
