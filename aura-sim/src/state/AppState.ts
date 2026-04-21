/**
 * Application State Model for Aura Simulator
 * Mirrors the state management from aura/aura.ino
 *
 * This file defines all TypeScript interfaces and types used throughout the simulator.
 * Localization types and data are imported from LocalizedStrings.ts.
 */

// Import dependencies
import { Preferences, createPreferences, SETTINGS_NAMESPACE } from './Preferences';
import { Language, LocalizedStrings } from './LocalizedStrings';

// Re-export convenience functions from Preferences module
export { createPreferences, SETTINGS_NAMESPACE };

// Debug flag for conditional logging
const DEBUG = import.meta.env?.DEV || import.meta.env?.VITE_DEBUG === 'true';

// ============================================================================
// SETTINGS TAB TYPE
// ============================================================================

export type SettingsTab = 'display' | 'general';

// ============================================================================
// SETTINGS INTERFACE
// ============================================================================

/**
 * User-configurable settings, persisted to NVS (localStorage in simulator).
 */
export interface Settings {
  useFahrenheit: boolean;
  use24Hour: boolean;
  useNightMode: boolean;
  useScreenOff: boolean;
  dayBrightness: number;       // 1-255
  nightBrightness: number;     // 1-128
  screenOffTimeout: number;    // seconds: 5, 10, 15, 30, or 60
  language: Language;
  location: string;
  latitude: string;
  longitude: string;
}

// ============================================================================
// WEATHER DATA INTERFACES
// ============================================================================

/**
 * Current weather conditions.
 */
export interface CurrentWeather {
  temp: number;
  feels_like: number;
  code: number;      // WMO weather code
  is_day: number;    // 0 = night, 1 = day
}

/**
 * Daily forecast entry (7 days including today).
 */
export interface DailyForecast {
  day: number;       // 0 = today, 1 = tomorrow, etc.
  date: string;      // ISO date: "2026-03-30"
  high: number;
  low: number;
  code: number;      // WMO weather code
}

/**
 * Hourly forecast entry (next 7 hours).
 */
export interface HourlyForecast {
  hour: number;      // 0-23
  temp: number;
  code: number;      // WMO weather code
  precipitation: number;  // Probability in percent
  is_day: number;    // 0 = night, 1 = day
}

/**
 * Complete weather dataset (current + daily + hourly).
 */
export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

// ============================================================================
// APPLICATION STATE INTERFACE
// ============================================================================

/**
 * Runtime application state. This is the single source of truth for the UI.
 * Mirrors global variables from aura.ino.
 */
export interface AppState {
  // Screen management
  currentScreen: 'wifi_splash' | 'loading' | 'main' | 'settings' | 'location' | 'reset_wifi' | 'no_wifi';

  // Connectivity
  wifiConnected: boolean;

  // Weather loading state
  weatherLoading: boolean;
  weatherData: WeatherData | null;

  // Settings (persisted)
  settings: Settings;

  // Runtime state (not persisted)
  nightModeActive: boolean;
  screenOffActive: boolean;
  tempScreenWakeupActive: boolean;
  lastInteractionMs: number;
  ignoreTouchUntil: number;
  spinnerAngle: number;
  settingsOpenedMs: number;
  activeSettingsTab: SettingsTab;
  lastWeatherUpdateMs: number;

  // Location dialog state (temporary)
  locationSearchQuery: string;
  locationCursorPosition: number; // cursor position within query string (0 = before first char)
  locationResults: string[];
  locationSelectedIndex: number | null;
  locationSearching: boolean;

  // Keyboard state
  keyboardVisible: boolean;
  activeTextInput: 'location' | null;

  // Testing overrides (only used in test environment)
  testOverrides?: {
    disableNightModeSync?: boolean;
    freezeSpinner?: boolean;
    fixedSpinnerAngle?: number;
  };

  // Fixed timestamp for deterministic time display in tests
  testNow?: number;
}

