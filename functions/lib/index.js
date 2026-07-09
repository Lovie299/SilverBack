"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAIChatSession = exports.syncUserRoleClaim = exports.onCriticalReport = exports.onBoundaryBreach = exports.onSnareReported = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const v2_1 = require("firebase-functions/v2");
const expo_server_sdk_1 = require("expo-server-sdk");
const helpers_1 = require("@turf/helpers");
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const distance_1 = __importDefault(require("@turf/distance"));
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const expo = new expo_server_sdk_1.Expo();
/* ========================================================================== *
 * Secrets
 * ========================================================================== */
/**
 * The OpenRouter key formerly shipped to clients as EXPO_PUBLIC_OPENROUTER_KEY
 * now lives ONLY here, server-side, as a Cloud Functions secret.
 */
const OPENROUTER_API_KEY = (0, params_1.defineSecret)('OPENROUTER_API_KEY');
const AT_API_KEY = (0, params_1.defineSecret)('AT_API_KEY');
const AT_USERNAME = (0, params_1.defineSecret)('AT_USERNAME');
const AT_SENDER_ID = (0, params_1.defineSecret)('AT_SENDER_ID');
/* ========================================================================== *
 * Park boundary (must stay in sync with lib/geo.ts BWINDI_PARK_POLYGON)
 * ========================================================================== */
/** GeoJSON positions: [longitude, latitude]. Ring is closed explicitly. */
const BWINDI_RING = [
    [29.575, -0.99],
    [29.6, -0.885],
    [29.685, -0.85],
    [29.77, -0.93],
    [29.775, -1.06],
    [29.7, -1.125],
    [29.6, -1.09],
    [29.575, -0.99],
];
const BWINDI_POLYGON = (0, helpers_1.polygon)([BWINDI_RING]);
/** Radius (km) around an incident within which users receive push alerts. */
const ALERT_GRID_RADIUS_KM = 5;
/**
 * Finds users whose last known location falls inside the affected grid area
 * (ALERT_GRID_RADIUS_KM around the incident). Optionally restricted by role.
 *
 * Firestore has no native radius queries, so we pull candidates that have a
 * location on file and filter with Turf — fine at community scale; swap in
 * geohash range queries if the user base grows past a few thousand.
 */
async function collectNearbyRecipients(center, roles) {
    const snapshot = await db
        .collection('users')
        .orderBy('lastKnownLocation') // presence filter: only users with a location
        .get();
    const origin = (0, helpers_1.point)([center.longitude, center.latitude]);
    const recipients = [];
    for (const docSnap of snapshot.docs) {
        const user = docSnap.data();
        if (roles !== null && !roles.includes(user.role))
            continue;
        if (user.lastKnownLocation === undefined)
            continue;
        const km = (0, distance_1.default)(origin, (0, helpers_1.point)([user.lastKnownLocation.longitude, user.lastKnownLocation.latitude]), { units: 'kilometers' });
        if (km > ALERT_GRID_RADIUS_KM)
            continue;
        recipients.push({
            uid: docSnap.id,
            role: user.role,
            pushToken: typeof user.pushToken === 'string' ? user.pushToken : null,
            phoneNumber: typeof user.phoneNumber === 'string' ? user.phoneNumber : null,
        });
    }
    return recipients;
}
/**
 * Batch-sends push notifications through the Expo Push API.
 * `expo.chunkPushNotifications` splits into API-safe chunks (100/request);
 * chunks are dispatched sequentially so a single failure can't sink the run.
 */
async function sendExpoPush(tokens, payload) {
    const messages = tokens
        .filter((token) => expo_server_sdk_1.Expo.isExpoPushToken(token))
        .map((token) => ({
        to: token,
        sound: 'default',
        priority: 'high',
        title: payload.title,
        body: payload.body,
        data: payload.data,
    }));
    if (messages.length === 0)
        return 0;
    let delivered = 0;
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            delivered += tickets.filter((t) => t.status === 'ok').length;
            for (const ticket of tickets) {
                if (ticket.status === 'error') {
                    v2_1.logger.warn('Expo push ticket error', {
                        message: ticket.message,
                        details: ticket.details,
                    });
                }
            }
        }
        catch (error) {
            v2_1.logger.error('Expo push chunk failed', { error: String(error) });
        }
    }
    return delivered;
}
/**
 * Sends a critical SMS blast via the Africa's Talking bulk SMS REST endpoint.
 * Called with the community phone numbers gathered by collectNearbyRecipients.
 */
