/**
 * lib/i18n.ts
 * ---------------------------------------------------------------------------
 * App-wide localization (i18next + react-i18next).
 *
 * - The language selectors (register form, profile) call `setAppLanguage()`
 *   with the human-readable label; the change is applied immediately —
 *   every component using `useTranslation()` re-renders in place — and the
 *   ISO code is persisted to AsyncStorage so it survives restarts.
 * - Local-language strings are community best-effort translations; have
 *   native speakers review before production release.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'wildwatch.lang';

/** Display labels (as shown in the pickers) → ISO 639 codes. */
export const LANGUAGES: readonly { label: string; code: string }[] = [
  { label: 'English', code: 'en' },
  { label: 'Luganda', code: 'lg' },
  { label: 'Runyankole', code: 'nyn' },
  { label: 'Rukiga', code: 'cgg' },
  { label: 'Lugbara', code: 'lgg' },
  { label: 'Swahili', code: 'sw' },
];

export function languageCodeFor(label: string): string {
  return LANGUAGES.find((l) => l.label === label)?.code ?? 'en';
}

export function languageLabelFor(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? 'English';
}

const resources = {
  en: {
    translation: {
      nav: { home: 'Home', feed: 'Feed', map: 'Map', chat: 'Chat', sos: 'SOS' },
      common: {
        optional: 'Optional',
        signOut: 'Sign out',
        loading: 'Loading…',
        cancel: 'Cancel',
        save: 'Save',
      },
      chat: {
        title: 'Community Chat',
        subtitle: 'Talk with users & rangers',
        empty: 'No messages yet — say hello!',
        placeholder: 'Type a message…',
        ai: 'AI Assistant',
        aiSubtitle: 'Ask about wildlife & conservation',
        aiPlaceholder: 'Ask about the animals…',
        aiHint: 'Ask anything about gorilla health, behavior, tracking, or conservation practice.',
        thinking: 'Thinking…',
        locked: 'Chats are locked',
        lockedBody: 'Unlock with biometrics or your account password to open your chats.',
        useBiometrics: 'Unlock with biometrics',
        unlock: 'Unlock',
        passwordPlaceholder: 'Account password',
        lockFailed: 'Biometric unlock failed — try again or use your password.',
        wrongPassword: 'Wrong password — please try again.',
      },
      account: {
        section: 'Account settings',
        editName: 'Full name',
        changePassword: 'Change password',
        currentPassword: 'Current password',
        newPassword: 'New password',
        confirmPassword: 'Confirm new password',
        passwordMismatch: 'The new passwords do not match.',
        passwordChanged: 'Your password has been updated.',
        biometricLogin: 'Biometric sign-in',
        biometricHint: 'Use your fingerprint or face to sign in and unlock chats.',
        biometricUnsupported: 'Not supported on this device',
        park: 'National park',
        deleteAccount: 'Delete account',
        deleteWarning:
          'This permanently deletes your account and cannot be undone. Enter your password to confirm.',
        nameUpdated: 'Your name has been updated.',
      },
      dashboard: {
        greeting: 'Hi, {{name}}',
        impactLabel: 'Community impact this month',
        communityAlerts: 'Community Alerts',
        newAlerts: '{{count}} new alerts in {{park}}',
        quickReport: 'Quick report',
        tileSighting: 'Wildlife\nSighting',
        tileConflict: 'Human–Wildlife\nConflict',
        tileClaim: 'Compensation\nClaim',
        myRecentReports: 'My recent reports',
        seeAll: 'See all',
        noReports: 'No reports yet — submit your first sighting.',
        nearbyAlert: 'Nearby alert',
        nearbyMeta: 'Elephant herd movement — 3.2km west',
        liveMap: 'Live community map',
      },
      sighting: {
        title: 'Wildlife Sighting',
        subtitle: 'Report what you saw',
        species: 'Species',
        numberObserved: 'Number observed',
        behavior: 'Behavior',
        dateTime: 'Date & time',
        description: 'Description',
        descPlaceholder: 'What did you observe?',
        photoEvidence: 'Photo evidence',
        voiceNote: 'Voice note',
        recording: '● Recording',
        tapToRecord: 'Tap to record up to 60s',
        submit: 'Submit sighting',
      },
      sos: {
        title: 'SOS Emergency',
        subtitle: 'One-tap ranger dispatch',
        intro: 'Press and hold for 1.5s to alert {{park}} rangers with your live location.',
        liveLocation: 'Your live location',
        locating: 'Getting your GPS position…',
        locationDenied: 'Location permission denied — enable it in settings.',
        sent: 'SOS sent!',
        sentBody: 'Rangers have been alerted with your location.',
        sending: 'Sending SOS…',
      },
      reports: {
        title: 'My Reports',
        subtitle: 'Everything you have submitted',
        empty: 'No reports yet.',
        detailTitle: 'Report details',
      },
      map: { title: 'Live Map', subtitle: 'Park boundary & community reports' },
      profile: { title: 'Profile', subtitle: 'Your account', language: 'Preferred language' },
    },
  },

  sw: {
    translation: {
      nav: { home: 'Nyumbani', feed: 'Habari', map: 'Ramani', chat: 'Gumzo', sos: 'SOS' },
      common: { optional: 'Hiari', signOut: 'Toka', loading: 'Inapakia…' },
      dashboard: {
        greeting: 'Habari, {{name}}',
        impactLabel: 'Mchango wa jamii mwezi huu',
        communityAlerts: 'Tahadhari za Jamii',
        newAlerts: 'Tahadhari mpya {{count}} katika {{park}}',
        quickReport: 'Ripoti ya haraka',
        tileSighting: 'Kuonekana kwa\nWanyamapori',
        tileConflict: 'Mgogoro wa Binadamu\nna Wanyamapori',
        tileClaim: 'Dai la\nFidia',
        myRecentReports: 'Ripoti zangu za hivi karibuni',
        seeAll: 'Ona zote',
        noReports: 'Hakuna ripoti bado — wasilisha ya kwanza.',
        nearbyAlert: 'Tahadhari ya karibu',
        nearbyMeta: 'Kundi la tembo — km 3.2 magharibi',
        liveMap: 'Ramani ya jamii ya moja kwa moja',
      },
      sighting: {
        title: 'Kuonekana kwa Wanyamapori',
        subtitle: 'Ripoti ulichokiona',
        species: 'Spishi',
        numberObserved: 'Idadi iliyoonekana',
        behavior: 'Tabia',
        dateTime: 'Tarehe na saa',
        description: 'Maelezo',
        descPlaceholder: 'Uliona nini?',
        photoEvidence: 'Ushahidi wa picha',
        voiceNote: 'Ujumbe wa sauti',
        recording: '● Inarekodi',
        tapToRecord: 'Gusa kurekodi hadi sekunde 60',
        submit: 'Wasilisha ripoti',
      },
      sos: {
        title: 'Dharura ya SOS',
        subtitle: 'Kuwaita walinzi kwa mguso mmoja',
        intro: 'Bonyeza na ushikilie sekunde 1.5 kuwaarifu walinzi wa {{park}} kwa eneo lako.',
        liveLocation: 'Eneo lako la sasa',
        locating: 'Inatafuta eneo lako la GPS…',
        locationDenied: 'Ruhusa ya eneo imekataliwa — iwashe kwenye mipangilio.',
        sent: 'SOS imetumwa!',
        sentBody: 'Walinzi wamearifiwa na eneo lako.',
        sending: 'Inatuma SOS…',
      },
      reports: {
        title: 'Ripoti Zangu',
        subtitle: 'Yote uliyowasilisha',
        empty: 'Hakuna ripoti bado.',
        detailTitle: 'Maelezo ya ripoti',
      },
      map: { title: 'Ramani Hai', subtitle: 'Mpaka wa hifadhi na ripoti za jamii' },
      profile: { title: 'Wasifu', subtitle: 'Akaunti yako', language: 'Lugha unayopendelea' },
    },
  },

  lg: {
    translation: {
      nav: { home: 'Awaka', feed: 'Amawulire', map: 'Maapu', chat: 'Emboozi', sos: 'SOS' },
      common: { optional: "Si kya buwaze", signOut: 'Fuluma', loading: 'Etikkula…' },
      dashboard: {
        greeting: 'Gyebale, {{name}}',
        impactLabel: "Omugaso gw'ekitundu omwezi guno",
        communityAlerts: "Okulabula kw'Ekitundu",
        newAlerts: 'Okulabula okupya {{count}} mu {{park}}',
        quickReport: 'Alipoota mangu',
        tileSighting: "Okulaba\nEnsolo",
        tileConflict: "Enkaayana y'Abantu\nn'Ensolo",
        tileClaim: "Okusaba\nEmpeera",
        myRecentReports: 'Alipoota zange eziyise',
        seeAll: 'Laba zonna',
        noReports: 'Tewali alipoota — weereza esooka.',
        nearbyAlert: 'Okulabula okuli okumpi',
        nearbyMeta: 'Enjovu zitambula — km 3.2 ebugwanjuba',
        liveMap: "Maapu y'ekitundu esemba",
      },
      sighting: {
        title: 'Okulaba Ensolo',
        subtitle: "Alipoota ku ky'olabye",
        species: 'Ekika',
        numberObserved: 'Omuwendo ogulabiddwa',
        behavior: 'Empisa',
        dateTime: "Olunaku n'essaawa",
        description: 'Ennyonyola',
        descPlaceholder: 'Olabye ki?',
        photoEvidence: 'Ebifaananyi',
        voiceNote: "Obubaka bw'eddoboozi",
        recording: '● Ekwata eddoboozi',
        tapToRecord: 'Nyiga okukwata okutuuka ku sikonda 60',
        submit: 'Weereza alipoota',
      },
      sos: {
        title: 'SOS Akabenje',
        subtitle: 'Okuyita abakuumi omulundi gumu',
        intro: "Nyiga era okwate sikonda 1.5 okutegeeza abakuumi ba {{park}} w'oli.",
        liveLocation: "W'oli kati",
        locating: 'Enoonya GPS yo…',
        locationDenied: 'Olukusa lwa lokeshoni lugaaniddwa — luteeke mu setingi.',
        sent: 'SOS eweerezeddwa!',
        sentBody: "Abakuumi bategeezeddwa w'oli.",
        sending: 'Eweereza SOS…',
      },
      reports: {
        title: 'Alipoota Zange',
        subtitle: "Byonna by'oweerezza",
        empty: 'Tewali alipoota.',
        detailTitle: 'Ebikwata ku alipoota',
      },
      map: { title: 'Maapu Esemba', subtitle: "Ensalo y'ekibira n'alipoota z'ekitundu" },
      profile: { title: 'Profailo', subtitle: 'Akawunti yo', language: "Olulimi lw'oyagala" },
    },
  },

  nyn: {
    translation: {
      nav: { home: 'Eka', feed: 'Amakuru', map: 'Maapu', chat: 'Emboozi', sos: 'SOS' },
      common: { optional: 'Tikikigyendererwa', signOut: 'Shohora', loading: 'Nikireeta…' },
      dashboard: {
        greeting: 'Agandi, {{name}}',
        impactLabel: "Omugasho gw'abantu omu kwezi oku",
        communityAlerts: "Okurabura kw'Abantu",
        newAlerts: 'Okurabura kusya {{count}} omuri {{park}}',
        quickReport: 'Ripoota yangu',
        tileSighting: 'Okureeba\nEnyamaishwa',
        tileConflict: "Empaka z'Abantu\nn'Enyamaishwa",
        tileClaim: 'Okushaba\nEmpeera',
        myRecentReports: 'Ripoota zangye eziherukire',
        seeAll: 'Reeba zoona',
        noReports: 'Tihariho ripoota — ohereze eyokubanza.',
        nearbyAlert: 'Okurabura okuri haihi',
        nearbyMeta: 'Enjojo nizigyenda — km 3.2 bugwaizooba',
        liveMap: "Maapu y'abantu erikworeka hati",
      },
      sighting: {
        title: 'Okureeba Enyamaishwa',
        subtitle: "Ripoota aha ki waareebire",
        species: 'Omuringo',
        numberObserved: 'Omubaro ogwareebirwe',
        behavior: 'Emitwarize',
        dateTime: "Eizooba n'eshaaha",
        description: 'Enshoboorora',
        descPlaceholder: 'Waareebire ki?',
        photoEvidence: 'Ebishushani',
        voiceNote: "Obutumwa bw'eiraka",
        recording: '● Nikikwata eiraka',
        tapToRecord: 'Kanda okukwata kuhika aha sekonda 60',
        submit: 'Ohereza ripoota',
      },
      sos: {
        title: 'SOS Akabi',
        subtitle: 'Okweta abarinzi omurundi gumwe',
        intro: 'Kanda ogumeho sekonda 1.5 kumanyisa abarinzi ba {{park}} ei ori.',
        liveLocation: 'Ei ori hati',
        locating: 'Nikironda GPS yaawe…',
        locationDenied: 'Orusa rwa lokeshoni rwangirwe — rutekye omu setingi.',
        sent: 'SOS yoherezibwa!',
        sentBody: 'Abarinzi bamanyisiibwe ei ori.',
        sending: 'Nikyohereza SOS…',
      },
      reports: {
        title: 'Ripoota Zangye',
        subtitle: 'Byona ebi waaherize',
        empty: 'Tihariho ripoota.',
        detailTitle: 'Ebirikukwata aha ripoota',
      },
      map: { title: 'Maapu Erikworeka Hati', subtitle: "Orubibi rw'ekibira na ripoota z'abantu" },
      profile: { title: 'Profailo', subtitle: 'Akaunti yaawe', language: 'Orurimi oru okunda' },
    },
  },

  cgg: {
    translation: {
      nav: { home: 'Eka', feed: 'Amakuru', map: 'Maapu', chat: 'Emboozi', sos: 'SOS' },
      common: { optional: 'Tikikigyendererwa', signOut: 'Shohora', loading: 'Nikireeta…' },
      dashboard: {
        greeting: 'Agandi, {{name}}',
        impactLabel: "Omugasho gw'abantu omu kwezi oku",
        communityAlerts: "Okurabura kw'Abantu",
        newAlerts: 'Okurabura kusya {{count}} omuri {{park}}',
        quickReport: 'Ripoota yangu',
        tileSighting: 'Okureeba\nEnyamaishwa',
        tileConflict: "Empaka z'Abantu\nn'Enyamaishwa",
        tileClaim: 'Okushaba\nEmpeera',
        myRecentReports: 'Ripoota zangye eziherukire',
        seeAll: 'Reeba zoona',
        noReports: 'Tihariho ripoota — ohereze eyokubanza.',
        nearbyAlert: 'Okurabura okuri haihi',
        nearbyMeta: 'Enjojo nizigyenda — km 3.2 bugwaizooba',
        liveMap: "Maapu y'abantu erikworeka hati",
      },
      sighting: {
        title: 'Okureeba Enyamaishwa',
        subtitle: 'Ripoota aha ki waareebire',
        species: 'Omuringo',
        numberObserved: 'Omubaro ogwareebirwe',
        behavior: 'Emitwarize',
        dateTime: "Eizooba n'eshaaha",
        description: 'Enshoboorora',
        descPlaceholder: 'Waareebire ki?',
        photoEvidence: 'Ebishushani',
        voiceNote: "Obutumwa bw'eiraka",
        recording: '● Nikikwata eiraka',
        tapToRecord: 'Kanda okukwata kuhika aha sekonda 60',
        submit: 'Ohereza ripoota',
      },
      sos: {
        title: 'SOS Akabi',
        subtitle: 'Okweta abarinzi omurundi gumwe',
        intro: 'Kanda ogumeho sekonda 1.5 kumanyisa abarinzi ba {{park}} ei ori.',
        liveLocation: 'Ei ori hati',
        locating: 'Nikironda GPS yaawe…',
        locationDenied: 'Orusa rwa lokeshoni rwangirwe — rutekye omu setingi.',
        sent: 'SOS yoherezibwa!',
        sentBody: 'Abarinzi bamanyisiibwe ei ori.',
        sending: 'Nikyohereza SOS…',
      },
      reports: {
        title: 'Ripoota Zangye',
        subtitle: 'Byona ebi waaherize',
        empty: 'Tihariho ripoota.',
        detailTitle: 'Ebirikukwata aha ripoota',
      },
      map: { title: 'Maapu Erikworeka Hati', subtitle: "Orubibi rw'ekibira na ripoota z'abantu" },
      profile: { title: 'Profailo', subtitle: 'Akaunti yaawe', language: 'Orurimi oru okunda' },
    },
  },

  lgg: {
    translation: {
      nav: { home: 'Aku', feed: 'E’yo ozu', map: 'Maapu', chat: 'E’yo tre', sos: 'SOS' },
      common: { optional: 'Le ku', signOut: 'Efu ra', loading: 'Eri emu…' },
      dashboard: {
        greeting: 'Mi ngoni, {{name}}',
        impactLabel: "Ondua 'ba onduaru mba nde si",
        communityAlerts: "Ondri 'ba onduaru ni",
        newAlerts: 'Ondri o’du {{count}} {{park}} ma alia',
        quickReport: 'Ripoti mbele mbele',
        tileSighting: 'Anyapa\nndrezu',
        tileConflict: "'Ba pi anyapa be\nomvezu",
        tileClaim: 'Fe ma aza\nzizu',
        myRecentReports: 'Ripoti mani o’du nderi',
        seeAll: 'Ndre dria',
        noReports: 'Ripoti yo — pe alu ni mile.',
        nearbyAlert: 'Ondri ogogo ni',
        nearbyMeta: 'Enyiri muke — km 3.2 etu vusi',
        liveMap: "Maapu 'ba onduaru curu'do ni",
      },
      sighting: {
        title: 'Anyapa Ndrezu',
        subtitle: 'Ripoti e’yo mi ndrele ri',
        species: 'Anyapa ma suru',
        numberObserved: 'Kalafe ndrele ri',
        behavior: 'Ta o’beza',
        dateTime: "O'du pi sawa be",
        description: 'E’yo nzezu',
        descPlaceholder: 'Mi ndre ngo ya?',
        photoEvidence: 'Foto nzezu',
        voiceNote: 'O’duko m’bezu',
        recording: '● O’duko m’be ra',
        tapToRecord: 'Mbi o’duko m’bezu sekonde 60',
        submit: 'Ripoti pe ra',
      },
      sos: {
        title: 'SOS Ewaru',
        subtitle: 'Askari umvizu mbi alu si',
        intro: 'Mbi ru sekonde 1.5 askari {{park}} ni umvizu pari mini be.',
        liveLocation: 'Pari mi ovuria curu’do',
        locating: 'GPS mini ndazu…',
        locationDenied: 'Pari ma drile ga si ra — a’di setingi ma alia.',
        sent: 'SOS pe ra!',
        sentBody: 'Askari yi umvi ra pari mini be.',
        sending: 'SOS pezu…',
      },
      reports: {
        title: 'Ripoti Mani',
        subtitle: 'E’yo dria mi pele ri',
        empty: 'Ripoti yo.',
        detailTitle: 'Ripoti ma e’yo',
      },
      map: { title: 'Maapu Curu’do', subtitle: "Angu ma kala pi ripoti 'ba ni be" },
      profile: { title: 'Profailo', subtitle: 'Akaunti mini', language: 'Ti le mini ri' },
    },
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

// Restore the persisted choice; components re-render when it lands.
void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((code) => {
  if (code && code !== i18n.language) void i18n.changeLanguage(code);
});

/**
 * Switch the app language by display label (e.g. 'Luganda'). Applies
 * immediately via react-i18next and persists across restarts.
 */
export async function setAppLanguage(label: string): Promise<void> {
  const code = languageCodeFor(label);
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Non-fatal: the selection simply won't persist this session.
  }
}

export default i18n;