// ============================================================================
// COMPUTED STATE HELPERS
// ============================================================================

/**
 * Derived state calculated from AppState.
 * Used by renderer to avoid recomputing values.
 */
export interface DerivedState {
  isNightTime: boolean;           // 20:00-06:00
  effectiveBrightness: number;    // dayBrightness or nightBrightness based on nightModeActive
  timeString: string;             // formatted clock time
  wifiBars: number;               // 0-4 based on RSSI
  shouldShowHourly: boolean;      // derived from which forecast is currently displayed (stored in state extension)
}

// ============================================================================
// DEFAULT STATE FACTORY
// ============================================================================

/**
 * Creates a default AppState instance with factory defaults.
 * Use this to initialize the simulator state.
 */
export function createDefaultState(): AppState {
  return {
    currentScreen: 'wifi_splash',
    wifiConnected: false,
    weatherLoading: false,
    weatherData: null,
    settings: {
      useFahrenheit: false,
      use24Hour: false,
      useNightMode: false,
      useScreenOff: false,
      dayBrightness: 128,
      nightBrightness: 64,
      screenOffTimeout: 5,
      language: Language.LANG_EN,
      location: 'London',
      latitude: '51.5074',
      longitude: '-0.1278',
    },
    nightModeActive: false,
    screenOffActive: false,
    tempScreenWakeupActive: false,
    lastInteractionMs: 0,
    ignoreTouchUntil: 0,
    spinnerAngle: 0,
    settingsOpenedMs: 0,
    activeSettingsTab: 'display',
    lastWeatherUpdateMs: 0,
    // Location dialog state
    locationSearchQuery: '',
    locationCursorPosition: 0,
    locationResults: [],
    locationSelectedIndex: null,
    locationSearching: false,
    // Keyboard state
    keyboardVisible: false,
    activeTextInput: null,
  };
}

// ============================================================================
// SETTINGS PERSISTENCE
// ============================================================================

/**
 * Default settings values (same as in createDefaultState().settings).
 * Exported for external use.
 */
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  useFahrenheit: false,
  use24Hour: false,
  useNightMode: false,
  useScreenOff: false,
  dayBrightness: 128,
  nightBrightness: 64,
  screenOffTimeout: 5,
  language: Language.LANG_EN,
  location: 'London',
  latitude: '51.5074',
  longitude: '-0.1278',
};

/**
 * Load Settings from Preferences storage (localStorage).
 * Creates a Preferences instance, loads values, and ensures all required fields exist.
 * Validates and clamps values to safe ranges.
 * @param prefs - Optional Preferences instance (for testing/dependency injection)
 * @returns Complete Settings object
 */
export function loadSettings(prefs?: Preferences): Settings {
  const p = prefs || createPreferences(SETTINGS_NAMESPACE, false);

  try {
    const settings: Settings = {
      useFahrenheit: p.getBool('useFahrenheit', DEFAULT_SETTINGS.useFahrenheit),
      use24Hour: p.getBool('use24Hour', DEFAULT_SETTINGS.use24Hour),
      useNightMode: p.getBool('useNightMode', DEFAULT_SETTINGS.useNightMode),
      useScreenOff: p.getBool('useScreenOff', DEFAULT_SETTINGS.useScreenOff),
      dayBrightness: p.getUInt('dayBrightness', DEFAULT_SETTINGS.dayBrightness),
      nightBrightness: p.getUInt('nightBrightness', DEFAULT_SETTINGS.nightBrightness),
      screenOffTimeout: p.getUInt('scrOffTimeout', DEFAULT_SETTINGS.screenOffTimeout),
      language: p.getUInt('language', DEFAULT_SETTINGS.language),
      location: p.getString('location', DEFAULT_SETTINGS.location),
      latitude: p.getString('latitude', DEFAULT_SETTINGS.latitude),
      longitude: p.getString('longitude', DEFAULT_SETTINGS.longitude),
    };

    // Clamp brightness values to valid ranges (1-255 for day, 1-128 for night)
    settings.dayBrightness = Math.max(1, Math.min(255, settings.dayBrightness));
    settings.nightBrightness = Math.max(1, Math.min(128, settings.nightBrightness));

    // Validate screenOffTimeout against allowed values
    const allowedTimeouts = [5, 10, 15, 30, 60];
    if (!allowedTimeouts.includes(settings.screenOffTimeout)) {
      settings.screenOffTimeout = DEFAULT_SETTINGS.screenOffTimeout;
    }

    // Validate language enum
    if (settings.language < Language.LANG_EN || settings.language > Language.LANG_IT) {
      settings.language = DEFAULT_SETTINGS.language;
    }

    return settings;
  } finally {
    // Only end if we created our own instance
    if (!prefs) {
      p.end();
    }
  }
}

