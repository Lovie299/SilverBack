// components/ui/theme.js
// Design tokens ported from the Wildwatch (silverbacksentry.lovable.app)
// stylesheet. OKLCH values converted to sRGB hex.

export const colors = {
  background: '#fcfaf4',
  foreground: '#0b2010',
  card: '#ffffff',
  primary: '#185b37',
  primaryForeground: '#fcfaf3',
  primaryGlow: '#298646',
  secondary: '#f1ebd5',
  secondaryForeground: '#1a3520',
  muted: '#eff0e4',
  mutedForeground: '#5c6759',
  accent: '#ee921a',
  accentForeground: '#0b2010',
  destructive: '#df2225',
  destructiveForeground: '#fcfaf3',
  success: '#00a159',
  warning: '#f2a618',
  info: '#008cba',
  border: '#dedfd4',
  input: '#e5e6da',
  surface: '#f6f6ed',
  white: '#ffffff',
};

// Gradient stops (web used 135deg linear gradients).
export const gradients = {
  forest: ['#0c3d22', '#21763c'],
  sky: ['#71bad1', '#bae0e2'],
  sunset: ['#ee921a', '#f0503d'],
  primaryTile: ['#185b37', '#298646'], // from-primary to-primary-glow
  dangerTile: ['#df2225', '#f54748'], // from-destructive to oklch(.65 .21 25)
  infoTile: ['#007daa', '#4aadc9'],
  accentTile: ['#ee921a', '#d75928'],
  sos: ['#df2225', '#d40924'], // SOS button: destructive → oklch(.55 .22 25)
};

// Landing-page floating portal button colors.
export const portal = {
  background: '#232d10',
  border: '#e0af3b',
};

/** hex (#rrggbb) + alpha 0..1 → rgba() string, for the /10 /15 /20 tints. */
export function alpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const radius = {
  sm: 8,
  md: 12, // rounded-xl
  lg: 16, // rounded-2xl
  xl: 24, // rounded-3xl
  header: 36, // rounded-b-[36px] header curve
  full: 999,
};

// Approximation of --shadow-card / --shadow-float for RN.
export const shadowCard = {
  shadowColor: '#0b2010',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 16,
  elevation: 3,
};

export const shadowFloat = {
  shadowColor: '#185b37',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 20,
  elevation: 8,
};

// Font families (loaded in app/_layout.jsx via @expo-google-fonts).
export const fonts = {
  display: 'PlusJakartaSans_800ExtraBold', // headings ("Wildwatch", titles)
  displayBold: 'PlusJakartaSans_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
