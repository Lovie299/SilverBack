# SilverBack Sentry — Technical Build Guide

*How to build every core functionality in VS Code: the technologies, the concepts behind them, and alternatives.*

This maps the stack in Section 5 of your document to what you actually have to install, understand, and write. For each feature I give: **the concept** (what problem it really is), **the primary tech** (what your doc already chose), **how it fits together**, and **alternatives** if you want to swap something out.

> **Important current-versions note (as of mid-2026):** The Expo/React Native ecosystem moved. Current stable is **Expo SDK 56** on **React Native 0.85 / React 19.2**. From **SDK 55 onward the New Architecture is mandatory** (you can't disable it). Two things this changes for you:
> 1. **Node.js 20.19.4 or newer is required.**
> 2. **Remote push notifications no longer work in Expo Go** (dropped in SDK 53). You need a *development build*. More on this under section 4.3 — it's the single biggest "gotcha" in your whole project, so read that part carefully.

---

## Part 0 — Development Environment (getting VS Code ready)

Before any feature code, you need the toolchain. Do this once.

### 0.1 Install the base tools
| Tool | Why | Notes |
|------|-----|-------|
| **Node.js 20.19.4+** (LTS) | Runs the JS tooling and Metro bundler | Use `nvm` so the whole team is on the same version. RN 0.85 dropped older Node. |
| **Git** | Version control for a 5-person team | You'll need branching discipline — see 0.5 |
| **VS Code** | Your editor | Extensions below |
| **Watchman** (macOS/Linux) | Faster file watching | Optional on Windows |
| **Android Studio** | Android emulator + SDK | Needed for the emulator and for building |
| **Xcode** (macOS only) | iOS simulator | Only if someone on the team has a Mac; not required to build Android |

### 0.2 VS Code extensions worth installing
- **ESLint** + **Prettier** — consistent code across 5 developers (non-negotiable for a team)
- **Expo Tools** (official) — autocomplete for `app.json`, config plugins
- **React Native Tools** (Microsoft)
- **Firebase** extension (or **Firebase Explorer**) — inspect Firestore from the editor
- **GitLens** — see who changed what (useful with a team)
- **Error Lens** — inline error display

### 0.3 Create the project
```bash
# install/verify the Expo CLI comes bundled — you invoke it with npx
npx create-expo-app@latest silverback-sentry
cd silverback-sentry

# this template already includes Expo Router (file-based navigation)
npm run android   # or: npm run ios
```
`create-expo-app` now ships with Expo Router pre-wired, TypeScript, and an `app/` folder. It also drops in an `AGENTS.md` / `CLAUDE.md` if you use AI coding assistants.

### 0.4 The two ways to run your app — you need to understand this early
- **Expo Go** (the app from the store): fastest for day-to-day UI work. **But it cannot do remote push notifications, and it cannot use any library with custom native code** (like `@react-native-firebase/*`, or some map/audio configs).
- **Development build** (`expo-dev-client` + EAS Build): your *own* app binary with your native modules compiled in. This is what you'll need the moment you wire up push notifications. Set it up early so it doesn't ambush you in Phase 2.

```bash
npx expo install expo-dev-client
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

### 0.5 Team workflow (5 developers)
Because your timeline splits work across people (Jovita on multi-species, Emmanuel on maps/notifications, Samson on roles, etc.), agree on:
- **One `main` branch, feature branches per task** (e.g. `feature/role-based-access`), pull requests before merge.
- A shared **`.env`** convention (see 0.6) — never commit real keys.
- A shared TypeScript **types file** for your data models (a `Sighting`, a `Report`, a `User`) so everyone reads/writes Firestore the same shape.

### 0.6 Environment variables
Expo reads any variable prefixed `EXPO_PUBLIC_` into the client at build time:
```
# .env  (add to .gitignore)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_OPENROUTER_KEY=...
```
> Anything with `EXPO_PUBLIC_` is **visible in the app bundle** — fine for Firebase web config (which is designed to be public and protected by Security Rules), but **never** put a secret that must stay server-side (like an admin key or an unrestricted AI key) in the client. Those belong in a Cloud Function. This matters for your AI assistant (4.9).

---

## Part 1 — Project structure (Expo Router)

Expo Router uses **file-based routing**: the file tree under `app/` *is* your navigation. This suits your role-based app well because you can group screens by role.

```
app/
  _layout.tsx            # root: loads fonts, auth provider, notification handler
  index.tsx              # entry / splash / redirect based on auth+role
  (auth)/                # login, register, ID entry — unauthenticated group
    login.tsx
    register.tsx
  (community)/           # Community Member screens
    _layout.tsx          # tab bar for this role
    report.tsx
    alerts.tsx
  (ranger)/              # Ranger screens
    log-sighting.tsx
    snares.tsx
    education.tsx
  (admin)/               # Admin dashboard screens (if in-app)
    dashboard.tsx
  (tourist)/
    gorillas.tsx
lib/
  firebase.ts            # firebase init
  auth.tsx               # auth context + role
  types.ts               # Sighting, Report, User, Species...
  sync.ts                # offline queue logic
  i18n.ts                # translations
components/
  SpeciesPicker.tsx
  ReportForm.tsx
  MapView.tsx
```
The parenthesised folders like `(community)` are **route groups** — they organise files without adding a URL segment. You gate access to a whole group in its `_layout.tsx`.

**Alternative to Expo Router:** **React Navigation** (v7) directly. Expo Router is *built on top of* React Navigation, so you're using it either way; Expo Router just adds the file-based layer. Stick with Expo Router unless you have a specific reason not to.

---

## Part 2 — Core functionalities, one by one

### 4.1 Role-Based Access (Community / Ranger / Tourist / Admin)

**The concept:** two separate things people conflate — *authentication* (who are you?) and *authorization* (what are you allowed to do?). You need both, plus a way to route each role to different screens.

**Primary tech:** Firebase Authentication + a `role` field in a Firestore `users` document + Expo Router route guards.

**How it fits:**
1. **Auth** — `firebase/auth` with email/password (and you could add phone auth, which is very relevant in Uganda where many users are phone-first).
2. **Role storage** — when a user registers, create `users/{uid}` in Firestore with `{ role: "community" | "ranger" | "tourist" | "admin", nationalId, rangerId?, ... }`.
3. **Route guard** — in your root `_layout.tsx`, read the auth state and the role, then redirect. The classic bug here (well documented) is calling `router.replace()` before the navigator has mounted — guard against it by waiting for `useRootNavigationState()`.

```ts
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  // ...rest
});