async function sendCriticalSms(phoneNumbers, message) {
    if (phoneNumbers.length === 0)
        return 0;
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
        v2_1.logger.error("Africa's Talking dispatch failed", {
            status: response.status,
            body: await response.text(),
        });
        return 0;
    }
    const json = (await response.json());
    const recipients = json.SMSMessageData?.Recipients ?? [];
    const sent = recipients.filter((r) => r.statusCode === 101 || r.statusCode === 100).length;
    v2_1.logger.info("Africa's Talking dispatch complete", {
        requested: phoneNumbers.length,
        sent,
    });
    return sent;
}
/* ========================================================================== *
 * Trigger 1: onSnareReported
 * ========================================================================== */
exports.onSnareReported = (0, firestore_2.onDocumentCreated)({
    document: 'snares/{snareId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
}, async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined) {
        v2_1.logger.warn('onSnareReported fired without a snapshot');
        return;
    }
    const snare = snapshot.data();
    if (snare.status !== 'active')
        return;
    // Rangers and admins in the affected grid get an immediate push.
    const recipients = await collectNearbyRecipients(snare.coordinate, [
        'ranger',
        'admin',
    ]);
    const tokens = recipients
        .map((r) => r.pushToken)
        .filter((t) => t !== null);
    const delivered = await sendExpoPush(tokens, {
        title: '⚠️ Active snare reported',
        body: `A snare was discovered near ${snare.coordinate.latitude.toFixed(4)}, ${snare.coordinate.longitude.toFixed(4)}. Open the map for the exact location.`,
        data: { kind: 'snare', snareId: event.params.snareId },
    });
    v2_1.logger.info('Snare alert dispatched', {
        snareId: event.params.snareId,
        recipients: recipients.length,
        delivered,
    });
});
/* ========================================================================== *
 * Trigger 2: onBoundaryBreach
 * ========================================================================== */
exports.onBoundaryBreach = (0, firestore_2.onDocumentCreated)({
    document: 'trackingEvents/{eventId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
}, async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined)
        return;
    const fix = snapshot.data();
    // Turf.js point-in-polygon: only fixes OUTSIDE the park are breaches.
    const inside = (0, boolean_point_in_polygon_1.default)((0, helpers_1.point)([fix.coordinate.longitude, fix.coordinate.latitude]), BWINDI_POLYGON);
    if (inside)
        return;
    v2_1.logger.info('Boundary breach detected', {
        animalId: fix.animalId,
        species: fix.species,
    });
    // Everyone in the affected grid — community members are the ones at risk.
    const recipients = await collectNearbyRecipients(fix.coordinate, null);
    const tokens = recipients
        .map((r) => r.pushToken)
        .filter((t) => t !== null);
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
        .filter((n) => n !== null);
    await sendCriticalSms(phoneNumbers, `SILVERBACK SENTRY ALERT: ${fix.species.replace(/_/g, ' ')} sighted outside the park near your village. Stay alert and report sightings.`);
});
/* ========================================================================== *
 * Trigger 3: onCriticalReport (severe crop-raiding / human injury → SMS)
 * ========================================================================== */