/**
 * Save Settings to Preferences storage (localStorage).
 * Writes all settings fields to the provided Preferences instance.
 * @param settings - The Settings object to save
 * @param prefs - Optional Preferences instance (for testing/dependency injection)
 */
export function saveSettings(settings: Settings, prefs?: Preferences): void {
  const p = prefs || createPreferences(SETTINGS_NAMESPACE, false);

  try {
    p.putBool('useFahrenheit', settings.useFahrenheit);
    p.putBool('use24Hour', settings.use24Hour);
    p.putBool('useNightMode', settings.useNightMode);
    p.putBool('useScreenOff', settings.useScreenOff);
    p.putUInt('dayBrightness', settings.dayBrightness);
    p.putUInt('nightBrightness', settings.nightBrightness);
    p.putUInt('scrOffTimeout', settings.screenOffTimeout);
    p.putUInt('language', settings.language);
    p.putString('location', settings.location);
    p.putString('latitude', settings.latitude);
    p.putString('longitude', settings.longitude);
  } finally {
    // Only end if we created our own instance
    if (!prefs) {
      p.end();
    }
  }
}

/**
 * Reset all settings to defaults (clear NVS).
 * Removes all keys from the weather namespace.
 * @param prefs - Optional Preferences instance (for testing/dependency injection)
 */
export function resetSettings(prefs?: Preferences): void {
  const p = prefs || createPreferences(SETTINGS_NAMESPACE, false);

  try {
    p.clear();
    // Note: Arduino Preferences.clear() removes all keys; we don't re-save defaults
  } finally {
    if (!prefs) {
      p.end();
    }
  }
}

// ============================================================================
// LOCAL STORAGE PERSISTENCE (compatibility layer)
// ============================================================================

/**
 * Save settings to localStorage.
 * Mirrors the original saveSettingsToStorage from the early version.
 */
export function saveSettingsToStorage(settings: Settings): void {
  const data = JSON.stringify(settings);
  localStorage.setItem('aura-settings', data);
}

/**
 * Load settings from localStorage.
 * Returns default settings if none saved.
 */
export function loadSettingsFromStorage(): Settings {
  const saved = localStorage.getItem('aura-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all fields exist
      return { ...createDefaultState().settings, ...parsed };
    } catch (e) {
      // Settings corrupted - log warning but use defaults
      console.warn('[AppState] Corrupted settings in localStorage, using defaults:', e);
    }
  }
  return createDefaultState().settings;
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

/**
 * Summary of state model:
 * - Language and LocalizedStrings types imported from LocalizedStrings.ts
 * - 1 interface (Settings, 11 fields)
 * - 3 weather interfaces (CurrentWeather, DailyForecast, HourlyForecast, plus combined WeatherData)
 * - 1 main interface (AppState, 13 fields)
 * - 1 interface (DerivedState, 5 fields)
 * - Factory function: createDefaultState()
 * - Preferences re-exports for persistence
 *
 * Total lines in this file: ~250 (excluding LocalizedStrings module)
 */