// getReactNativePersistence keeps the user logged in across app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
```

**Authorization must ALSO be enforced server-side.** Client-side route guards are just UX — a determined user can bypass them. The real enforcement is **Firestore Security Rules**:
```
// firestore.rules — a ranger can write sightings, only admins read the full user list
match /users/{userId} {
  allow read: if request.auth.uid == userId
              || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
}
match /sightings/{id} {
  allow create: if request.auth != null;
  allow read: if request.auth != null;
}
```
For airtight role checks, use **Firebase Custom Claims** (set via a Cloud Function / Admin SDK) rather than a Firestore field — claims live in the auth token itself and can't be spoofed client-side. A Firestore `role` field is fine to start; migrate to custom claims for anything security-critical.

**Required IDs (Ranger ID, National ID, Tourist ID):** these are just fields on the user document plus a verification step. Store sensitive values with **`expo-secure-store`** (encrypted keychain/keystore) rather than AsyncStorage. Real verification of a National ID would need integration with **NIRA** (Uganda's National Identification & Registration Authority) — realistically out of scope for a student build, so document it as "manual admin verification" for now.

**Alternatives:**
- **Clerk** or **Supabase Auth** instead of Firebase Auth — Supabase (Postgres + row-level security) is a strong alternative if you'd rather have SQL and built-in RLS instead of Firestore's document rules.
- **Auth0** — heavier, enterprise-oriented; overkill here.

---

### 4.2 Multi-Species Support (dropdown)

**The concept:** this is the *easiest* item — it's a controlled vocabulary (an enum) plus a picker UI. The design work is making it extensible ("Other problem animals (expandable)").

**Primary tech:** a TypeScript union/enum + a picker component.

```ts
// lib/types.ts
export const SPECIES = [
  "mountain_gorilla", "african_elephant", "bushpig",
  "monkey", "antelope", "other",
] as const;
export type Species = typeof SPECIES[number];
```
For the UI, `@react-native-picker/picker` gives a native dropdown. For a nicer sheet-style selector, use a bottom-sheet library. Store the species list in **Firestore** (not hard-coded) if you want admins to add new animals without shipping an app update — that satisfies "expandable."

**Alternatives:** `react-native-dropdown-picker`, or a custom modal list with search once the list grows.

---

### 4.3 Instant Notifications ⚠️ (the hard one — read fully)

**The concept:** two very different things are both called "notifications":
- **Local notifications** — the app schedules an alert on the same device (e.g. "you have unsynced reports"). Works in Expo Go, no server needed.
- **Remote / push notifications** — a *server* pushes an alert to *other people's* devices (e.g. "an elephant just crossed into your area"). This is what your alert types (geofence breach, snare discovered, poaching) actually require, and it needs real infrastructure.

**Primary tech:** `expo-notifications` on the client; **FCM** (Firebase Cloud Messaging) for Android and **APNs** for iOS underneath; the **Expo Push Service** as the simplest way to send.

**The critical gotcha:** **remote push does not work in Expo Go anymore (since SDK 53).** You must:
1. Build a **development build** (`expo-dev-client` + EAS Build) — see 0.4.
2. Set up **FCM V1 credentials** (upload a Firebase service-account key to EAS).
3. Test on a **physical device** (push is unreliable/absent on emulators).

**Client side:**
```ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