exports.onCriticalReport = (0, firestore_2.onDocumentCreated)({
    document: 'reports/{reportId}',
    region: 'europe-west1',
    secrets: [AT_API_KEY, AT_USERNAME, AT_SENDER_ID],
}, async (event) => {
    const snapshot = event.data;
    if (snapshot === undefined)
        return;
    const report = snapshot.data();
    const isCritical = report.severity === 'critical' ||
        (report.severity === 'high' &&
            (report.type === 'crop_raiding' || report.type === 'human_injury'));
    if (!isCritical)
        return;
    const recipients = await collectNearbyRecipients(report.coordinate, null);
    const tokens = recipients
        .map((r) => r.pushToken)
        .filter((t) => t !== null);
    const phoneNumbers = recipients
        .map((r) => r.phoneNumber)
        .filter((n) => n !== null);
    const label = report.type.replace(/_/g, ' ');
    // Push and SMS run concurrently — neither channel should wait on the other.
    const [delivered, smsSent] = await Promise.all([
        sendExpoPush(tokens, {
            title: `🚨 Critical incident: ${label}`,
            body: 'A critical incident was reported in your area. Open SilverBack Sentry for details.',
            data: { kind: 'critical_report', reportId: event.params.reportId },
        }),
        sendCriticalSms(phoneNumbers, `SILVERBACK SENTRY ALERT: critical ${label} incident reported near your area. Rangers have been notified.`),
    ]);
    v2_1.logger.info('Critical report alerts dispatched', {
        reportId: event.params.reportId,
        push: delivered,
        sms: smsSent,
    });
});
/* ========================================================================== *
 * Trigger 4: syncUserRoleClaim
 * ========================================================================== */
/**
 * Mirrors `users/{uid}.role` into the user's custom auth claims so that
 * firestore.rules can evaluate `request.auth.token.role` without extra reads.
 * Role changes therefore only take effect via this privileged path — clients
 * cannot self-escalate (see firestore.rules).
 */
exports.syncUserRoleClaim = (0, firestore_2.onDocumentWritten)({ document: 'users/{uid}', region: 'europe-west1' }, async (event) => {
    const after = event.data?.after;
    if (after === undefined || !after.exists)
        return;
    const user = after.data();
    const uid = event.params.uid;
    const before = event.data?.before;
    const previousRole = before?.exists ? before.data().role : null;
    if (previousRole === user.role)
        return; // no change, skip the Auth write
    await (0, auth_1.getAuth)().setCustomUserClaims(uid, { role: user.role });
    v2_1.logger.info('Custom role claim synced', { uid, role: user.role });
});
const OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
/** Runtime validation — callable payloads arrive untyped from the wire. */
function parseChatRequest(raw) {
    if (typeof raw !== 'object' || raw === null) {
        throw new https_1.HttpsError('invalid-argument', 'Request body must be an object.');
    }
    const candidate = raw;
    if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'messages must be a non-empty array.');
    }
    const messages = candidate.messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((entry) => {
        const msg = entry;
        if ((msg.role !== 'user' && msg.role !== 'assistant') ||
            typeof msg.content !== 'string' ||
            msg.content.length === 0 ||
            msg.content.length > MAX_MESSAGE_LENGTH) {
            throw new https_1.HttpsError('invalid-argument', 'Malformed chat message.');
        }
        return { role: msg.role, content: msg.content };
    });
    const language = typeof candidate.language === 'string' ? candidate.language : 'en';
    return { messages, language };
}
/** System prompt anchoring the assistant as a Bwindi conservation guide. */
function buildSystemPrompt(language) {
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
exports.handleAIChatSession = (0, https_1.onCall)({
    region: 'europe-west1',
    secrets: [OPENROUTER_API_KEY],
    enforceAppCheck: false, // enable once App Check is rolled out to clients
}, async (request) => {
    // Only signed-in users may consume paid LLM quota.
    if (request.auth === undefined) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in to use the AI guide.');
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
        v2_1.logger.error('OpenRouter request failed', {
            status: response.status,
            body: await response.text(),
        });
        throw new https_1.HttpsError('unavailable', 'The AI guide is temporarily unavailable.');
    }
    const completion = (await response.json());
    const reply = completion.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || reply.length === 0) {
        v2_1.logger.error('OpenRouter returned an empty completion', {
            error: completion.error?.message,
        });
        throw new https_1.HttpsError('internal', 'The AI guide returned an empty response.');
    }
    return { reply, model: completion.model ?? OPENROUTER_MODEL };
});
//# sourceMappingURL=index.js.map