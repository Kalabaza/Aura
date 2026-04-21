/**
 * Night Mode & Screen-Off Manager for Aura Simulator
 *
 * Mirrors the behavior from aura/aura.ino:
 * - Night mode active 20:00-06:00 local time
 * - Screen off after timeout when enabled
 * - Touch wakes screen temporarily (500ms ignore period)
 *
 * Based on firmware functions:
 * - night_mode_should_be_active()
 * - update_screen_behavior()
 * - handle_temp_screen_wakeup_timeout()
 */

import { Settings } from '../state/AppState';

// Constants from firmware
const NIGHT_MODE_START_HOUR = 20; // 8PM
const NIGHT_MODE_END_HOUR = 6; // 6AM
const TOUCH_IGNORE_AFTER_WAKE_MS = 500; // Ignore touches for 500ms after wake

/**
 * Runtime state for night mode and screen-off management.
 * This state is NOT persisted; it's regenerated each session.
 */
export interface NightModeRuntimeState {
  /** Is night mode currently active (based on time and settings) */
  nightModeActive: boolean;
  /** Is screen currently off due to inactivity */
  screenOffActive: boolean;
  /** Is temporary wakeup active (screen on but will turn off after timeout) */
  tempScreenWakeupActive: boolean;
  /** Timestamp of last user interaction (touch) */
  lastInteractionMs: number;
  /** Timestamp until which touches should be ignored (after wake) */
  ignoreTouchUntil: number;
}

/**
 * Configuration for the NightModeManager.
 */
export interface NightModeConfig {
  /** Whether night mode feature is enabled in settings */
  useNightMode: boolean;
  /** Whether screen-off feature is enabled in settings */
  useScreenOff: boolean;
  /** Day brightness (1-255) */
  dayBrightness: number;
  /** Night brightness (1-128) */
  nightBrightness: number;
  /** Screen off timeout in seconds (5, 10, 15, 30, or 60) */
  screenOffTimeout: number;
}

/**
 * NightModeManager encapsulates all logic for night mode and screen-off behavior.
 *
 * Usage:
 *   const manager = new NightModeManager(settings);
 *   manager.update(); // call every frame/interval
 *   const shouldProcessTouch = manager.onTouch(); // call on user touch
 *   const state = manager.getState();
 */
export class NightModeManager {
  private config: NightModeConfig;
  private state: NightModeRuntimeState;

  /**
   * Creates a new NightModeManager.
   * @param config - Settings configuration
   * @param initialState - Optional initial state (for testing/resume)
   */
  constructor(config: NightModeConfig, initialState?: Partial<NightModeRuntimeState>) {
    this.config = config;
    // If initialState provides lastInteractionMs of 0, treat it as uninitialized and use current time
    const initialized = initialState || {};
    if (initialized.lastInteractionMs === 0) {
      initialized.lastInteractionMs = Date.now();
    }
    this.state = {
      nightModeActive: false,
      screenOffActive: false,
      tempScreenWakeupActive: false,
      lastInteractionMs: Date.now(),
      ignoreTouchUntil: 0,
      ...initialized,
    };
  }

