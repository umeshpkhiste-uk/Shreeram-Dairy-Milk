/**
 * Shreeram Daily Milk design tokens.
 *
 * Visual identity (per Master Prompt section 3): white / light-neutral background,
 * dark-green primary, neutral grey supporting colour, restrained status colours.
 * Kept deliberately small — this is an operations tool used outdoors in daylight,
 * not a consumer brand surface.
 */
import { Platform } from 'react-native';

export const palette = {
  white: '#FFFFFF',
  black: '#0B1210',

  green50: '#E6F2EB',
  green100: '#C3E0CE',
  green300: '#5F9A74',
  green600: '#1F5B3B',
  green700: '#174A30',
  green900: '#0F3320',

  grey50: '#F7F8F7',
  grey100: '#EEF0EE',
  grey200: '#DDE1DD',
  grey400: '#9AA39C',
  grey600: '#656D66',
  grey800: '#363D37',

  red500: '#B3261E',
  red50: '#FBEAE9',
  amber500: '#9A6B00',
  amber50: '#FBF2DC',
  blue500: '#2463A8',
  blue50: '#E7F0FA',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  textOnPrimary: string;
  primary: string;
  primaryMuted: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    background: palette.white,
    surface: palette.white,
    surfaceMuted: palette.grey50,
    border: palette.grey200,
    text: palette.black,
    textSecondary: palette.grey600,
    textOnPrimary: palette.white,
    primary: palette.green700,
    primaryMuted: palette.green50,
    icon: palette.grey600,
    tabIconDefault: palette.grey400,
    tabIconSelected: palette.green700,
    success: palette.green600,
    successBg: palette.green50,
    warning: palette.amber500,
    warningBg: palette.amber50,
    danger: palette.red500,
    dangerBg: palette.red50,
    info: palette.blue500,
    infoBg: palette.blue50,
  },
  dark: {
    background: palette.black,
    surface: '#111A15',
    surfaceMuted: '#17221C',
    border: '#243229',
    text: palette.white,
    textSecondary: palette.grey400,
    textOnPrimary: palette.white,
    primary: palette.green300,
    primaryMuted: '#1B2B21',
    icon: palette.grey400,
    tabIconDefault: palette.grey600,
    tabIconSelected: palette.green300,
    success: palette.green300,
    successBg: '#152A1C',
    warning: '#D9A441',
    warningBg: '#2E2412',
    danger: '#E5736C',
    dangerBg: '#2E1515',
    info: '#6FA8DC',
    infoBg: '#142230',
  },
};

export type ThemeColorName = keyof ThemeColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 999,
} as const;

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  android: { sans: 'sans-serif', mono: 'monospace' },
  default: { sans: 'system-ui', mono: 'monospace' },
});

/** Minimum comfortable touch target for workers tapping outdoors, in dp. */
export const MinTouchTarget = 48;