async function registerForPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  // save `token` to the user's Firestore doc so the server can target them
  return token;
}
```

**Server side (what actually triggers the alert):** a **Firebase Cloud Function** that watches Firestore. When a ranger writes a snare document, or your geofence logic (4.4) detects a boundary breach, the function looks up which users are in that area, collects their Expo push tokens, and POSTs them to the Expo Push API (batch of up to 100 per request; `expo-server-sdk-node` handles chunking).

```js
// Cloud Function pseudo-flow
exports.onSnareReported = onDocumentCreated("snares/{id}", async (event) => {
  const nearbyUserTokens = await findUsersNearLocation(event.data.location);
  await sendExpoPush(nearbyUserTokens, {
    title: "⚠️ Snare discovered",
    body: "A snare was reported near your community.",
    priority: "high",
  });
});
```

**SMS alerts** (your doc lists SMS for community members — important, because not everyone has a smartphone or data in rural Bwindi):
- **Africa's Talking** — a pan-African SMS/USSD gateway, **based in the region, cheaper for Ugandan numbers, and supports local carriers**. This is the right primary choice for you, more so than Twilio.
- **Twilio** — global, well-documented, but pricier for Ugandan delivery.
- Either is called from the same Cloud Function that sends the push.

**Alternatives to Expo Push Service:** talk to **FCM/APNs directly** (`getDevicePushTokenAsync` instead of `getExpoPushTokenAsync`) — more control, more work. Or **Notifee** for richer local-notification styling. Or **OneSignal** for a managed all-in-one push+notification dashboard.

---

### 4.4 Georeferencing & Map Features

**The concept:** several distinct geospatial problems bundled together:
- **Getting the device's location** → GPS.
- **Showing sightings on a map** → map rendering + markers.
- **Geofencing** → "is this point inside/outside the park boundary?" That's a *point-in-polygon* test.
- **Movement trails** → storing time-ordered coordinates and drawing a polyline.
- **500m monitoring radius** → distance calculations between two lat/long points.

**Primary tech:** `expo-location` (GPS) + `react-native-maps` (map + markers + polygons) + a geometry library for the maths.

**Getting location:**
```ts
import * as Location from "expo-location";
const { status } = await Location.requestForegroundPermissionsAsync();
const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
// pos.coords.latitude, pos.coords.longitude
```
For tracking when animals leave the park in the background, you'd use `Location.startLocationUpdatesAsync` with a background task (needs a dev build + background-location permission).

**The map:**
```tsx
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
<MapView initialRegion={bwindiRegion}>
  <Polygon coordinates={parkBoundary} strokeColor="green" />   {/* park outline */}
  {sightings.map(s => (
    <Marker key={s.id} coordinate={s.coord} pinColor={colorForSpecies(s.species)} />
  ))}
  <Polyline coordinates={movementTrail} />                     {/* historical trail */}
