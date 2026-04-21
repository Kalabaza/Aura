/**
 * Settings Window Widget for Aura Simulator
 *
 * Renders the modal settings window with tabbed interface.
 * Mirrors the create_settings_window() function from aura/aura.ino
 *
 * This widget is stateless - all state is passed via props and the activeTab parameter.
 * It computes its own layout internally based on Constants.ts.
 *
 * Usage:
 *   const settingsWindow = new SettingsWindow();
 *   settingsWindow.render(
 *     renderer,
 *     settings,
 *     activeTab,
 *     strings,
 *     { onTabChange, onClose, onResetWiFi, onChangeLocation }
 *   );
 */

import { CanvasRenderer } from '../CanvasRenderer';
import {
  COLORS,
  FONTS,
  SETTINGS_WINDOW,
  DIMENSIONS,
  SCREEN,
} from '../Constants';
import type { Settings } from '../../state/AppState';
import type { LocalizedStrings, Language } from '../../state/LocalizedStrings';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SettingsTab = 'display' | 'general';

export interface SettingsWindowCallbacks {
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  onResetWiFi: () => void;
  onChangeLocation: () => void;
  onLanguageChange: (lang: Language) => void;
  onBrightnessChange: (value: number) => void;
  onNightBrightnessChange: (value: number) => void;
  onNightModeToggle: (enabled: boolean) => void;
  onScreenOffToggle: (enabled: boolean) => void;
  onTimeoutChange: (value: number) => void;
  onUnitToggle: (useFahrenheit: boolean) => void;
  on24hrToggle: (use24Hour: boolean) => void;
}

/**
 * Internal layout structure with all computed absolute positions.
 */
export interface SettingsWindowLayout {
  // Modal window bounds
  window: { x: number; y: number; width: number; height: number };
  // Header area
  header: { x: number; y: number; width: number; height: number };
  // Tabview container
  tabview: { x: number; y: number; width: number; height: number };
  // Tab buttons
  tabDisplay: { x: number; y: number; width: number; height: number };
  tabGeneral: { x: number; y: number; width: number; height: number };
  // Display tab controls
  brightnessLabel: { x: number; y: number; width: number; height: number };
  brightnessSliderTrack: { x: number; y: number; width: number; height: number };
  nightModeLabel: { x: number; y: number; width: number; height: number };
  nightModeSwitch: { x: number; y: number; width: number; height: number };
  nightBrightnessLabel: { x: number; y: number; width: number; height: number };
  nightBrightnessSliderTrack: { x: number; y: number; width: number; height: number };
  screenOffLabel: { x: number; y: number; width: number; height: number };
  screenOffSwitch: { x: number; y: number; width: number; height: number };
  timeoutLabel: { x: number; y: number; width: number; height: number };
  timeoutDropdown: { x: number; y: number; width: number; height: number };
  // General tab controls
  unitLabel: { x: number; y: number; width: number; height: number };
  unitSwitch: { x: number; y: number; width: number; height: number };
  hour24Label: { x: number; y: number; width: number; height: number };
  hour24Switch: { x: number; y: number; width: number; height: number };
  locationLabel: { x: number; y: number; width: number; height: number };
  locationValue: { x: number; y: number; width: number; height: number };
  languageLabel: { x: number; y: number; width: number; height: number };
  languageDropdown: { x: number; y: number; width: number; height: number };
  changeLocationBtn: { x: number; y: number; width: number; height: number };
  // Footer buttons
  resetWifiBtn: { x: number; y: number; width: number; height: number };
  closeBtn: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// CLASS
// ============================================================================

/**
 * SettingsWindow - Modal settings dialog with tabbed interface.
 *
 * Renders a complete modal window with:
 * - Header with title "Aura Settings"
 * - Tabview with two tabs: Display and General
 * - Display tab: brightness sliders, night mode switch, screen off settings
 * - General tab: unit switch, 24hr switch, location display, language dropdown
 * - Footer buttons: Reset Wi-Fi (orange) and Close (red)
 *
 * The modal is centered on screen and matches the exact layout of the ESP32 firmware.
 */
export class SettingsWindow {
  // Modal dimensions from Constants
  private readonly windowWidth: number = SETTINGS_WINDOW.window.width;
  private readonly headerHeight: number = SETTINGS_WINDOW.window.headerHeight;
  private readonly tabviewWidth: number = SETTINGS_WINDOW.tabview.size.width;
  private readonly tabviewHeight: number = SETTINGS_WINDOW.tabview.size.height;
  private readonly tabButtonHeight: number = SETTINGS_WINDOW.tabview.tabButtonHeight;
  private readonly buttonHeight: number = DIMENSIONS.defaultButtonSize.height;
  private readonly buttonWidth: number = DIMENSIONS.defaultButtonSize.width;

  // Static readonly arrays for dropdown options (cached to eliminate allocations)
  private static readonly TIMEOUT_OPTIONS = ['5', '10', '15', '30', '60'];
  private static readonly LANGUAGE_OPTIONS = ['English', 'Español', 'Deutsch', 'Français', 'Türkçe', 'Svenska', 'Italiano'];

  // Fonts (cached as class properties)
  private readonly titleFont: string = `${FONTS.size16.size}px ${FONTS.size16.family}`;
  private readonly labelFont12: string = `${FONTS.size12.size}px ${FONTS.size12.family}`;
  private readonly labelFont14: string = `${FONTS.size14.size}px ${FONTS.size14.family}`;

