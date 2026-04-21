/**
 * Aura Simulator - Main Application Controller
 *
 * This class serves as the central orchestrator for the simulator,
 * managing application state and coordinating widget rendering.
 *
 * Architecture:
 * - Maintains the single source of truth (AppState)
 * - Creates and owns the CanvasRenderer
 * - Manages screen transitions (currentScreen)
 * - Implements the render loop (requestAnimationFrame)
 * - Delegates widget rendering based on state
 *
 * This mirrors the main application loop from aura.ino while adapting
 * to the browser environment.
 *
 * Usage:
 *   const app = new App(canvasElement);
 *   await app.init();
 *   app.startLoop();
 *
 * State changes:
 *   app.updateState({ currentScreen: 'settings' });
 *   // Automatically triggers re-render on next frame
 */

import { CanvasRenderer } from './renderer/CanvasRenderer';
import type {
  AppState,
  Settings,
  DailyForecast,
  HourlyForecast,
  CurrentWeather,
} from './state/AppState';
import {
  createDefaultState,
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from './state/AppState';
import { get_strings, Language } from './state/LocalizedStrings';
import {
  MainScreen,
  SettingsWindow,
  SettingsWindowCallbacks,
  LocationDialog,
  LocationDialogProps,
  LoadingSpinner,
  WifiSplash,
  ResetWifiModal,
  SettingsTab,
  VirtualKeyboard,
} from './renderer/Widgets';
import { preloadAllIcons } from './renderer/Widgets/MainScreen';
import { SCREEN, TIMINGS } from './renderer/Constants';
import { NightModeManager, createNightModeManager } from './features/NightModeManager';
import { WeatherMock } from './mock/WeatherMock';

/// <reference types="vite/client" />

// ============================================================================
// DEBUG FLAG
// ============================================================================

// Enable verbose logging in development or when explicitly set
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

// ============================================================================
// SCREEN TYPE UNION (mirrors currentScreen in AppState)
// ============================================================================

export type ScreenType = 'main' | 'settings' | 'location' | 'reset_wifi' | 'loading' | 'wifi_splash' | 'no_wifi';

// ============================================================================
// APP CLASS
// ============================================================================

export class App {
  // ==========================================================================
  // INSTANCE PROPERTIES
  // ==========================================================================

  /** Canvas element to render to (provided in constructor) */
  private canvas: HTMLCanvasElement;

  /** Canvas renderer instance */
  public readonly renderer: CanvasRenderer;

  /** Current application state (single source of truth) */
  private state: AppState;

  /** Animation frame request ID */
  private animationFrameId: number | null = null;

  /** Whether the render loop is active */
  private isRunning: boolean = false;

  /** Widget instances (reused across renders) */
  private mainScreen: MainScreen | null = null;
  private settingsWindow: SettingsWindow | null = null;
  private locationDialog: LocationDialog | null = null;
  private loadingSpinner: LoadingSpinner | null = null;
  private wifiSplash: WifiSplash | null = null;
  private resetWifiModal: ResetWifiModal | null = null;
  private virtualKeyboard: VirtualKeyboard;
  private currentKeyboardMode: 'letters' | 'numeric' = 'letters';

  /** Settings auto-close timeout timer ID (browser setTimeout) */
  private settingsTimeoutId: number | null = null;

  /** Current screen type (computed from state.currentScreen) */
  private currentScreen: ScreenType = 'wifi_splash';

  /** Derived state cache (for optimized rendering) */
  private derivedState!: {
    strings: ReturnType<typeof get_strings>;
    effectiveBrightness: number;
    isNightTime: boolean;
    timeString: string;
  };

  /** Render optimization: track last render time for throttling */
  private lastRenderTime: number = 0;

  /** Whether a full render is needed on next frame (set by state changes) */
  private needsRender: boolean = true;

  /** Track font loading status - keep rendering until Montserrat is confirmed loaded */
  private fontsLoaded: boolean = typeof document !== 'undefined' && (document.fonts?.check('12px Montserrat') ?? true);

  /** Night mode and screen-off manager */
  private nightModeManager!: NightModeManager;

  /** Pre-allocated callbacks for settings window (created once) */
  private settingsCallbacks?: SettingsWindowCallbacks;

  /** Pre-allocated props for location dialog (created once) */
  private locationDialogProps?: LocationDialogProps;

  /** Pre-allocated callbacks for reset WiFi modal (created once) */
  private resetWifiCallbacks?: { onCancel: () => void; onConfirm: () => void };

  // ==========================================================================
  // CALLBACK FACTORY (eliminates duplication)
  // ==========================================================================

  /** Create settings callbacks - called once, stored, and reused */
  private createSettingsCallbacks(): SettingsWindowCallbacks {
    return {
      onTabChange: (tab: SettingsTab) => this.updateState({ activeSettingsTab: tab }),
      onClose: () => this.setScreen('main'),
      onResetWiFi: () => this.setScreen('reset_wifi'),
      onChangeLocation: () => this.setScreen('location'),
      onLanguageChange: (lang: Language) => this.handleLanguageChange(lang),
      onBrightnessChange: (value: number) => this.updateState({ settings: { ...this.state.settings, dayBrightness: value } }),
      onNightBrightnessChange: (value: number) => this.updateState({ settings: { ...this.state.settings, nightBrightness: value } }),
      onNightModeToggle: (enabled: boolean) => this.updateState({ settings: { ...this.state.settings, useNightMode: enabled } }),
      onScreenOffToggle: (enabled: boolean) => this.updateState({ settings: { ...this.state.settings, useScreenOff: enabled } }),
      onTimeoutChange: (value: number) => this.updateState({ settings: { ...this.state.settings, screenOffTimeout: value } }),
      onUnitToggle: (useFahrenheit: boolean) => this.updateState({ settings: { ...this.state.settings, useFahrenheit: useFahrenheit } }),
      on24hrToggle: (use24Hour: boolean) => this.updateState({ settings: { ...this.state.settings, use24Hour: use24Hour } }),
    };
  }

  /** Create location dialog props - called once, stored, and reused */
  private createLocationDialogProps(): LocationDialogProps {
    this.locationDialogProps = {
      strings: this.derivedState.strings,
      query: this.state.locationSearchQuery,
      cursorPosition: this.state.locationCursorPosition,
      results: this.state.locationResults,
      selectedIndex: this.state.locationSelectedIndex,
      isSearching: this.state.locationSearching,
      canSave: this.state.locationSelectedIndex !== null && this.state.locationResults.length > 0,
      onQueryChange: (query: string) => {
        this.updateState({ locationSearchQuery: query, locationCursorPosition: query.length });
      },
      onCursorChange: (position: number) => {
        this.updateState({ locationCursorPosition: position });
      },
      onSelectResult: (index: number) => {
        const selected = this.state.locationResults[index];
        this.updateState({
          locationSelectedIndex: index,
          locationSearchQuery: selected,
          locationCursorPosition: selected.length,
        });
      },
      onSave: () => {
        this.updateState({
          settings: { ...this.state.settings, location: this.state.locationSearchQuery },
          keyboardVisible: false,
          activeTextInput: null,
        });
        this.setScreen('main');
      },
      onCancel: () => {
        this.updateState({ keyboardVisible: false, activeTextInput: null, activeSettingsTab: 'general' });
        this.setScreen('settings');
      },
      onFocus: () => {
        this.updateState({ keyboardVisible: true, activeTextInput: 'location' });
      },
      isFocused: this.state.keyboardVisible && this.state.activeTextInput === 'location',
    };
    return this.locationDialogProps;
  }

  /** Create reset WiFi callbacks - called once, stored, and reused */
  private createResetWifiCallbacks(): { onCancel: () => void; onConfirm: () => void } {
    this.resetWifiCallbacks = {
      onCancel: () => this.setScreen('settings'),
      onConfirm: () => {
        this.resetWiFiCredentials();
        this.setScreen('wifi_splash');
      },
    };
    return this.resetWifiCallbacks;
  }

  // ==========================================================================
  // CONSTRUCTION
  // ==========================================================================

  /**
   * Creates a new App instance.
   *
   * @param canvas - The HTMLCanvasElement to render to
   * @param initialState - Optional initial state (uses defaults if omitted)
   */
  constructor(canvas: HTMLCanvasElement, initialState?: Partial<AppState>) {
    this.canvas = canvas;

    // Create renderer using the provided canvas
    this.renderer = new CanvasRenderer(canvas, 1);

    // Initialize state with defaults + any overrides
    this.state = { ...createDefaultState(), ...initialState };

    // Compute initial derived state
    this.updateDerivedState();

    // Initialize widget instances (lazy creation on first use)
    this.mainScreen = null;
    this.settingsWindow = null;
    this.locationDialog = null;
    this.loadingSpinner = null;
    this.wifiSplash = null;
    this.resetWifiModal = null;
    this.virtualKeyboard = new VirtualKeyboard();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the application.
   * - Loads persisted settings from localStorage
   * - Initializes fonts
   * - Sets up initial screen based on WiFi status
   *
   * Call this after constructing the App and before starting the loop.
   */
  public async init(): Promise<void> {
    console.info('[App]', 'Initializing application');

    // Load saved settings from localStorage
    const savedSettings = loadSettingsFromStorage();
    this.state.settings = savedSettings;

    // Initialize night mode manager
    this.nightModeManager = createNightModeManager(savedSettings, {
      lastInteractionMs: this.state.lastInteractionMs,
      ignoreTouchUntil: this.state.ignoreTouchUntil,
    });

    // Apply language to derived state
    this.updateDerivedState();

    // Preload all icons to eliminate first-render loading delays
    console.info('[App]', 'Preloading all icons...');
    try {
      await preloadAllIcons();
    } catch (err) {
      console.error('[App]', 'Icon preload failed:', err);
    }

    // Log initial state summary (debug only)
    if (DEBUG) {
      console.debug('[App]', 'Initial state', {
        wifiConnected: this.state.wifiConnected,
        weatherDataAvailable: !!this.state.weatherData,
        settings: {
          language: savedSettings.language,
          location: savedSettings.location,
          brightness: savedSettings.dayBrightness
        }
      });
    }

    // Determine initial screen based on connectivity and weather data
    if (!this.state.wifiConnected) {
      console.info('[App]', 'WiFi not connected, showing WiFi splash');
      this.setScreen('wifi_splash');
    } else {
      if (!this.state.weatherData) {
        // Show loading and start weather fetch
        console.info('[App]', 'WiFi connected, no weather data - starting fetch');
        this.setScreen('loading');
        this.fetchWeather().catch((err) => {
          console.error('[App]', 'Initial weather fetch failed', err);
        });
      } else {
        console.info('[App]', 'WiFi connected, weather data available - showing main');
        this.setScreen('main');
      }
    }
  }

  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================

  /**
   * Gets the current application state (read-only).
   */
  public getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * Updates application state with partial updates.
   * This is the primary way to modify state from outside the App.
   *
   * @param updates - Partial state object to merge into current state
   *
   * Example:
   *   app.updateState({ currentScreen: 'settings', settingsOpenedMs: Date.now() });
   */
  public updateState(updates: Partial<AppState>): void {
    const prevScreen = this.state.currentScreen;
    const oldWifiConnected = this.state.wifiConnected;
    const oldSettings = this.state.settings;

    // Merge updates into state
    this.state = { ...this.state, ...updates };

    // If testNow is being set, reset night mode manager's interaction timer
    // to prevent auto-screen-off during tests
    if (updates.testNow !== undefined) {
      this.nightModeManager.forceWake(updates.testNow);
    }

    // Check for WiFi connection state change (false -> true)
    if (updates.wifiConnected !== undefined && updates.wifiConnected && !oldWifiConnected) {
      console.info('[App]', 'WiFi connection established');
      // Skip fetch if weatherData is being explicitly set in this update (testing scenario)
      if (!this.state.weatherLoading && !updates.weatherData) {
        this.fetchWeather();
      }
    }

    // If settings changed, persist to localStorage and update NightModeManager config
    if (updates.settings !== undefined) {
      if (DEBUG) {
        console.debug('[App]', 'Settings updated', {
          changes: {
            brightness: updates.settings.dayBrightness !== oldSettings.dayBrightness,
            nightBrightness: updates.settings.nightBrightness !== oldSettings.nightBrightness,
            language: updates.settings.language !== oldSettings.language,
            location: updates.settings.location !== oldSettings.location,
            useNightMode: updates.settings.useNightMode !== oldSettings.useNightMode,
            useScreenOff: updates.settings.useScreenOff !== oldSettings.useScreenOff,
            screenOffTimeout: updates.settings.screenOffTimeout !== oldSettings.screenOffTimeout
          }
        });
      }
      this.persistSettings(this.state.settings);
      this.nightModeManager.updateConfig(updates.settings);
      // If the screen‑off timeout was changed, reset the interaction timer so the new timeout is used immediately.
      if (updates.settings && updates.settings.screenOffTimeout !== undefined) {
        // Reset last interaction to now – this restarts the inactivity countdown.
        this.nightModeManager.forceWake();
      }

      // Check for location or language changes that require new weather data
      // Skip if weatherData is being explicitly set (testing scenario)
      const locationChanged =
        oldSettings.latitude !== this.state.settings.latitude ||
        oldSettings.longitude !== this.state.settings.longitude ||
        oldSettings.location !== this.state.settings.location;
      const languageChanged = oldSettings.language !== this.state.settings.language;
      if ((locationChanged || languageChanged) && this.state.wifiConnected && !this.state.weatherLoading && !updates.weatherData) {
        console.info('[App]', 'Location or language changed, triggering weather fetch');
        this.fetchWeather();
      }
    }

    // Update derived state (strings, computed values)
    this.updateDerivedState();

    // Handle screen transitions (DEBUG only to avoid excessive logging)
    if (updates.currentScreen !== undefined && updates.currentScreen !== prevScreen) {
      if (DEBUG) {
        console.debug('[Navigation]', `Screen transition: ${prevScreen} → ${updates.currentScreen}`);
      }
      this.onScreenChange(prevScreen, updates.currentScreen);
    }

    // Signal render loop to pick up changes on next frame
    this.needsRender = true;
  }

  /**
   * Set the current screen explicitly.
   * Convenience wrapper around updateState({ currentScreen }).
   *
   * @param screen - The screen to display
   */
  public setScreen(screen: ScreenType): void {
    if (screen === 'location') {
      // Initialize location dialog temporary state from current settings
      this.currentKeyboardMode = 'letters';
      this.virtualKeyboard.reset(); // ensure keyboard starts in lower case letters mode
      this.updateState({
        currentScreen: screen,
        locationSearchQuery: this.state.settings.location,
        locationCursorPosition: this.state.settings.location.length,
        locationResults: [],
        locationSelectedIndex: null,
        locationSearching: false,
        keyboardVisible: false,
        activeTextInput: null
      });
    } else {
      // For any other screen, ensure keyboard is hidden
      this.updateState({ currentScreen: screen, keyboardVisible: false, activeTextInput: null });
    }
    // Reset screen‑off timer when entering loading or main screen to avoid countdown drift
    if (screen === 'loading' || screen === 'main') {
      this.nightModeManager.forceWake();
    }
  }

  /**
   * Persists settings to localStorage.
   * Mirrors saveSettingsToStorage from AppState.ts
   */
  private persistSettings(settings: Settings): void {
    try {
      if (DEBUG) {
        console.debug('[Persistence]', 'Saving settings to localStorage', {
          language: settings.language,
          location: settings.location,
          brightness: settings.dayBrightness
        });
      }
      const data = JSON.stringify(settings);
      localStorage.setItem('aura-settings', data);
      if (DEBUG) {
        console.debug('[Persistence]', 'Settings saved successfully');
      }
    } catch (e) {
      console.error('[Persistence]', 'Failed to save settings', e);
    }
  }


  // ==========================================================================
  // LANGUAGE AND WEATHER HANDLING
  // ==========================================================================

  /**
   * Handles a language change request from the settings UI.
   * Mirrors the firmware's behavior when language is changed:
   * - Update settings language
   * - Close settings if open
   * - Weather data refresh is automatically triggered by the settings change
   *
   * @param newLang - The new language to set
   */
  public async handleLanguageChange(newLang: Language): Promise<void> {
    // Update language in settings
    this.updateState({
      settings: { ...this.state.settings, language: newLang }
    });

    // Close settings window and return to main screen if currently open
    if (this.currentScreen === 'settings') {
      this.setScreen('main');
    }
    // No explicit weather fetch needed; updateState will trigger on language change
  }

  /**
   * Fetches weather data from the mock service.
   * @param showLoadingScreen - If true, switches to loading screen when on main (default: true).
   *                               Set to false for silent background updates.
   */
  private async fetchWeather(showLoadingScreen: boolean = true): Promise<void> {
    // Avoid concurrent fetches
    if (this.state.weatherLoading) {
      if (DEBUG) {
        console.debug('[Weather]', 'Fetch already in progress, skipping');
      }
      return;
    }

    const now = Date.now();
    this.updateState({
      weatherLoading: true,
      lastWeatherUpdateMs: now,
    });

    console.info('[Weather]', 'Starting weather fetch', {
      location: this.state.settings.location,
      coords: `${this.state.settings.latitude}, ${this.state.settings.longitude}`
    });

    // Optionally switch to loading screen if we are on main
    if (showLoadingScreen && this.currentScreen === 'main') {
      this.setScreen('loading');
    }

    try {
      const lat = parseFloat(this.state.settings.latitude);
      const lon = parseFloat(this.state.settings.longitude);
      const location = this.state.settings.location;
      const data = await WeatherMock.updateWeather(lat, lon, location);

      // Log concise summary (avoid full data dump except in DEBUG)
      const summary = {
        currentTemp: data.current.temp,
        code: data.current.code,
        forecastDays: data.daily.length
      };

      console.info('[Weather]', 'Weather fetch completed', summary);

      this.updateState({
        weatherData: data,
        weatherLoading: false,
      });

      // If we showed a loading screen, return to main after success
      if (showLoadingScreen && this.currentScreen === 'loading') {
        this.setScreen('main');
      }
    } catch (error) {
      console.error('[Weather]', 'Weather fetch failed', error);
      this.updateState({ weatherLoading: false });
      if (showLoadingScreen && this.currentScreen === 'loading') {
        if (this.state.weatherData) {
          this.setScreen('main');
        }
        // else remain on loading (spinner stops)
      }
    }
  }

  // ==========================================================================
  // SCREEN TRANSITION HANDLING
  // ==========================================================================

  /**
   * Called when the current screen changes.
   * Manages widget lifecycle and performs screen-specific initialization/cleanup.
   *
   * @param from - Previous screen
   * @param to - New screen
   */
  private onScreenChange(from: string, to: string): void {
    this.currentScreen = to as ScreenType;

    if (DEBUG) {
      console.debug('[Navigation]', `Screen change: ${from} → ${to}`, {
        widgets: {
          loadingSpinner: !!this.loadingSpinner,
          wifiSplash: !!this.wifiSplash,
          settingsWindow: !!this.settingsWindow,
          locationDialog: !!this.locationDialog,
          resetWifiModal: !!this.resetWifiModal
        }
      });
    }

    // Clean up: stop animations for widgets that are being hidden
    if (from === 'loading' && this.loadingSpinner) {
      this.loadingSpinner.stop();
    }

    // Handle settings timeout timer
    if (from === 'settings') {
      this.cancelSettingsTimeout();
    }

    // Initialize new screen widgets if needed
    switch (to) {
      case 'loading':
        if (!this.loadingSpinner) {
          this.loadingSpinner = new LoadingSpinner(this.renderer, this.derivedState.strings.weather_updating);
        }
        this.loadingSpinner.start();
        break;

      case 'wifi_splash':
        if (!this.wifiSplash) {
          this.wifiSplash = new WifiSplash(this.renderer);
        }
        break;

      case 'settings':
        if (!this.settingsWindow) {
          this.settingsWindow = new SettingsWindow();
          // Create callbacks ONCE and store for reuse
          this.settingsCallbacks = this.createSettingsCallbacks();
        }
        // Start the auto-close timeout (30 seconds)
        this.startSettingsTimeout();
        break;

      case 'location':
        if (!this.locationDialog) {
          this.locationDialog = new LocationDialog();
          this.createLocationDialogProps();
        }
        break;

      case 'reset_wifi':
        if (!this.resetWifiModal) {
          this.resetWifiModal = new ResetWifiModal();
          this.createResetWifiCallbacks();
        }
        break;
    }
  }

  // ==========================================================================
  // DERIVED STATE COMPUTATION
  // ==========================================================================

  /**
   * Updates derived/computed state from the current app state.
   * This includes localized strings, night mode detection, etc.
   */
  private updateDerivedState(): void {
    const settings = this.state.settings;
    const strings = get_strings(settings.language);

    // Use testNow override for deterministic time in tests if provided
    const now = this.state.testNow ? new Date(this.state.testNow) : new Date();
    const hour = now.getHours();
    const isNightTime = hour >= 20 || hour < 6;

    // Determine effective brightness based on night mode
    const effectiveBrightness = (this.state.nightModeActive && settings.useNightMode)
      ? settings.nightBrightness
      : settings.dayBrightness;

    this.derivedState = {
      strings,
      isNightTime,
      effectiveBrightness,
      timeString: this.formatTime(now, settings.use24Hour, strings),
    };
  }

  /**
   * Formats the current time as a string.
   */
  private formatTime(date: Date, use24Hour: boolean, strings: ReturnType<typeof get_strings>): string {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (use24Hour) {
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } else {
      const h = hours % 12 || 12;
      const suffix = hours < 12 ? strings.am : strings.pm;
      return `${h}:${minutes}${suffix}`;
    }
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  /**
   * Main render function.
   * Called on each animation frame or when state changes.
   * Clears the canvas and renders the appropriate widget for the current screen.
   */
  public render(): void {
    // If the screen is off (and not on WiFi splash), clear everything and draw a solid black screen.
    if (this.state.screenOffActive && this.currentScreen !== 'wifi_splash' && this.currentScreen !== 'no_wifi') {
      this.renderer.clear();
      this.renderScreenOffOverlay();
      // Do not render any other UI elements while the screen is off.
      return;
    }

    // Normal rendering path – clear canvas first
    this.renderer.clear();

    // Render based on current screen
    switch (this.currentScreen) {
      case 'main':
        this.renderMainScreen();
        break;

      case 'settings':
        this.renderSettingsWindow();
        break;

      case 'location':
        this.renderLocationDialog();
        break;

      case 'loading':
        this.renderLoadingSpinner();
        break;

      case 'wifi_splash':
        this.renderWifiSplash();
        break;

      case 'reset_wifi':
        this.renderResetWifiModal();
        break;

      case 'no_wifi':
        // Fallback - could render a simple "no WiFi" message or redirect to splash
        this.renderWifiSplash();
        break;
    }

    // Render virtual keyboard if visible (on top of current screen)
    if (this.state.keyboardVisible) {
      this.virtualKeyboard.render(this.renderer, {
        visible: true,
        onKey: (k) => this.handleKeyboardInput(k)
      });
    }
  }

  /**
   * Renders a semi-transparent black overlay to simulate screen off.
   * The overlay covers the entire screen with ~90% opacity.
   */
  private renderScreenOffOverlay(): void {
    const ctx = this.renderer.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);
  }

  /**
   * Renders the main weather screen.
   * MainScreen.render() is async (due to icon loading) but we fire-and-forget.
   */
  private renderMainScreen(): void {
    if (!this.mainScreen) {
      this.mainScreen = new MainScreen({ currentForecast: 'daily' });
    }

    // Fire-and-forget; errors caught in catch
    this.mainScreen.render(this.renderer, this.state, this.derivedState.timeString).catch((err) => {
      console.error('[MainScreen] Render error:', err);
    });
  }

  /**
   * Renders the settings window modal.
   */
  private renderSettingsWindow(): void {
    if (!this.settingsWindow) {
      this.settingsWindow = new SettingsWindow();
    }

    const { strings } = this.derivedState;
    const { settings } = this.state;

    // Use pre-allocated callbacks (created in onScreenChange)
    if (!this.settingsCallbacks) {
      throw new Error('Settings callbacks not initialized - this should never happen');
    }

    this.settingsWindow.render(
      this.renderer,
      settings,
      this.state.activeSettingsTab,
      strings,
      this.settingsCallbacks
    );
  }

  /**
   * Renders the location search dialog.
   */
  private renderLocationDialog(): void {
    if (!this.locationDialog) {
      this.locationDialog = new LocationDialog();
    }

    // Rebuild props for render with current state (callbacks stay stable)
    const props: LocationDialogProps = {
      ...this.locationDialogProps!,
      strings: this.derivedState.strings,
      query: this.state.locationSearchQuery,
      cursorPosition: this.state.locationCursorPosition,
      results: this.state.locationResults,
      selectedIndex: this.state.locationSelectedIndex,
      isSearching: this.state.locationSearching,
      canSave: this.state.locationSelectedIndex !== null && this.state.locationResults.length > 0,
      isFocused: this.state.keyboardVisible && this.state.activeTextInput === 'location',
    };

    this.locationDialog.render(this.renderer, props);
  }

  /**
   * Renders the loading spinner.
   */
  private renderLoadingSpinner(): void {
    if (!this.loadingSpinner) {
      this.loadingSpinner = new LoadingSpinner(this.renderer, this.derivedState.strings.weather_updating);
      this.loadingSpinner.start();
    }

    // Apply test overrides for deterministic animation
    if (this.state.testOverrides?.freezeSpinner) {
      this.loadingSpinner.stop();
      if (this.state.testOverrides.fixedSpinnerAngle !== undefined) {
        this.loadingSpinner.setAngle(this.state.testOverrides.fixedSpinnerAngle);
      } else {
        this.loadingSpinner.setAngle(0);
      }
    }

    this.loadingSpinner.render();
  }

  /**
   * Renders the WiFi configuration splash screen.
   */
  private renderWifiSplash(): void {
    if (!this.wifiSplash) {
      this.wifiSplash = new WifiSplash(this.renderer);
    }

    this.wifiSplash.render(this.derivedState.strings.wifi_config);
  }

  /**
   * Renders the reset WiFi confirmation modal.
   */
  private renderResetWifiModal(): void {
    if (!this.resetWifiModal) {
      this.resetWifiModal = new ResetWifiModal();
    }

    const { strings } = this.derivedState;

    this.resetWifiModal.render(
      this.renderer,
      strings,
      strings.reset_confirmation,
      () => {
        // Cancel - go back to settings
        this.setScreen('settings');
      },
      () => {
        // Confirm - reset WiFi credentials
        this.resetWiFiCredentials();
        this.setScreen('wifi_splash');
      }
    );
  }

  /**
   * Resets WiFi credentials.
   * Clears stored WiFi and returns to WiFi splash for reconfiguration.
   */
  private resetWiFiCredentials(): void {
    // Clear WiFi-related data from storage
    try {
      // In a real implementation, this would clear NVS namespace
      localStorage.removeItem('wifi-ssid');
      localStorage.removeItem('wifi-password');
      localStorage.removeItem('wifi-config');
    } catch (e) {
      console.error('[App] Failed to reset WiFi credentials:', e);
    }

    // Update state to reflect disconnected status
    this.updateState({
      wifiConnected: false,
      currentScreen: 'wifi_splash',
    });
  }

  // ==========================================================================
  // RENDER LOOP
  // ==========================================================================

  /**
   * Starts the animation/render loop.
   * Uses requestAnimationFrame for smooth 60fps rendering.
   * The loop calls render() on each frame and automatically
   * handles screen transitions and widget animations.
   */
  public startLoop(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Force render on first frame to catch any late-init state changes
    // (e.g. font loading completing after init but before first loop tick)
    let forceNextRender = true;

    const loop = (): void => {
      if (!this.isRunning) return;

      try {
        // Update dynamic state; returns true if render needed
        if (this.update() || forceNextRender) {
          forceNextRender = false;
          this.render();
        }
      } catch (err) {
        console.error('[App] Render loop error:', err);
        this.render(); // render anyway on error to show something
      }

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stops the render loop.
   * Use this to pause rendering (e.g., when tab is inactive).
   */
  public stopLoop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update method called on each frame before rendering.
   * Returns true if a re-render is needed; false otherwise.
   */
  private update(): boolean {
    // Use fixed test time for night mode/screen-off if provided, else real time
    const deterministicNow = this.state.testNow ?? Date.now();
    const wasScreenOff = this.state.screenOffActive; // capture previous state

    // Determine if we should apply screen-off logic (skip on loading and splash screens)
    const skipScreenOff = this.currentScreen === 'loading' || this.currentScreen === 'wifi_splash' || this.currentScreen === 'no_wifi';

    if (!skipScreenOff) {
      // Update night mode and screen-off behavior with consistent time source
      this.nightModeManager.update(deterministicNow);
      // Sync runtime state from manager into AppState
      const nmState = this.nightModeManager.getState();
      this.state.nightModeActive = nmState.nightModeActive;
      this.state.screenOffActive = nmState.screenOffActive;
      this.state.tempScreenWakeupActive = nmState.tempScreenWakeupActive;
      this.state.lastInteractionMs = nmState.lastInteractionMs;
      this.state.ignoreTouchUntil = nmState.ignoreTouchUntil;
    } else {
      // Ensure screen stays on and timer does not count down during these screens
      this.state.screenOffActive = false;
      this.state.lastInteractionMs = deterministicNow;
    }



    // If screen-off state changed, request immediate render
    if (wasScreenOff !== this.state.screenOffActive) {
      this.needsRender = true;
      return true; // force render this frame
    }

    // If screen just turned off and settings is open, close settings (matching firmware)
    if (!wasScreenOff && this.state.screenOffActive && this.currentScreen === 'settings') {
      // Screen turned off while Settings was open. Keep settings closed but do not wake the screen.
      // Do not change screen; screenOffActive will keep display off.
      return true;
    }

    // Periodic weather update check (use real time to avoid false triggers during tests)
    const realNow = Date.now();
    if (
      this.state.wifiConnected &&
      !this.state.weatherLoading &&
      realNow - this.state.lastWeatherUpdateMs > TIMINGS.weatherUpdateInterval
    ) {
      this.updateState({ lastWeatherUpdateMs: realNow });
      this.fetchWeather(false); // silent background update
      return true;
    }

    // Update clock (time string) - only re-render main screen when the minute changes
    // For animated screens (loading), always render
    const oldTimeString = this.derivedState?.timeString ?? '';
    this.updateDerivedState();
    const timeChanged = this.derivedState.timeString !== oldTimeString;

    // Loading spinner always needs render (animated)
    if (this.currentScreen === 'loading') return true;

    // Capture needsRender before clearing it
    const needsRenderNow = this.needsRender;
    this.needsRender = false;

    // Keep rendering until Montserrat font is confirmed loaded (prevents fallback font flicker)
    if (!this.fontsLoaded) {
      if (typeof document !== 'undefined' && document.fonts?.check('12px Montserrat')) {
        this.fontsLoaded = true;
      }
      return true; // keep rendering until fonts confirm loaded
    }

    // Main screen: render when state changed or time changes to the minute
    if (this.currentScreen === 'main') return needsRenderNow || timeChanged;
    // Other static screens: render when state changed or time changes
    return needsRenderNow || timeChanged;
  }

  // ==========================================================================
  // SETTINGS TIMEOUT MANAGEMENT
  // ==========================================================================

  /**
   * Starts the settings auto-close timer (30 seconds).
   * Called when the settings screen is opened.
   */
  private startSettingsTimeout(): void {
    this.cancelSettingsTimeout(); // Ensure no existing timer
    // Auto-close settings after 5 seconds
    this.settingsTimeoutId = window.setTimeout(() => {
      this.settingsTimeoutId = null;
      // Close settings and return to main screen without resetting screen‑off timer.
      // Directly update state to avoid invoking setScreen (which force‑wakes).
      this.updateState({ currentScreen: 'main', keyboardVisible: false, activeTextInput: null });
    }, 5000);
  }

  /**
   * Resets the settings auto-close timer.
   * Called on any user interaction while settings is active.
   */
  private resetSettingsTimeout(): void {
    this.cancelSettingsTimeout();
    this.startSettingsTimeout();
  }

  /**
   * Cancels the settings auto-close timer.
   * Called when leaving the settings screen.
   */
  private cancelSettingsTimeout(): void {
    if (this.settingsTimeoutId !== null) {
      window.clearTimeout(this.settingsTimeoutId);
      this.settingsTimeoutId = null;
    }
  }

  // ==========================================================================
  // EVENT HANDLING (to be implemented in Phase 4)
  // ==========================================================================

  /**
   * Handles touch/click events on the canvas.
   * Delegates to the current screen's widget if it implements touch handling.
   *
   * @param x - X coordinate (0-239)
   * @param y - Y coordinate (0-319)
   */
  public handleTouch(x: number, y: number): boolean {
    // Use consistent time source (test time if available)
    const now = this.state.testNow ?? Date.now();

    // Capture previous screen off state to detect wake
    const wasScreenOff = this.state.screenOffActive;

    // First, let the night mode manager process the touch (handles screen wake, cooldown)
    const shouldProcess = this.nightModeManager.onTouch(now);

    // Sync runtime state from manager into AppState (includes potential screen wake)
    const nmState = this.nightModeManager.getState();
    // Respect test override for night mode
    if (!this.state.testOverrides?.disableNightModeSync) {
      this.state.nightModeActive = nmState.nightModeActive;
    }
    this.state.screenOffActive = nmState.screenOffActive;
    this.state.tempScreenWakeupActive = nmState.tempScreenWakeupActive;
    this.state.lastInteractionMs = nmState.lastInteractionMs;
    this.state.ignoreTouchUntil = nmState.ignoreTouchUntil;
    // Request a render when screen-off state changes (off -> on or on -> off)
    if (wasScreenOff !== this.state.screenOffActive) {
      this.needsRender = true;
      // Dispatch events for UI updates when screen state changes
      const canvas = this.canvas;
      if (canvas) {
        if (this.state.screenOffActive === false && wasScreenOff) {
          canvas.dispatchEvent(new Event('screen-wake'));
        } else if (this.state.screenOffActive && !wasScreenOff) {
          canvas.dispatchEvent(new Event('screen-off'));
        }
      }
    }

    // If touch is ignored (screen off wake cooldown), skip further processing
    if (!shouldProcess) {
      return false;
    }

    // Any valid interaction resets the settings timeout if settings is open
    if (this.currentScreen === 'settings') {
      this.resetSettingsTimeout();
    }

    // If virtual keyboard is visible, let it handle the touch first
    if (this.state.keyboardVisible) {
      if (this.virtualKeyboard.handleTouch(x, y, { visible: true, onKey: (k) => this.handleKeyboardInput(k), onCancel: () => this.handleKeyboardInput('HIDE') })) {
        this.needsRender = true; // keyboard state changed (case toggle, mode switch)
        return true;
      }
    }

    // Now handle touch with the current screen's widget
    let handled = false;

    switch (this.currentScreen) {
      case 'settings':
        if (this.settingsWindow) {
          handled = this.settingsWindow.handleTouch(
            x,
            y,
            this.state.activeSettingsTab,
            this.settingsCallbacks!
          );
          // Settings interactions (including dropdowns) should trigger a re‑render
          this.needsRender = true;
        }
        break;

      case 'location':
        if (this.locationDialog) {
          handled = this.locationDialog.handleTouch(x, y, this.locationDialogProps!);
        }
        break;

      case 'reset_wifi':
        if (this.resetWifiModal) {
          handled = this.resetWifiModal.handleTouch(
            x,
            y,
            this.resetWifiCallbacks!.onCancel,
            this.resetWifiCallbacks!.onConfirm
          );
        }
        break;

      case 'main':
        if (this.mainScreen) {
          handled = this.mainScreen.handleTouch(x, y);
          // If main screen didn't handle the touch (e.g., touched outside forecast box), open settings
          if (!handled) {
            this.setScreen('settings');
            handled = true;
          } else {
            // Forecast mode was toggled by touch — request a render to show the change
            this.needsRender = true;
          }
        }
        break;
    }

    // Note: lastInteractionMs is already updated by nightModeManager.onTouch()
    // No need to update again here.

    return handled;
  }

  // ==========================================================================
  // KEYBOARD HANDLING
  // ==========================================================================

  /**
   * Handles a key press from the virtual keyboard.
   * @param key - The key that was pressed (character, 'BACKSPACE', or 'DONE')
   */
  private handleKeyboardInput(key: string): void {
    if (this.state.activeTextInput !== 'location') {
      return;
    }

    const query = this.state.locationSearchQuery;
    const cursorPos = this.state.locationCursorPosition;

    switch (key) {
      case 'BACKSPACE':
        if (cursorPos > 0) {
          const newQuery = query.slice(0, cursorPos - 1) + query.slice(cursorPos);
          this.updateState({
            locationSearchQuery: newQuery,
            locationCursorPosition: cursorPos - 1,
            locationSelectedIndex: null
          });
        }
        break;

      case 'DONE':
        this.updateState({ keyboardVisible: false, activeTextInput: null });
        break;

      case 'HIDE':
        this.updateState({ keyboardVisible: false, activeTextInput: null });
        break;

      case 'LEFT':
        if (cursorPos > 0) {
          this.updateState({ locationCursorPosition: cursorPos - 1 });
        }
        break;

      case 'RIGHT':
        if (cursorPos < query.length) {
          this.updateState({ locationCursorPosition: cursorPos + 1 });
        }
        break;

      case 'MODE_LETTERS':
        this.currentKeyboardMode = 'letters';
        break;

      case 'MODE_NUMERIC':
        this.currentKeyboardMode = 'numeric';
        break;

      default:
        // Insert character at cursor position
        const newQuery = query.slice(0, cursorPos) + key + query.slice(cursorPos);
        this.updateState({
          locationSearchQuery: newQuery,
          locationCursorPosition: cursorPos + 1,
          locationSelectedIndex: null
        });
    }
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  /**
   * Gets the canvas element for DOM attachment.
   */
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Gets the current screen type.
   */
  public getCurrentScreen(): ScreenType {
    return this.currentScreen;
  }

  /**
   * Resets the application to initial state (for testing/hot reload).
   */
  public reset(): void {
    this.stopLoop();

    // Reset state to defaults
    this.state = createDefaultState();

    // Re-load settings
    const { loadSettingsFromStorage } = require('./state/AppState');
    this.state.settings = loadSettingsFromStorage();

    // Reinitialize night mode manager with loaded settings
    this.nightModeManager = createNightModeManager(this.state.settings);

    // Clear widgets
    this.mainScreen = null;
    this.settingsWindow = null;
    this.locationDialog = null;
    this.loadingSpinner = null;
    this.wifiSplash = null;
    this.resetWifiModal = null;

    this.updateDerivedState();
    this.setScreen('wifi_splash');
  }
}

// ============================================================================
// FACTORY FUNCTION (optional convenience)
// ============================================================================

/**
 * Creates and initializes an App instance attached to a canvas element.
 *
 * @param canvasId - ID of the canvas element in the DOM, or the element itself
 * @param initialState - Optional initial state overrides
 * @returns Initialized App instance
 */
export async function createApp(canvasId: string | HTMLCanvasElement, initialState?: Partial<AppState>): Promise<App> {
  const canvas = typeof canvasId === 'string'
    ? document.getElementById(canvasId) as HTMLCanvasElement
    : canvasId;

  if (!canvas) {
    throw new Error(`Canvas element not found: ${canvasId}`);
  }

  const app = new App(canvas, initialState);
  await app.init();

  // Setup Hot Module Replacement (HMR) for constants hot reload
  if (import.meta.hot) {
    // Accept updates for the auto-generated constants file (core constants)
    import.meta.hot.accept('./renderer/constants.auto', () => {
      // ES module live bindings automatically update imported constants
      // Render loop will pick up new values on next frame
    });

    // Accept updates for the constants wrapper (manual COLORS and layout)
    import.meta.hot.accept('./renderer/Constants', () => {
      // Constants updated, will be used on next render
    });
  }

  return app;
}