</MapView>
```
> **Version note:** `react-native-maps` 1.21+ is the New-Architecture-first release (still stabilising). If you hit issues, the alternative **`expo-maps`** is Expo's own newer map module — cleaner on the New Architecture but requires iOS 17+ / newer Android. For an Android-first Uganda deployment, `expo-maps` is worth evaluating.

**Geofencing — the actual logic.** Your park boundary is a *polygon*, not a circle, so you need a **point-in-polygon** test. Use **Turf.js**:
```ts
import { booleanPointInPolygon, point, polygon } from "@turf/turf";
const inside = booleanPointInPolygon(point([lng, lat]), parkPolygon);
if (!inside) triggerBoundaryBreachAlert();   // animal left the park → notify (4.3)
```
Turf also gives you `distance()` for the **500m radius** check and `buffer()` to draw the radius zone. Note: `expo-location`'s built-in `startGeofencingAsync` only supports **circular** regions natively — fine for "within 500m of a village," not for an irregular park boundary. Use native geofencing for circles, Turf for the polygon.

**Storing coordinates in Firestore:** use the native **`GeoPoint`** type. For efficient "find everything near X" queries you'll eventually want **geohashing** (`geofire-common`) — Firestore can't do true radius queries directly, so you query a geohash range and filter with Turf.

**Color-coded markers by species** is just a lookup from `species → color`. **Hotspots** on the admin map = clustering; use `react-native-map-clustering` or aggregate server-side.

**Alternatives:**
- **Mapbox** (`@rnmapbox/maps`) — far better offline map tiles (huge for Bwindi's no-signal forests — you can bundle offline map regions), custom styling, heatmaps. Google Maps via `react-native-maps` needs connectivity for tiles. **For your offline-first goal, seriously consider Mapbox for the map layer.**
- **MapLibre** — open-source, free Mapbox alternative, also supports offline tiles.

---

### 4.5 Admin Dashboard (central monitoring)

**The concept:** a real-time operations view — live map, ranger positions, hotspots, plus analytics and exportable reports. Ask early: **is this a screen inside the mobile app, or a separate web app?** For a control-room "central monitoring" tool, a **web dashboard is the right call** (bigger screen, easier analytics, no app install for HQ staff).

**Primary tech (recommended — web dashboard):** a **React web app (Vite)** or **Next.js**, reading the *same* Firebase project. Real-time updates come from Firestore's `onSnapshot` listeners — no polling needed.

- **Live map:** `react-leaflet` (free, OpenStreetMap) or Mapbox GL JS on the web.
- **Charts / analytics** (sightings by species, response times, snare trends): **Recharts**, **Chart.js**, or **Nivo**.
- **Data tables:** **TanStack Table**.
- **PDF export:** **jsPDF** + `jspdf-autotable`, or **react-pdf**.
- **Excel export:** **SheetJS (xlsx)**.
- Aggregations ("sightings in last 24h/7d/month") are best precomputed by a **Cloud Function** writing to a `stats/` collection, so the dashboard reads cheap summaries instead of scanning every document.

**If you keep it in-app instead:** build an `(admin)` route group, same charting via **`react-native-gifted-charts`** or **Victory Native**, PDF via **`expo-print`** (`Print.printToFileAsync`) and share via **`expo-sharing`**.

**Alternatives:** **Grafana** or **Metabase** pointed at your data for analytics if you don't want to build charts by hand; **Retool** for a fast internal admin panel.

---

### 4.6 Ranger Education Module

**The concept:** content delivery + a quiz engine + certification tracking. Low technical risk — it's mostly data modelling and UI.

**Primary tech:**
- **Content** (emergency protocols, snare removal, disease prevention) → Markdown or rich text stored in Firestore, rendered with **`react-native-markdown-display`**. Bundle it in the app so it works **offline** (important).
- **Quizzes** → a JSON schema of questions/answers; score client-side; write the result + timestamp to `users/{uid}/certifications`.
- **Certification** → on passing the quarterly quiz, generate a certificate PDF with **`expo-print`**, and optionally set a `certifiedUntil` date.
- **Videos** (if any training clips) → **`expo-video`** (the current module; `expo-av`'s video half is deprecated).

**Alternatives:** a full LMS backend like **Moodle** is overkill; if certification needs to be tamper-proof, have a Cloud Function issue the certificate so the pass/fail isn't decided purely on the device.

---

### 4.7 Community Reporting (3 taps, voice, photos, offline)

**The concept:** a maximally-simple, icon-driven, offline-capable form for low-literacy users. Every piece here is chosen to reduce reading and typing.

**Primary tech:**
- **Form** → keep it to icon buttons and steppers, not text fields. Minimal state; you may not even need a form library, but **React Hook Form** helps if it grows.
- **Photos** → **`expo-image-picker`** (camera or library) + **`expo-image-manipulator`** to compress before upload (rural bandwidth). Store the file with **Firebase Storage**, save the download URL in Firestore.
- **Voice recording for non-readers** → **`expo-audio`** (the current audio module — `expo-av` is deprecated and split into `expo-audio` + `expo-video`). Record → save locally with `expo-file-system` → upload on sync.
- **Offline capability** → see 4.10; the report is written locally first and queued.
- **Report types** (crop raiding, livestock predation, dangerous sighting, human injury) → the same species/enum pattern as 4.2, with a `severity` flag so "human injury" routes to the CRITICAL notification path (4.3).

```ts
import * as ImagePicker from "expo-image-picker";
const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
```

**Alternatives:** for *voice-to-text* (turning the recording into searchable text), see 4.8 — that's a speech-recognition problem, not just recording.

---

### 4.8 Language Translation (Runyankole/Rukiga, Swahili, Luganda, English)

**The concept:** three separate translation problems, often confused:
1. **UI translation** (static strings in the app) — this is **i18n (internationalization)**, solved with a library + translation files.
2. **Voice-to-text in local languages** — **speech recognition (ASR)**, much harder, and coverage for Runyankole/Luganda is weak in mainstream engines.
3. **Translating user content / AI responses** — **machine translation**, an API call.

**Primary tech for UI (item 1):** **`i18next` + `react-i18next` + `expo-localization`**.
```ts
// lib/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { report: "Report", snare: "Snare" } },
    rn: { translation: { report: "...", snare: "..." } },   // Runyankole
    sw: { translation: { /* Swahili */ } },
    lg: { translation: { /* Luganda */ } },
  },
  fallbackLng: "en",
});
```
This part is straightforward — you just need native speakers on your team to fill the translation files (a real strength of your local team).

**Item 2 (voice-to-text) is the genuinely hard one.** Mainstream ASR (Google Cloud Speech-to-Text, **OpenAI Whisper**) supports Swahili reasonably and English well, but **Runyankole/Rukiga and Luganda are low-resource languages** with limited or no support. Realistic options:
- Use **Whisper** (via API or the open model) — it has *some* Luganda/Swahili ability and is your best general bet.
- Look at **Makerere University's AI Lab / Sunbird AI**, who have specifically built **Ugandan-language speech and translation models (SALT dataset, incl. Luganda, Runyankole, others)**. This is a locally-relevant, research-grade option that fits your project's academic context — worth contacting them.
- Fallback: store the **voice recording itself** and let a bilingual ranger/admin listen, rather than forcing transcription.

**Item 3 (translating text / AI output):** Google Cloud Translation, DeepL (no local-language coverage), or route it through your AI assistant (4.9) with a "translate to Luganda" prompt — quality varies for low-resource languages.

**Alternatives to i18next:** `react-intl`, `lingui`, or Expo's own localization patterns. i18next is the most common and best-documented choice.

---

### 4.9 AI Conservation Assistant

**The concept:** a chat/Q&A interface backed by a large language model, ideally with your conservation knowledge injected, and able to answer in local languages.

**Primary tech (per your doc):** **OpenRouter** — a single API that routes to many models (Llama, Mistral, GPT-3.5, and others). One integration, swappable models, good for cost control.

```ts
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "meta-llama/llama-3.1-8b-instruct",
    messages: [
      { role: "system", content: "You are a Bwindi conservation assistant. Answer in the user's language." },
      { role: "user", content: userQuestion },
    ],
  }),
});
```

> **Security — do not skip this.** Never put your AI API key in the client (`EXPO_PUBLIC_` keys ship inside the app and can be extracted). Route AI calls through a **Cloud Function** that holds the key server-side and forwards the request. This also lets you rate-limit and log usage.

**Making it actually knowledgeable (RAG):** to have it answer accurately about *Bwindi specifically* rather than generically, use **Retrieval-Augmented Generation** — embed your conservation documents into a vector store and retrieve relevant passages to include in the prompt. Tools: **Pinecone**, **Supabase pgvector**, or **Chroma**. For a student project you can start without RAG (just a good system prompt) and add it later.

**Alternatives to OpenRouter:**
- **Anthropic Claude API**, **OpenAI API**, or **Google Gemini API** directly — simpler if you're committed to one provider.
- **On-device / offline models** (e.g. a small quantized Llama via `llama.rn`) — intriguing for your offline-first goal, but heavy for phones and generally impractical on low-end devices in the field today. Keep AI as an online-only feature and degrade gracefully when offline.

---

### 4.10 Offline-First Sync

**The concept:** the whole app must work with **no connectivity** (Bwindi's forests), storing data locally and reconciling with the server when a connection returns. This is an architecture, not a single library — and it's the backbone that several other features depend on.

**Primary tech:** **Firestore's built-in offline persistence** + **AsyncStorage** for small key/values + **`expo-file-system`** for media files + a **pending-sync queue**.

**The big win:** **Firestore has offline persistence built in.** On mobile it caches reads and *queues writes automatically*, replaying them when the device reconnects. For a lot of your data, "offline-first" is mostly free — you just read and write Firestore normally and it handles the queue. Your listeners fire from cache while offline.

```ts
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
```

**What you still build yourself:**
- **Media queue** — photos and voice notes aren't Firestore documents; they go to Firebase Storage. Save them to `expo-file-system` locally, record a "pending upload" entry, and upload when online.
- **Connectivity detection** — **`@react-native-community/netinfo`** tells you when the connection returns, so you can trigger sync and update the "pending items" counter your doc mentions.
- **Manual sync (pull-to-refresh)** — a `RefreshControl` that flushes the queue.
- **Conflict handling** — decide your rule (last-write-wins is what Firestore does by default; fine for reports, riskier for shared records).

```ts
import NetInfo from "@react-native-community/netinfo";
NetInfo.addEventListener(state => {
  if (state.isConnected) flushPendingQueue();   // upload media, mark synced
});
```

**Alternatives (for heavier offline needs):**
- **WatermelonDB** — a reactive local SQLite database built for offline-first with large datasets and a proper sync engine. More powerful than Firestore's cache if you have thousands of local records, but more work to wire up.
- **Expo SQLite** — raw local SQL if you want full control and your own sync layer.
- **PowerSync** or **Supabase** + local SQLite — if you move off Firebase, these give first-class offline-sync with Postgres.
- **RxDB / Realm** — other offline-first databases with sync.

For your scale (community reports, sightings), **Firestore offline + a small media queue is the pragmatic choice.** Reach for WatermelonDB only if you hit performance limits.

---

## Part 3 — Cross-cutting concepts you'll use everywhere

| Concept | What it means for you | Tooling |
|---|---|---|
| **State management** | Auth/role and current user need to be app-wide | **React Context** for auth; **Zustand** (light) or **Redux Toolkit** (heavier) if state grows; **TanStack Query** if you add REST calls |
| **Server state via listeners** | Firestore `onSnapshot` gives live data — you often don't need extra state libs | `firebase/firestore` |
| **Backend logic** | Notifications, aggregations, AI proxy, certification must run server-side | **Firebase Cloud Functions** (Node) |
| **Security Rules** | The *real* authorization layer | Firestore Rules + Storage Rules |
| **Geospatial** | Point-in-polygon, distance, radius, geohash queries | **Turf.js**, **geofire-common** |
| **File handling** | Photos, voice notes, offline cache | `expo-file-system`, `expo-image-manipulator`, Firebase Storage |
| **Testing** | A 5-person, multi-feature app needs it | **Jest** + **React Native Testing Library**; **Maestro** for end-to-end |
| **Type safety** | Everyone reads/writes the same data shapes | **TypeScript** + a shared `types.ts` |

---

## Part 4 — Suggested build order (maps to your phases)

Your document's phase plan is reasonable. One reordering suggestion: **stand up the dev build + a bare push notification test in Phase 1, not Phase 2** — because notifications force the dev-build workflow, and discovering that late tends to blow up timelines.

1. **Foundation:** project scaffold, Firebase init, auth + role routing (4.1), TypeScript models. *Everything depends on this.*
2. **Data entry:** multi-species (4.2) + community reporting form (4.7) writing to Firestore, working online first.
3. **Offline layer (4.10):** turn on Firestore persistence, add the media queue + NetInfo. Now 4.2/4.7 work offline.
4. **Maps (4.4):** location, markers, park polygon, Turf geofence check.
5. **Notifications (4.3):** dev build, FCM creds, Cloud Function triggered by snare/geofence events. *This is the integration spike — budget extra time.*
6. **Admin dashboard (4.5):** ideally the parallel web app, reading the same Firestore.
7. **Polish features:** i18n (4.8 item 1), education module (4.6), AI assistant (4.9 via Cloud Function).
8. **Hard/research features last:** local-language voice-to-text (4.8 item 2), background location, RAG for the AI.

---

## Part 5 — At-a-glance: primary tech vs. alternatives

| Functionality | Primary (your stack) | Strong alternative | When to switch |
|---|---|---|---|
| Framework | React Native + Expo (SDK 56) | Flutter | Only if the whole team prefers Dart |
| Navigation | Expo Router | React Navigation (raw) | You need very custom nav |
| Auth | Firebase Auth | Supabase Auth / Clerk | You want SQL + RLS |
| Database | Firestore | Supabase (Postgres) | You want relational + strong offline sync |
| Maps | react-native-maps / expo-maps | **Mapbox / MapLibre** | **You need offline map tiles (recommended for Bwindi)** |
| Geofencing maths | Turf.js | native circular geofencing | Simple radius-only zones |
| Notifications (push) | expo-notifications + Expo Push | FCM/APNs direct, OneSignal | You need fine control or a dashboard |
| SMS | **Africa's Talking** | Twilio | Africa's Talking is better/cheaper locally |
| Offline storage | Firestore cache + file-system | **WatermelonDB** / Expo SQLite | Thousands of local records |
| Voice recording | expo-audio | — | (expo-av is deprecated) |
| Voice-to-text | Whisper | **Sunbird AI / Makerere SALT** | You need Luganda/Runyankole ASR |
| i18n | i18next | react-intl / lingui | Preference |
| AI assistant | OpenRouter | Claude / OpenAI / Gemini direct | Committed to one provider |
| Dashboard | React web + Recharts | Metabase / Grafana | You don't want to build charts |
| Charts (in-app) | Victory Native / gifted-charts | react-native-skia | Custom visuals |
| PDF/Excel export | expo-print / jsPDF / SheetJS | react-pdf | Preference |

---

## Three things I'd flag before you start

1. **The dev-build / Expo Go split will bite you if you don't plan for it.** The moment you touch push notifications or `@react-native-firebase/*`, Expo Go stops being enough. Decide early: Firebase **JS SDK** (works in Expo Go, quick start — recommended for you) vs **React Native Firebase** (native, needs a dev build). Pick JS SDK unless you specifically need Analytics/Crashlytics.

2. **Offline maps are the weak point of the default stack.** `react-native-maps` with Google tiles needs connectivity to load the map itself — which contradicts "works in Bwindi's remote forests." If offline map viewing matters, **Mapbox or MapLibre with pre-downloaded regions** is the fix. Evaluate this before committing.

3. **Local-language voice is a research problem, not a library install.** Runyankole and Luganda ASR isn't a solved, off-the-shelf feature. Scope it realistically: ship UI translation (easy) and voice *recording* (easy) first; treat voice *transcription* as an R&D stretch goal, and look at **Makerere/Sunbird AI** rather than assuming Google will cover it.