  // Computed layout
  private layout: SettingsWindowLayout | null = null;

  // Last rendered settings (used for touch handling)
  private renderedSettings: Settings | null = null;

  // Dropdown popup state
  private openDropdown: 'timeout' | 'language' | null = null;

  // Label width cache for performance optimization
  private readonly cachedLabelWidths: Map<string, number> = new Map();
  private currentLanguage: Language | null = null;

  // Memoization: track when layout needs recomputation
  private lastSettingsHash: number = -1;
  private lastStringsHash: number = -1;

  constructor() {}

  // ==========================================================================
  // HASHING & MEMOIZATION
  // ==========================================================================

  /**
   * Computes a hash value from settings that affect layout.
   * Only includes fields that change the computed positions.
   */
  private hashSettings(settings: Settings): number {
    // Simple but effective hash combining relevant fields
    // Only fields that affect layout are included
    return (
      settings.dayBrightness * 1 +
      settings.nightBrightness * 2 +
      (settings.useNightMode ? 1 : 0) * 4 +
      (settings.useScreenOff ? 1 : 0) * 8 +
      settings.screenOffTimeout * 16 +
      settings.language * 32 +
      (settings.useFahrenheit ? 1 : 0) * 64 +
      (settings.use24Hour ? 1 : 0) * 128
    );
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Renders the settings window to the canvas.
   *
   * @param renderer - CanvasRenderer instance
   * @param settings - Current settings values
   * @param activeTab - Currently active tab ('display' or 'general')
   * @param strings - Localized strings for current language
   * @param callbacks - Event callbacks for user interactions
   */
  public render(
    renderer: CanvasRenderer,
    settings: Settings,
    activeTab: SettingsTab,
    strings: LocalizedStrings,
    callbacks: SettingsWindowCallbacks
  ): void {
    // Ensure background gradient is drawn before modal
    renderer.clear();
    renderer.gradient(
      0,
      0,
      SCREEN.width,
      SCREEN.height,
      COLORS.backgroundTop,
      COLORS.backgroundBottom
    );
    // Store current settings for touch event handling
    this.renderedSettings = settings;

    // Memoization: only recompute layout if settings or language changed
    const settingsHash = this.hashSettings(settings);
    const stringsHash = strings.language; // language is sufficient

    if (this.layout && settingsHash === this.lastSettingsHash && stringsHash === this.lastStringsHash) {
      // Layout still valid, skip recompute (use existing this.layout)
    } else {
      this.computeLayout(settings, strings, renderer); // Only called when needed
      this.lastSettingsHash = settingsHash;
      this.lastStringsHash = stringsHash;
    }

    this.drawModal(renderer, strings);
    this.drawHeader(renderer, strings);
    this.drawTabview(renderer, strings, activeTab, callbacks);
    this.drawTabContent(renderer, settings, activeTab, strings, callbacks);
    this.drawFooterButtons(renderer, strings, callbacks);
    // Draw dropdown popup LAST to ensure it appears on top of everything
    this.drawOpenDropdownPopup(renderer);
  }

  // ==========================================================================
  // LAYOUT COMPUTATION
  // ==========================================================================

  /**
   * Computes all positions based on Constants and screen dimensions.
   * The modal is centered on screen.
   */
  private computeLayout(settings: Settings, strings: LocalizedStrings, renderer: CanvasRenderer): void {
    const screenCenterX = Math.floor(SCREEN.width / 2);
    const screenCenterY = Math.floor(SCREEN.height / 2);

    // Check if we need to recompute label widths (language changed)
    if (this.currentLanguage !== settings.language) {
      this.cachedLabelWidths.clear();
      this.currentLanguage = settings.language;

      // Pre-measure all labels for this language ONCE
      // Most use labelFont12, but use_24hr uses labelFont14
      const labelMeasurements: [string, string][] = [
        [strings.day_brightness, this.labelFont12],
        [strings.use_night_mode, this.labelFont12],
        [strings.night_brightness, this.labelFont12],
        [strings.screen_off, this.labelFont12],
        [strings.screen_timeout, this.labelFont12],
        [strings.use_fahrenheit, this.labelFont12],
        [strings.use_24hr, this.labelFont14],
        [strings.location, this.labelFont12],
        [strings.language_label, this.labelFont12],
      ];

      for (const [label, font] of labelMeasurements) {
        this.cachedLabelWidths.set(label, renderer.measureText(label, font));
      }
    }

    // Modal window (centered)
    const windowX = screenCenterX - Math.floor(this.windowWidth / 2);
    const windowHeight =
      this.headerHeight +
      this.tabviewHeight +
      this.buttonHeight +
      25; // padding for buttons
    const windowY = Math.floor((SCREEN.height - windowHeight) / 2); // Center vertically

    // Tabview positioned below header
    const tabviewX = windowX + (this.windowWidth - this.tabviewWidth) / 2;
    const tabviewY = windowY + this.headerHeight + 5;

    // Content area starts below tab buttons
    const contentY = tabviewY + this.tabButtonHeight + 10;
    const contentX = tabviewX + 10;

    // Tab buttons (split tabview width in half)
    const tabWidth = Math.floor(this.tabviewWidth / 2);

    // Retrieve cached label widths
    const dayBrightnessWidth = this.cachedLabelWidths.get(strings.day_brightness)!;
    const nightModeLabelWidth = this.cachedLabelWidths.get(strings.use_night_mode)!;
    const nightBrightnessWidth = this.cachedLabelWidths.get(strings.night_brightness)!;
    const screenOffWidth = this.cachedLabelWidths.get(strings.screen_off)!;
    const timeoutWidth = this.cachedLabelWidths.get(strings.screen_timeout)!;
    const useFahrenheitWidth = this.cachedLabelWidths.get(strings.use_fahrenheit)!;
    const use24hrWidth = this.cachedLabelWidths.get(strings.use_24hr)!;
    const locationWidth = this.cachedLabelWidths.get(strings.location)!;
    const languageWidth = this.cachedLabelWidths.get(strings.language_label)!;

    // Gaps from spec
    const gapSwitch = 6;    // gap for switches
    const gapControl = 10; // gap for sliders and dropdowns

    // Font sizes and control dimensions
    const fontSize12 = FONTS.size12.size;
    const fontSize14 = FONTS.size14.size;
    const switchHeight = DIMENSIONS.switchSize.height;
    const switchWidth = DIMENSIONS.switchSize.width;
    const sliderTrackHeight = 12; // height of slider track
    const sliderCenterOffset = 6; // from track top to visual center (handle center)
    const dropdownHeight = 24;

    // ---------- Display Tab Positions ----------
    const y0 = contentY + 5; // brightnessLabel top

    // Row 1: Brightness label + slider
    const brightnessLabel = {
      x: contentX,
      y: y0,
      width: dayBrightnessWidth,
      height: fontSize12
    };

    const brightnessSliderTrack = {
      x: brightnessLabel.x + brightnessLabel.width + gapControl,
      y: brightnessLabel.y + (fontSize12 / 2) - sliderCenterOffset, // = y0 + 6 - 4 = y0 + 2
      width: DIMENSIONS.sliderWidth,
      height: sliderTrackHeight
    };

    // Row 2: Night mode label + switch
    const nightModeLabel = {
      x: contentX,
      y: brightnessLabel.y + brightnessLabel.height + 20, // y0 + 12 + 20 = y0+32
      width: nightModeLabelWidth,
      height: fontSize12
    };

    const nightModeSwitch = {
      x: nightModeLabel.x + nightModeLabel.width + gapSwitch,
      y: nightModeLabel.y + (fontSize12 / 2) - (switchHeight / 2), // = nightModeLabel.y + 6 - 10 = nightModeLabel.y - 4
      width: switchWidth,
      height: switchHeight
    };

    // Row 3: Night brightness label + slider
    const nightBrightnessLabel = {
      x: contentX,
      y: nightModeLabel.y + nightModeLabel.height + 24, // anchored to nightModeLabel bottom (firmware: align to lbl_night_mode)
      width: nightBrightnessWidth,
      height: fontSize12
    };

    const nightBrightnessSliderTrack = {
      x: nightBrightnessLabel.x + nightBrightnessLabel.width + gapControl,
      y: nightBrightnessLabel.y + (fontSize12 / 2) - sliderCenterOffset, // = nightBrightnessLabel.y + 2
      width: DIMENSIONS.sliderWidth,
      height: sliderTrackHeight
    };

    // Row 4: Screen off label + switch
    const screenOffLabel = {
      x: contentX,
      y: nightBrightnessLabel.y + nightBrightnessLabel.height + 20,
      width: screenOffWidth,
      height: fontSize12
    };

    const screenOffSwitch = {
      x: screenOffLabel.x + screenOffLabel.width + gapSwitch,
      y: screenOffLabel.y + (fontSize12 / 2) - (switchHeight / 2),
      width: switchWidth,
      height: switchHeight
    };

    // Row 5: Timeout label + dropdown
    const timeoutLabel = {
      x: contentX,
      y: screenOffLabel.y + screenOffLabel.height + 24,
      width: timeoutWidth,
      height: fontSize12
    };

    const timeoutDropdown = {
      x: timeoutLabel.x + timeoutLabel.width + gapControl,
      y: timeoutLabel.y + (fontSize12 / 2) - (dropdownHeight / 2), // = timeoutLabel.y + 6 - 12 = timeoutLabel.y - 6
      width: SETTINGS_WINDOW.displayTab.timeoutDropdown.width,
      height: dropdownHeight
    };

    // ---------- General Tab Positions ----------
    // Row 1: Unit label + switch
    const unitLabel = {
      x: contentX,
      y: y0, // same as brightnessLabel top
      width: useFahrenheitWidth,
      height: fontSize12
    };

    const unitSwitch = {
      x: unitLabel.x + unitLabel.width + gapSwitch,
      y: unitLabel.y + (fontSize12 / 2) - (switchHeight / 2), // = y0 - 4
      width: switchWidth,
      height: switchHeight
    };

    // Row 1 continued: 24hr label + switch (to the right of unit switch)
    const hour24Label = {
      x: unitSwitch.x + unitSwitch.width + gapSwitch,
      y: unitSwitch.y + (switchHeight / 2) - (fontSize14 / 2), // = unitSwitch.y + 10 - 7 = unitSwitch.y + 3
      width: use24hrWidth,
      height: fontSize14
    };

    const hour24Switch = {
      x: hour24Label.x + hour24Label.width + gapSwitch,
      y: hour24Label.y + (fontSize14 / 2) - (switchHeight / 2), // = hour24Label.y + 7 - 10 = hour24Label.y - 3
      width: switchWidth,
      height: switchHeight
    };

    // Row 2: Location label
    const locationLabel = {
      x: contentX,
      y: unitLabel.y + unitLabel.height + 24,
      width: locationWidth,
      height: fontSize12
    };

    const locationValue = {
      x: locationLabel.x + locationLabel.width + 5,
      y: locationLabel.y + (fontSize12 / 2) - (20 / 2), // = locationLabel.y + 6 - 10 = locationLabel.y - 4
      width: SETTINGS_WINDOW.generalTab.locationValue.width,
      height: 20
    };

    // Row 3: Language label + dropdown
    const languageLabel = {
      x: contentX,
      y: locationLabel.y + locationLabel.height + 24,
      width: languageWidth,
      height: fontSize12
    };

    const languageDropdown = {
      x: languageLabel.x + languageLabel.width + 10,
      y: languageLabel.y + (fontSize12 / 2) - (dropdownHeight / 2), // = languageLabel.y + 6 - 12 = languageLabel.y - 6
      width: SETTINGS_WINDOW.generalTab.languageDropdown.width,
      height: dropdownHeight
    };

    // Change Location button (centered as in firmware)
    const changeLocationBtn = {
      x: tabviewX + Math.floor(this.tabviewWidth / 2) - Math.floor(this.buttonWidth / 2),
      y: contentY + (this.tabviewHeight - this.tabButtonHeight - 10) / 2 + 60 - this.buttonHeight / 2,
      width: this.buttonWidth,
      height: this.buttonHeight
    };

    // Footer buttons (same)
    const resetWifiBtn = {
      x: windowX + 6,
      y: windowY + windowHeight - this.buttonHeight - 3,
      width: this.buttonWidth,
      height: this.buttonHeight
    };

    const closeBtn = {
      x: windowX + this.windowWidth - 6 - this.buttonWidth,
      y: windowY + windowHeight - this.buttonHeight - 3,
      width: this.buttonWidth,
      height: this.buttonHeight
    };

    this.layout = {
      window: { x: windowX, y: windowY, width: this.windowWidth, height: windowHeight },
      header: { x: windowX, y: windowY, width: this.windowWidth, height: this.headerHeight },
      tabview: { x: tabviewX, y: tabviewY, width: this.tabviewWidth, height: this.tabviewHeight },
      tabDisplay: {
        x: tabviewX,
        y: tabviewY,
        width: tabWidth,
        height: this.tabButtonHeight,
      },
      tabGeneral: {
        x: tabviewX + tabWidth,
        y: tabviewY,
        width: tabWidth,
        height: this.tabButtonHeight,
      },
      // Display tab controls
      brightnessLabel: { x: brightnessLabel.x, y: brightnessLabel.y, width: brightnessLabel.width, height: brightnessLabel.height },
      brightnessSliderTrack: { x: brightnessSliderTrack.x, y: brightnessSliderTrack.y, width: brightnessSliderTrack.width, height: brightnessSliderTrack.height },
      nightModeLabel: { x: nightModeLabel.x, y: nightModeLabel.y, width: nightModeLabel.width, height: nightModeLabel.height },
      nightModeSwitch: { x: nightModeSwitch.x, y: nightModeSwitch.y, width: nightModeSwitch.width, height: nightModeSwitch.height },
      nightBrightnessLabel: { x: nightBrightnessLabel.x, y: nightBrightnessLabel.y, width: nightBrightnessLabel.width, height: nightBrightnessLabel.height },
      nightBrightnessSliderTrack: { x: nightBrightnessSliderTrack.x, y: nightBrightnessSliderTrack.y, width: nightBrightnessSliderTrack.width, height: nightBrightnessSliderTrack.height },
      screenOffLabel: { x: screenOffLabel.x, y: screenOffLabel.y, width: screenOffLabel.width, height: screenOffLabel.height },
      screenOffSwitch: { x: screenOffSwitch.x, y: screenOffSwitch.y, width: screenOffSwitch.width, height: screenOffSwitch.height },
      timeoutLabel: { x: timeoutLabel.x, y: timeoutLabel.y, width: timeoutLabel.width, height: timeoutLabel.height },
      timeoutDropdown: { x: timeoutDropdown.x, y: timeoutDropdown.y, width: timeoutDropdown.width, height: timeoutDropdown.height },
      // General tab controls
      unitLabel: { x: unitLabel.x, y: unitLabel.y, width: unitLabel.width, height: unitLabel.height },
      unitSwitch: { x: unitSwitch.x, y: unitSwitch.y, width: unitSwitch.width, height: unitSwitch.height },
      hour24Label: { x: hour24Label.x, y: hour24Label.y, width: hour24Label.width, height: hour24Label.height },
      hour24Switch: { x: hour24Switch.x, y: hour24Switch.y, width: hour24Switch.width, height: hour24Switch.height },
      locationLabel: { x: locationLabel.x, y: locationLabel.y, width: locationLabel.width, height: locationLabel.height },
      locationValue: { x: locationValue.x, y: locationValue.y, width: locationValue.width, height: locationValue.height },
      languageLabel: { x: languageLabel.x, y: languageLabel.y, width: languageLabel.width, height: languageLabel.height },
      languageDropdown: { x: languageDropdown.x, y: languageDropdown.y, width: languageDropdown.width, height: languageDropdown.height },
      changeLocationBtn: { x: changeLocationBtn.x, y: changeLocationBtn.y, width: changeLocationBtn.width, height: changeLocationBtn.height },
      resetWifiBtn: { x: resetWifiBtn.x, y: resetWifiBtn.y, width: resetWifiBtn.width, height: resetWifiBtn.height },
      closeBtn: { x: closeBtn.x, y: closeBtn.y, width: closeBtn.width, height: closeBtn.height },
    };
  }

  // ==========================================================================
  // DRAWING METHODS
  // ==========================================================================

  private drawModal(renderer: CanvasRenderer, strings: LocalizedStrings): void {
    if (!this.layout) return;
    const { window } = this.layout;

    // Modal background (white)
    renderer.rect(window.x, window.y, window.width, window.height, '#FFFFFF', 4);
  }

  private drawHeader(renderer: CanvasRenderer, strings: LocalizedStrings): void {
    if (!this.layout) return;
    const { header } = this.layout;

    // Header background
    renderer.rect(header.x, header.y, header.width, header.height, COLORS.boxBackground, 4);

    // Title text
    renderer.text(
      strings.aura_settings,
      header.x + SETTINGS_WINDOW.window.titleMarginLeft,
      header.y + Math.floor((this.headerHeight - FONTS.size16.size) / 2) + 1,
      this.titleFont,
      COLORS.textWhite,
      'left',
      'middle'
    );
  }

  private drawTabview(renderer: CanvasRenderer, strings: LocalizedStrings, activeTab: SettingsTab, callbacks: SettingsWindowCallbacks): void {
    if (!this.layout) return;
    const { tabview, tabDisplay, tabGeneral } = this.layout;

    // Tabview background (white/light)
    renderer.rect(tabview.x, tabview.y, tabview.width, tabview.height, '#F5F5F5', 0);

    // Draw tab buttons
    this.drawTabButton(renderer, strings.tab_display, tabDisplay, activeTab === 'display', callbacks);
    this.drawTabButton(renderer, strings.tab_general, tabGeneral, activeTab === 'general', callbacks);
  }

  private drawTabButton(
    renderer: CanvasRenderer,
    text: string,
    pos: { x: number; y: number; width: number; height: number },
    isActive: boolean,
    callbacks: SettingsWindowCallbacks
  ): void {
    // Background
    const bgColor = isActive ? '#FFFFFF' : '#5e9bc8';
    renderer.rect(pos.x, pos.y, pos.width, pos.height, bgColor, 0);

    // Text
    renderer.text(
      text,
      pos.x + pos.width / 2,
      pos.y + pos.height / 2 + 1,
      this.labelFont14,
      isActive ? '#000000' : COLORS.textWhite,
      'center',
      'middle'
    );

    // Active tab underline
    if (isActive) {
      renderer.rect(pos.x, pos.y + pos.height - 2, pos.width, 2, '#4c8cb9', 0);
    }
  }

  private drawTabContent(
    renderer: CanvasRenderer,
    settings: Settings,
    activeTab: SettingsTab,
    strings: LocalizedStrings,
    callbacks: SettingsWindowCallbacks
  ): void {
    if (activeTab === 'display') {
      this.drawDisplayTab(renderer, settings, strings);
    } else {
      this.drawGeneralTab(renderer, settings, strings, callbacks);
    }
  }

  private drawDisplayTab(
    renderer: CanvasRenderer,
    settings: Settings,
    strings: LocalizedStrings
  ): void {
    if (!this.layout) return;

    const l = this.layout;

    // Brightness label + slider
    this.drawLabel(renderer, strings.day_brightness, l.brightnessLabel.x, l.brightnessLabel.y);
    this.drawSlider(renderer, l.brightnessSliderTrack, settings.dayBrightness, 1, 255);

    // Night mode label + switch
    this.drawLabel(renderer, strings.use_night_mode, l.nightModeLabel.x, l.nightModeLabel.y);
    this.drawSwitch(renderer, l.nightModeSwitch, settings.useNightMode);

    // Night brightness label + slider
    this.drawLabel(renderer, strings.night_brightness, l.nightBrightnessLabel.x, l.nightBrightnessLabel.y);
    this.drawSlider(renderer, l.nightBrightnessSliderTrack, settings.nightBrightness, 1, 128);

    // Screen off label + switch
    this.drawLabel(renderer, strings.screen_off, l.screenOffLabel.x, l.screenOffLabel.y);
    this.drawSwitch(renderer, l.screenOffSwitch, settings.useScreenOff);

    // Timeout label + dropdown
    this.drawLabel(renderer, strings.screen_timeout, l.timeoutLabel.x, l.timeoutLabel.y);
    this.drawDropdown(
      renderer,
      l.timeoutDropdown,
      `${settings.screenOffTimeout} ${strings.seconds_short}`,
      this.openDropdown === 'timeout'
    );
  }

  private drawGeneralTab(
    renderer: CanvasRenderer,
    settings: Settings,
    strings: LocalizedStrings,
    callbacks: SettingsWindowCallbacks
  ): void {
    if (!this.layout) return;

    const l = this.layout;

    // Unit label + switch
    this.drawLabel(renderer, strings.use_fahrenheit, l.unitLabel.x, l.unitLabel.y);
    this.drawSwitch(renderer, l.unitSwitch, settings.useFahrenheit);

    // 24hr label + switch
    this.drawLabel(renderer, strings.use_24hr, l.hour24Label.x, l.hour24Label.y);
    this.drawSwitch(renderer, l.hour24Switch, settings.use24Hour);

    // Location label + value
    this.drawLabel(renderer, strings.location, l.locationLabel.x, l.locationLabel.y);

    // Location value (circular scroll simulation)
    this.drawBox(renderer, l.locationValue, '#F5F5F5', '#CCCCCC');
    const locText = this.truncateText(renderer, settings.location, this.labelFont12, l.locationValue.width - 10);
    renderer.text(locText, l.locationValue.x + 5, l.locationValue.y + l.locationValue.height / 2, this.labelFont12, '#000000', 'left', 'middle');

    // Language label + dropdown
    this.drawLabel(renderer, strings.language_label, l.languageLabel.x, l.languageLabel.y);
    const currentLang = SettingsWindow.LANGUAGE_OPTIONS[settings.language] || 'English';
    this.drawDropdown(
      renderer,
      l.languageDropdown,
      currentLang,
      this.openDropdown === 'language'
    );

    // Change Location button
    this.drawButton(
      renderer,
      l.changeLocationBtn,
      strings.location_btn,
      COLORS.buttonGreen,
      callbacks.onChangeLocation
    );
  }

  private drawFooterButtons(
    renderer: CanvasRenderer,
    strings: LocalizedStrings,
    callbacks: SettingsWindowCallbacks
  ): void {
    if (!this.layout) return;

    const { resetWifiBtn, closeBtn } = this.layout;

    // Reset Wi-Fi button (orange)
    this.drawButton(renderer, resetWifiBtn, strings.reset_wifi, COLORS.buttonOrange, callbacks.onResetWiFi);

    // Close button (red)
    this.drawButton(renderer, closeBtn, strings.close, COLORS.buttonRed, callbacks.onClose);
  }

  // ==========================================================================
  // UI PRIMITIVES
  // ==========================================================================

  /**
   * Draws a label using the standard 12px font, black color, left-aligned, top baseline.
   * This is the most common label style across all tabs.
   */
  private drawLabel(renderer: CanvasRenderer, text: string, x: number, y: number): void {
    renderer.text(text, x, y, this.labelFont12, '#000000', 'left', 'top');
  }

  /**
   * Draws a rectangular control with a border (used for dropdowns and value displays).
   */
  private drawBox(
    renderer: CanvasRenderer,
    pos: { x: number; y: number; width: number; height: number },
    bgColor: string,
    borderColor: string = '#999999'
  ): void {
    renderer.rect(pos.x, pos.y, pos.width, pos.height, bgColor, 2);
    renderer.ctx.strokeStyle = borderColor;
    renderer.ctx.lineWidth = 1;
    renderer.ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
  }

  /**
   * Draws a horizontal slider track, fill, and handle.
   */
  private drawSlider(
    renderer: CanvasRenderer,
    track: { x: number; y: number; width: number; height: number },
    value: number,
    min: number,
    max: number,
    trackColor: string = '#CCCCCC',
    fillColor: string = '#4c8cb9',
    handleColor: string = '#666666'
  ): void {
    renderer.rect(track.x, track.y, track.width, track.height, trackColor, 4);

    const normalizedValue = (value - min) / (max - min);
    const fillWidth = Math.max(0, Math.min(track.width, normalizedValue * track.width));
    if (fillWidth > 0) {
      renderer.rect(track.x, track.y, fillWidth, track.height, fillColor, 4);
    }

    const handleSize = 12;
    const handleX = track.x + fillWidth - Math.floor(handleSize / 2);
    const handleY = track.y + Math.floor((track.height - handleSize) / 2);
    renderer.rect(handleX, handleY, handleSize, handleSize, handleColor, 6);
  }

  private drawSwitch(
    renderer: CanvasRenderer,
    pos: { x: number; y: number; width: number; height: number },
    isOn: boolean,
    onClick?: () => void
  ): void {
    // Track
    renderer.rect(
      pos.x,
      pos.y,
      pos.width,
      pos.height,
      isOn ? '#4c8cb9' : '#CCCCCC',
      pos.height / 2
    );

    // Knob
    const knobSize = 14;
    const knobPadding = 2;
    const knobX = pos.x + (isOn ? pos.width - knobSize - knobPadding : knobPadding);
    const knobY = pos.y + Math.floor((pos.height - knobSize) / 2);
    renderer.rect(knobX, knobY, knobSize, knobSize, '#FFFFFF', knobSize / 2);
  }

  /**
   * Draws a dropdown control with a box, text, and arrow indicator.
   */
  private drawDropdown(
    renderer: CanvasRenderer,
    pos: { x: number; y: number; width: number; height: number },
    text: string,
    isOpen: boolean
  ): void {
    this.drawBox(renderer, pos, '#FFFFFF');
    renderer.text(text, pos.x + 5, pos.y + pos.height / 2, this.labelFont12, '#000000', 'left', 'middle');
    const arrowX = pos.x + pos.width - 12;
    const arrowY = pos.y + Math.floor(pos.height / 2);
    this.drawTriangle(renderer, arrowX, arrowY, 8, '#666666');
  }

  private drawOpenDropdownPopup(renderer: CanvasRenderer): void {
    if (!this.openDropdown || !this.layout || !this.renderedSettings) return;

    // Get dropdown position based on which one is open
    const dropdownPos = this.openDropdown === 'timeout' ? this.layout.timeoutDropdown : this.layout.languageDropdown;

    // Define options based on which dropdown is open (using static cached arrays)
    let options: string[] = [];
    let selectedIndex: number = -1;

    if (this.openDropdown === 'timeout') {
      options = SettingsWindow.TIMEOUT_OPTIONS;
      selectedIndex = options.indexOf(String(this.renderedSettings.screenOffTimeout));
    } else if (this.openDropdown === 'language') {
      options = SettingsWindow.LANGUAGE_OPTIONS;
      selectedIndex = this.renderedSettings.language;
    }

    const optionHeight = 24;
    const popupHeight = options.length * optionHeight;
    const popupX = Math.min(dropdownPos.x, SCREEN.width - dropdownPos.width);
    let popupY = dropdownPos.y + dropdownPos.height;
    // Adjust if overflow bottom of screen
    if (popupY + popupHeight > SCREEN.height) {
      popupY = dropdownPos.y - popupHeight; // show above dropdown
    }
    // Adjust if overflow top of screen
    if (popupY < 0) {
      // Fallback to showing below the dropdown
      popupY = dropdownPos.y + dropdownPos.height;
    }

    // Popup background (white)
    renderer.rect(popupX, popupY, dropdownPos.width, popupHeight, '#F5F5F5', 2);
    renderer.ctx.strokeStyle = '#999999';
    renderer.ctx.lineWidth = 1;
    renderer.ctx.strokeRect(popupX, popupY, dropdownPos.width, popupHeight);

    // Draw each option
    options.forEach((option, index) => {
      const optionY = popupY + index * optionHeight;

      // Highlight background for selected item
      if (index === selectedIndex) {
        renderer.rect(popupX, optionY, dropdownPos.width, optionHeight, '#E3F2FD', 0);
      }

      // Option text - vertically centered (matching LocationDialog style)
      renderer.text(
        option,
        popupX + 5,
        optionY + optionHeight / 2,
        this.labelFont12,
        '#000000',
        'left',
        'middle'
      );
    });
  }

  private drawButton(
    renderer: CanvasRenderer,
    pos: { x: number; y: number; width: number; height: number },
    text: string,
    color: string,
    onClick?: () => void
  ): void {
    renderer.rect(pos.x, pos.y, pos.width, pos.height, color, 4);
    renderer.text(
      text,
      pos.x + pos.width / 2,
      pos.y + pos.height / 2 + 1,
      this.labelFont12,
      COLORS.textWhite,
      'center',
      'middle'
    );
  }

  private drawTriangle(renderer: CanvasRenderer, x: number, y: number, size: number, color: string): void {
    renderer.ctx.fillStyle = color;
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(x, y - size / 2);
    renderer.ctx.lineTo(x + size, y - size / 2);
    renderer.ctx.lineTo(x + size / 2, y + size / 2);
    renderer.ctx.closePath();
    renderer.ctx.fill();
  }

  private truncateText(renderer: CanvasRenderer, text: string, font: string, maxWidth: number): string {
    const ellipsis = '...';
    const ellipsisWidth = renderer.measureText(ellipsis, font);
    const maxTextWidth = maxWidth - ellipsisWidth;

    // Quick check: text already fits?
    if (renderer.measureText(text, font) <= maxWidth) {
      return text;
    }

    // Binary search for maximum fitting substring length
    let low = 0;
    let high = text.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const substr = text.slice(0, mid);
      if (renderer.measureText(substr, font) <= maxTextWidth) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // low-1 is the last length that fits
    const truncated = text.slice(0, low - 1);
    return truncated + ellipsis;
  }

  // ==========================================================================
  // EVENT HANDLING (for future interactivity)
  // ==========================================================================

  /**
   * Handles touch events. Returns true if the touch was consumed by this widget.
   *
   * @param x - Touch X coordinate
   * @param y - Touch Y coordinate
   * @param activeTab - Current active tab
   * @param callbacks - Callbacks to invoke
   * @returns true if touch was handled
   */
  public handleTouch(
    x: number,
    y: number,
    activeTab: SettingsTab,
    callbacks: SettingsWindowCallbacks
  ): boolean {
    if (!this.layout) return false;

    const l = this.layout;

    // ==========================================================================
    // FIRST: Handle open dropdown popup (if any)
    // ==========================================================================
    if (this.openDropdown) {
      const popupBounds = this.getPopupBounds();
      if (popupBounds) {
        // Check if touch is on an option in the popup
        if (this.isPointInRect(x, y, popupBounds)) {
          const optionIndex = Math.floor((y - popupBounds.y) / 24); // 24px per option
          const options = this.getDropdownOptions();
          if (optionIndex >= 0 && optionIndex < options.length) {
            // Select this option
            if (this.openDropdown === 'timeout') {
              const timeout = parseInt(options[optionIndex], 10);
              callbacks.onTimeoutChange(timeout);
            } else if (this.openDropdown === 'language') {
              callbacks.onLanguageChange(optionIndex);
            }
            this.openDropdown = null;
            return true;
          }
        }

        // Check if touch is on the dropdown header itself (while popup open)
        const dropdownRect = this.openDropdown === 'timeout' ? l.timeoutDropdown : l.languageDropdown;
        if (this.isPointInRect(x, y, dropdownRect)) {
          // Toggle off: clicking dropdown again closes popup without selecting
          this.openDropdown = null;
          return true;
        }

        // Touch outside popup closes it (but may not consume touch if outside modal entirely)
        if (this.isPointInRect(x, y, l.window)) {
          this.openDropdown = null;
          return true; // consume touch inside modal
        }

        return false; // outside modal, let it propagate
      }
    }

    // ==========================================================================
    // SECOND: Check tab clicks
    // ==========================================================================
    if (this.isPointInRect(x, y, l.tabDisplay)) {
      if (activeTab !== 'display') {
        callbacks.onTabChange('display');
      }
      return true;
    }

    if (this.isPointInRect(x, y, l.tabGeneral)) {
      if (activeTab !== 'general') {
        callbacks.onTabChange('general');
      }
      return true;
    }

    // ==========================================================================
    // THIRD: Check footer buttons
    // ==========================================================================
    if (this.isPointInRect(x, y, l.resetWifiBtn)) {
      callbacks.onResetWiFi();
      return true;
    }

    if (this.isPointInRect(x, y, l.closeBtn)) {
      callbacks.onClose();
      return true;
    }

    // ==========================================================================
    // FOURTH: Handle interactive controls (only if we have rendered settings)
    // ==========================================================================
    if (this.renderedSettings) {
      const s = this.renderedSettings;

      // Display tab controls
      if (activeTab === 'display') {
        // Day brightness slider
        if (this.isPointInRect(x, y, l.brightnessSliderTrack)) {
          const newVal = this.calculateSliderValue(x, l.brightnessSliderTrack, 1, 255);
          callbacks.onBrightnessChange(newVal);
          return true;
        }

        // Night brightness slider
        if (this.isPointInRect(x, y, l.nightBrightnessSliderTrack)) {
          const newVal = this.calculateSliderValue(x, l.nightBrightnessSliderTrack, 1, 128);
          callbacks.onNightBrightnessChange(newVal);
          return true;
        }

        // Night mode switch
        if (this.isPointInRect(x, y, l.nightModeSwitch)) {
          callbacks.onNightModeToggle(!s.useNightMode);
          return true;
        }

        // Screen off switch
        if (this.isPointInRect(x, y, l.screenOffSwitch)) {
          callbacks.onScreenOffToggle(!s.useScreenOff);
          return true;
        }

        // Timeout dropdown - OPEN POPUP instead of cycling
        if (this.isPointInRect(x, y, l.timeoutDropdown)) {
          this.openDropdown = this.openDropdown === 'timeout' ? null : 'timeout';
          return true;
        }
      }

      // General tab controls
      if (activeTab === 'general') {
        // Unit switch
        if (this.isPointInRect(x, y, l.unitSwitch)) {
          callbacks.onUnitToggle(!s.useFahrenheit);
          return true;
        }

        // 24hr switch
        if (this.isPointInRect(x, y, l.hour24Switch)) {
          callbacks.on24hrToggle(!s.use24Hour);
          return true;
        }

        // Language dropdown - OPEN POPUP instead of cycling
        if (this.isPointInRect(x, y, l.languageDropdown)) {
          this.openDropdown = this.openDropdown === 'language' ? null : 'language';
          return true;
        }

        // Change Location button
        if (this.isPointInRect(x, y, l.changeLocationBtn)) {
          callbacks.onChangeLocation();
          return true;
        }
      }
    }

    // ==========================================================================
    // FIFTH: Close dropdown if clicking outside the popup but inside the Settings modal
    // ==========================================================================
    if (this.openDropdown) {
      const popup = this.getPopupBounds();
      const clickedInsidePopup = popup && this.isPointInRect(x, y, popup);
      const clickedInsideModal = this.isPointInRect(x, y, l.window);
      // Determine if the click was on the dropdown trigger itself (to avoid immediate close)
      const clickedOnTrigger =
        (this.openDropdown === 'timeout' && this.isPointInRect(x, y, l.timeoutDropdown)) ||
        (this.openDropdown === 'language' && this.isPointInRect(x, y, l.languageDropdown));
      if (clickedInsideModal && !clickedInsidePopup && !clickedOnTrigger) {
        this.openDropdown = null;
        return true; // consume touch
      }
    }

    // ==========================================================================
    // SIXTH: Consume touches inside modal to prevent background interaction
    // ==========================================================================
    if (this.isPointInRect(x, y, l.window)) {
      return true;
    }

    return false;
  }

  /** Get the popup bounding rectangle for the currently open dropdown */
  private getPopupBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.layout || !this.openDropdown) return null;

