// app/utils/mediaPaths.js
// Local media (report photos, voice notes, avatars) is copied into app-owned
// documents subfolders before its file:// URI is saved in Firestore/prefs.
// On iOS the absolute container path in that URI changes whenever the app (or
// Expo Go) is updated or reinstalled, which silently breaks every stored URI.
// Re-anchor known subfolders onto the *current* documents directory at
// display time so the files keep resolving.

import { Paths } from 'expo-file-system';

const MANAGED_DIRS = ['report-media', 'avatar'];

export function resolveLocalMediaUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  if (!uri.startsWith('file://')) return uri; // https download URLs pass through
  const match = uri.match(/\/(report-media|avatar)\/([^/?#]+)$/);
  if (!match || !MANAGED_DIRS.includes(match[1])) return uri;
  const base = Paths.document.uri.endsWith('/') ? Paths.document.uri : `${Paths.document.uri}/`;
  return `${base}${match[1]}/${match[2]}`;
}