  /**
   * Updates the configuration (e.g., when settings change).
   * @param config - New configuration (partial update)
   */
  public updateConfig(config: Partial<NightModeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Updates the manager state. Should be called on each frame or at regular intervals
   * (firmware uses 1-second interval).
   *
   * This handles:
   * - Night mode activation/deactivation based on time of day
   * - Screen-off detection after inactivity
   * - Temp wakeup timeout (turns screen off after wakeup period)
   *
   * @param now - Current timestamp (defaults to Date.now())
   */
  public update(now: number = Date.now()): void {
    // 1. Update night mode status
    this.updateNightMode(now);

    // 2. Update temp wakeup timeout
    if (this.state.tempScreenWakeupActive) {
      const timeoutMs = this.config.screenOffTimeout * 1000;
      if (now - this.state.lastInteractionMs > timeoutMs) {
        // Temp wakeup period ended; clear flag so screen can turn off
        this.state.tempScreenWakeupActive = false;
      }
    }

    // 3. Update screen-off status (if feature enabled)
    if (this.config.useScreenOff) {
      this.updateScreenOff(now);
    } else {
      // If feature disabled, ensure screen is not off
      if (this.state.screenOffActive) {
        this.state.screenOffActive = false;
      }
    }
  }

  /**
   * Called when user touches the screen.
   * Handles waking the screen if it was off, and resets inactivity timer.
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns True if the touch should be processed, false if ignored due to wake cooldown or screen off (the wake consumes the touch)
   */
  public onTouch(now: number = Date.now()): boolean {
    // Update last interaction time
    this.state.lastInteractionMs = now;

    // If screen is off, wake it up and ignore this touch (it's consumed)
    if (this.state.screenOffActive) {
      this.wakeScreen(now);
      this.state.ignoreTouchUntil = now + TOUCH_IGNORE_AFTER_WAKE_MS;
      return false; // Touch consumed by wake
    }

    // Check if we're in the ignore period after a wake
    if (now < this.state.ignoreTouchUntil) {
      return false; // Ignore this touch
    }

    // Touch is valid and should be processed
    return true;
  }

  /**
   * Forces the screen to wake up (e.g., when WiFi connects or settings opened).
   * Resets screen-off state and interaction timer.
   *
   * @param now - Current timestamp
   */
  public forceWake(now: number = Date.now()): void {
    this.state.lastInteractionMs = now;
    if (this.state.screenOffActive) {
      this.wakeScreen(now);
    }
    this.state.ignoreTouchUntil = 0;
  }

  /**
   * Gets the current runtime state.
   */
  public getState(): NightModeRuntimeState {
    return { ...this.state };
  }

  /**
   * Gets the effective brightness based on night mode status.
   * Returns nightBrightness if night mode active, otherwise dayBrightness.
   */
  public getEffectiveBrightness(): number {
    if (this.state.nightModeActive && this.config.useNightMode) {
      return this.config.nightBrightness;
    }
    return this.config.dayBrightness;
  }

  /**
   * Checks if the night mode time condition currently holds (20:00-06:00).
   * This is a pure function of the current time.
   *
   * @param now - Current timestamp
   * @returns True if the current hour falls within night mode hours
   */
  public isNightModeTime(now: number = Date.now()): boolean {
    const hour = new Date(now).getHours();
    return hour >= NIGHT_MODE_START_HOUR || hour < NIGHT_MODE_END_HOUR;
  }

  /**
   * Checks if a touch at the given time would be ignored due to the post-wake cooldown.
   * @param now - Current timestamp
   * @returns True if touch should be ignored
   */
  public shouldIgnoreTouch(now: number = Date.now()): boolean {
    return now < this.state.ignoreTouchUntil;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Updates night mode status based on current time.
   * Activates if settings enable night mode AND current hour is 20-6.
   *
   * @param now - Current timestamp
   */
  private updateNightMode(now: number): void {
    if (!this.config.useNightMode) {
      // If night mode disabled, ensure it's off
      if (this.state.nightModeActive) {
        this.state.nightModeActive = false;
      }
      return;
    }

    const shouldBeActive = this.isNightModeTime(now);
    if (shouldBeActive !== this.state.nightModeActive) {
      this.state.nightModeActive = shouldBeActive;
    }
  }

  /**
   * Updates screen-off state based on inactivity.
   * Turns screen off if:
   * - useScreenOff is true
   * - screen is not already off
   * - temp wakeup is not active
   * - last interaction was longer ago than timeout
   *
   * @param now - Current timestamp
   */
  private updateScreenOff(now: number): void {
    if (this.state.screenOffActive) {
      return;
    }

    const timeoutMs = this.config.screenOffTimeout * 1000;
    if (now - this.state.lastInteractionMs > timeoutMs) {
      this.turnScreenOff();
    }
  }

  /**
   * Turns the screen off.
   */
  private turnScreenOff(): void {
    this.state.screenOffActive = true;
    // Note: tempScreenWakeupActive remains as is (should be false here)
  }

  /**
   * Wakes the screen from off state.
   * Sets temp wakeup active flag and resets interaction timer.
   *
   * @param now - Current timestamp
   */
  private wakeScreen(now: number): void {
    this.state.screenOffActive = false;
    this.state.tempScreenWakeupActive = true;
    this.state.lastInteractionMs = now;
    this.state.ignoreTouchUntil = 0;
  }
}

/**
 * Factory function to create NightModeManager from Settings.
 * @param settings - The Settings object
 * @param initialState - Optional initial runtime state (e.g., to restore from previous session)
 * @returns New NightModeManager instance
 */
export function createNightModeManager(settings: Settings, initialState?: Partial<NightModeRuntimeState>): NightModeManager {
  const config: NightModeConfig = {
    useNightMode: settings.useNightMode,
    useScreenOff: settings.useScreenOff,
    dayBrightness: settings.dayBrightness,
    nightBrightness: settings.nightBrightness,
    screenOffTimeout: settings.screenOffTimeout,
  };
  return new NightModeManager(config, initialState);
}
