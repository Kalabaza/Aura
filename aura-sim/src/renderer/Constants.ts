// Wrapper for UI constants
// Re-exports all auto‑generated constants from `constants.auto.ts`
// and merges any manual overrides from `overrides.ts`.
// Existing imports such as `import { COLORS, TIMINGS } from './Constants'`
// continue to work unchanged.

import { SCREEN, FONTS, TIMINGS as autoTimings, COLORS as autoColors } from './constants.auto';
import * as overrides from './overrides';

// Preserve semantic Z‑Index enum that existed previously.
export enum ZIndex {
  Background = 0,
  Content = 10,
  Modal = 20,
  Overlay = 30,
}

// Export everything from the auto‑generated module.
export * from './constants.auto';

// Merge manual overrides – overrides take precedence.
export const TIMINGS = { ...autoTimings, ...(overrides.TIMINGS ?? {}) } as const;
export const COLORS = { ...autoColors, ...(overrides.COLORS ?? {}) } as const;

// Manual layout constants (not extracted from firmware)
export const LOADING_SCREEN = {
  background: {
    top: COLORS.backgroundTop,
    bottom: COLORS.backgroundBottom,
  },
  spinner: {
    size: { width: 50, height: 50 },
    position: { x: 0, y: -20 },
    indicatorColor: COLORS.textWhite,
    bgColor: COLORS.spinnerBackground,
    lineWidth: 4,
    arcAngle: 90,
    bgArcAngle: 360,
    rotationSpeed: 4,
    rotationInterval: 16,
  },
  message: {
    font: FONTS.size16,
    color: COLORS.textWhite,
    position: { x: 0, y: 40 },
  },
} as const;

export const MAIN_SCREEN = {
  clock: { position: { x: 10, y: 8 } },
  wifiContainer: {
    size: { width: 22, height: 16 },
    barWidth: 4,
    barRadius: 1,
    bars: [
      { x: 0, y: 12, height: 4, color: COLORS.wifiInactive },
      { x: 5, y: 9, height: 7, color: COLORS.wifiInactive },
      { x: 10, y: 6, height: 10, color: COLORS.wifiInactive },
      { x: 15, y: 3, height: 13, color: COLORS.wifiInactive },
    ],
  },
  todayIcon: { position: { x: 10, y: 28 }, size: { width: 100, height: 100 } },
  todayTemp: { alignTo: { offsetX: 10, offsetY: -12 } },
  feelsLike: { alignTo: { offsetY: 4 } },
  forecastLabel: { position: { x: 10, y: 120 } },
  forecastBox: {
    position: { x: 10, y: 135 },
    size: { width: 220, height: 180 },
    background: COLORS.boxBackground,
    borderRadius: 4,
    padding: 10,
    rowHeight: 24,
  },
} as const;

export const SETTINGS_WINDOW = {
  window: {
    width: 240,
    headerHeight: 30,
    titleMarginLeft: 10,
  },
  tabview: {
    size: { width: 220, height: 210 },
    tabButtonHeight: 30,
  },
  displayTab: {
    timeoutDropdown: {
      width: 120,
    },
  },
  generalTab: {
    locationValue: {
      width: 110,
    },
    languageDropdown: {
      width: 120,
    },
  },
} as const;

export const LOCATION_DIALOG = {
  window: {
    headerHeight: 30,
  },
  cityLabel: {
    position: { x: 5, y: 5 },
  },
  textarea: {
    position: { x: 0, y: 4 },
    width: 212,
  },
  resultsLabel: {
    alignTo: { offsetX: 0, offsetY: 10 },
  },
  resultsDropdown: {
    alignTo: { offsetX: 0, offsetY: 4 },
    width: 212,
  },
  cancelButton: {
    size: { width: 90, height: 36 },
    position: { x: 5, y: -5 },
  },
  saveButton: {
    size: { width: 90, height: 36 },
    position: { x: -5, y: -5 },
  },
} as const;

export const RESET_WIFI_MODAL = {
  msgbox: {
    width: 230,
    border: {
      width: 2,
      radius: 4,
      color: COLORS.textWhite,
    },
    titleMarginLeft: 10,
  },
} as const;

export const WIFI_SPLASH_SCREEN = {
  background: {
    top: COLORS.backgroundTop,
    bottom: COLORS.backgroundBottom,
  },
  message: {
    font: FONTS.size14,
    color: COLORS.textWhite,
  },
} as const;

export const DIMENSIONS = {
  defaultButtonSize: {
    width: 90,
    height: 36,
  },
  switchSize: {
    width: 40,
    height: 20,
  },
  sliderWidth: 120,
} as const;