    const dropdownPos = this.openDropdown === 'timeout' ? this.layout.timeoutDropdown : this.layout.languageDropdown;
    const options = this.getDropdownOptions();
    const optionHeight = 24;
    const popupHeight = options.length * optionHeight;
    // Apply same overflow logic as in drawOpenDropdownPopup
    let popupY = dropdownPos.y + dropdownPos.height;
    if (popupY + popupHeight > SCREEN.height) {
      popupY = dropdownPos.y - popupHeight;
    }

    return {
      x: dropdownPos.x,
      y: popupY,
      width: dropdownPos.width,
      height: popupHeight,
    };
  }

  /** Get the available options for dropdowns */
  private getDropdownOptions(): string[] {
    if (!this.renderedSettings) return [];

    if (this.openDropdown === 'timeout') {
      return SettingsWindow.TIMEOUT_OPTIONS;
    } else if (this.openDropdown === 'language') {
      return SettingsWindow.LANGUAGE_OPTIONS;
    }
    return [];
  }

  private isPointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  /**
   * Calculates a slider value from a touch X coordinate.
   */
  private calculateSliderValue(
    x: number,
    track: { x: number; y: number; width: number; height: number },
    min: number,
    max: number
  ): number {
    const relX = x - track.x;
    const ratio = Math.max(0, Math.min(1, relX / track.width));
    return Math.round(min + ratio * (max - min));
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createSettingsWindow(): SettingsWindow {
  return new SettingsWindow();
}
