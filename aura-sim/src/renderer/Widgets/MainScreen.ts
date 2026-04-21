/**
 * MainScreen Widget for Aura Simulator
 *
 * Renders the primary weather display screen:
 * - Gradient background (#4c8cb9 top to #a6cdec bottom)
 * - Current weather (large icon, temperature, feels like)
 * - Clock (top-left)
 * - WiFi signal indicator (top-right)
 * - 7-day or hourly forecast section
 *
 * Matches create_ui() from aura/aura.ino
 */

import CanvasRenderer from '../CanvasRenderer';
import { SCREEN, COLORS, MAIN_SCREEN } from '../Constants';
import { getFontStyle } from '../Fonts';
import * as Icons from '../../assets/icons';
import type {
  AppState,
  WeatherData,
  Settings,
  DailyForecast,
  HourlyForecast,
  CurrentWeather,
} from '../../state/AppState';
import type { LocalizedStrings } from '../../state/LocalizedStrings';
import { get_strings } from '../../state/LocalizedStrings';

// Icon object shape from icons.ts
interface IconObject {
  width: number;
  height: number;
  stride: number;
  format: string;
  data: Uint8Array;
}

// LRU Cache for icon bitmaps to prevent unbounded memory growth
// O(1) implementation using Map's insertion order
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recent) by deleting and re-adding
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    // If key exists, delete it first to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);

    // Evict least recently used (first entry in Map order)
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

// Global icon cache with LRU eviction (max 200 entries)
const iconCache = new LRUCache<string, ImageBitmap>(200);

/**
 * Converts raw RGB565(A8) icon data to an ImageBitmap.
 * The icon data is stored as separate planes: RGB565 block followed by tightly-packed alpha.
 */
async function bitmapFromRGB565(iconData: IconObject): Promise<ImageBitmap> {
  const { width, height, stride, data, format } = iconData;

  // Validate data length for color block
  const minColorLength = stride * height;
  if (data.length < minColorLength) {
    throw new Error(`Icon color data too short: ${data.length} < ${minColorLength}`);
  }

  const hasAlpha = format === 'RGB565A8';
  if (hasAlpha) {
    const alphaOffset = height * stride;
    if (data.length < alphaOffset + height * width) {
      throw new Error(`Icon data too short for alpha: ${data.length} < ${alphaOffset + height * width}`);
    }
  }

  // Create pixel buffer (RGBA)
  const buf = new Uint8ClampedArray(width * height * 4);

  // Convert each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * stride + x * 2;
      const lo = data[srcIdx];
      const hi = data[srcIdx + 1];
      const pixel = lo | (hi << 8); // little-endian

      // Extract RGB565 components
      const r5 = (pixel >> 11) & 0x1F;
      const g6 = (pixel >> 5) & 0x3F;
      const b5 = pixel & 0x1F;

      // Expand to 8-bit
      const r8 = (r5 << 3) | (r5 >> 2);
      const g8 = (g6 << 2) | (g6 >> 4);
      const b8 = (b5 << 3) | (b5 >> 2);

      const dstIdx = (y * width + x) * 4;
      buf[dstIdx] = r8;
      buf[dstIdx + 1] = g8;
      buf[dstIdx + 2] = b8;

      let alpha = 255;
      if (hasAlpha) {
        const alphaIdx = height * stride + y * width + x;
        alpha = data[alphaIdx];
      }
      buf[dstIdx + 3] = alpha;
    }
  }

  // Create ImageData and then ImageBitmap directly (no canvas)
  const imgData = new ImageData(buf, width, height);
  const bitmap = await createImageBitmap(imgData);
  return bitmap;
}

async function createPlaceholderBitmap(name: string): Promise<ImageBitmap> {
  // Use larger size for image_* icons
  const size = name.startsWith('image_') ? 100 : 20;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context for placeholder');
  }
  // Magenta background with '?' in white to indicate missing icon
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${Math.floor(size * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', size / 2, size / 2);
  return await createImageBitmap(canvas);
}

async function getIconBitmap(name: keyof typeof Icons): Promise<ImageBitmap> {
  // Check cache first
  const cached = iconCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const DEFAULT_ICON: keyof typeof Icons = 'icon_sunny';
  let requestedName = name;
  let currentName: keyof typeof Icons = name;
  let triedFallback = false;

  while (true) {
    const iconData = Icons[currentName] as IconObject | undefined;
    if (!iconData) {
      if (triedFallback) {
        // Even default is missing, return placeholder
        console.error(`[getIconBitmap] Icon '${currentName}' not found and fallback missing.`);
        return await createPlaceholderBitmap(String(requestedName));
      }
      console.warn(`[getIconBitmap] Icon '${currentName}' not found, falling back to '${DEFAULT_ICON}'`);
      currentName = DEFAULT_ICON;
      triedFallback = true;
      continue;
    }

    try {
      let bitmap: ImageBitmap;
      if (iconData.format === 'RGB565' || iconData.format === 'RGB565A8') {
        // Validate that data length is at least stride * height
        const minLength = iconData.stride * iconData.height;
        if (iconData.data.length < minLength) {
          throw new Error(`Icon data too short: ${iconData.data.length} < ${minLength}`);
        }
        bitmap = await bitmapFromRGB565(iconData);
      } else {
        // Fallback: treat as PNG-encoded data
        const blob = new Blob([iconData.data as any], { type: 'image/png' });
        bitmap = await createImageBitmap(blob);
      }
      // Cache under the originally requested name to avoid repeated fallbacks
      iconCache.set(requestedName, bitmap);
      return bitmap;
    } catch (err) {
      console.error(`[getIconBitmap] Failed to create bitmap for '${currentName}':`, err);
      if (triedFallback) {
        // Already tried fallback, return placeholder
        return await createPlaceholderBitmap(String(requestedName));
      }
      console.warn(`[getIconBitmap] Falling back to '${DEFAULT_ICON}'`);
      currentName = DEFAULT_ICON;
      triedFallback = true;
      // loop continues
    }
  }
}

// choose_image - maps WMO code + is_day to image_* (large icons)
function chooseImage(code: number, is_day: number): keyof typeof Icons {
  switch (code) {
    case 0:
      return is_day ? 'image_sunny' : 'image_clear_night';
    case 1:
      return is_day ? 'image_mostly_sunny' : 'image_mostly_clear_night';
    case 2:
      return is_day ? 'image_partly_cloudy' : 'image_partly_cloudy_night';
    case 3:
      return 'image_cloudy';
    case 45:
    case 48:
      return 'image_haze_fog_dust_smoke';
    case 51:
    case 53:
    case 55:
      return 'image_drizzle';
    case 56:
    case 57:
      return 'image_sleet_hail';
    case 61:
      return is_day ? 'image_scattered_showers_day' : 'image_scattered_showers_night';
    case 63:
      return 'image_showers_rain';
    case 65:
      return 'image_heavy_rain';
    case 66:
    case 67:
      return 'image_wintry_mix_rain_snow';
    case 71:
    case 73:
    case 75:
    case 85:
      return 'image_snow_showers_snow';
    case 77:
      return 'image_flurries';
    case 80:
    case 81:
      return is_day ? 'image_scattered_showers_day' : 'image_scattered_showers_night';
    case 82:
      return 'image_heavy_rain';
    case 86:
      return 'image_heavy_snow';
    case 95:
      return is_day
        ? 'image_isolated_scattered_tstorms_day'
        : 'image_isolated_scattered_tstorms_night';
    case 96:
    case 99:
      return 'image_strong_tstorms';
    default:
      return is_day ? 'image_mostly_cloudy_day' : 'image_mostly_cloudy_night';
  }
}

// choose_icon - maps WMO code + is_day to icon_* (small forecast icons)
function chooseIcon(code: number, is_day: number): keyof typeof Icons {
  switch (code) {
    case 0:
      return is_day ? 'icon_sunny' : 'icon_clear_night';
    case 1:
      return is_day ? 'icon_mostly_sunny' : 'icon_mostly_clear_night';
    case 2:
      return is_day ? 'icon_partly_cloudy' : 'icon_partly_cloudy_night';
    case 3:
      return 'icon_cloudy';
    case 45:
    case 48:
      return 'icon_haze_fog_dust_smoke';
    case 51:
    case 53:
    case 55:
      return 'icon_drizzle';
    case 56:
    case 57:
      return 'icon_sleet_hail';
    case 61:
      return is_day ? 'icon_scattered_showers_day' : 'icon_scattered_showers_night';
    case 63:
      return 'icon_showers_rain';
    case 65:
      return 'icon_heavy_rain';
    case 66:
    case 67:
      return 'icon_wintry_mix_rain_snow';
    case 71:
    case 73:
    case 75:
    case 85:
      return 'icon_snow_showers_snow';
    case 77:
      return 'icon_flurries';
    case 80:
    case 81:
      return is_day ? 'icon_scattered_showers_day' : 'icon_scattered_showers_night';
    case 82:
      return 'icon_heavy_rain';
    case 86:
      return 'icon_heavy_snow';
    case 95:
      return is_day
        ? 'icon_isolated_scattered_tstorms_day'
        : 'icon_isolated_scattered_tstorms_night';
    case 96:
    case 99:
      return 'icon_strong_tstorms';
    default:
      return is_day ? 'icon_mostly_cloudy_day' : 'icon_mostly_cloudy_night';
  }
}

/**
 * Preloads all icons into the cache at startup.
 * This eliminates per-icon loading delays during first render.
 * Returns the number of icons successfully preloaded.
 */
export async function preloadAllIcons(): Promise<number> {
  const iconNames = Object.keys(Icons) as Array<keyof typeof Icons>;
  let loadedCount = 0;
  const total = iconNames.length;

  console.log(`[Icons] Preloading ${total} icons...`);

  for (const name of iconNames) {
    try {
      await getIconBitmap(name);
      loadedCount++;
    } catch (err) {
      console.warn(`[Icons] Failed to preload '${name}':`, err);
    }
  }

  console.log(`[Icons] Preloaded ${loadedCount}/${total} icons (${iconCache.size} in cache)`);
  return loadedCount;
}

export class MainScreen {
  // State for current forecast mode and callback
  private currentForecast: 'daily' | 'hourly';
  private onForecastToggle: ((mode: 'daily' | 'hourly') => void) | null = null;

  constructor(props: { currentForecast: 'daily' | 'hourly'; onForecastToggle?: (mode: 'daily' | 'hourly') => void }) {
    this.currentForecast = props.currentForecast;
    this.onForecastToggle = props.onForecastToggle || null;
  }

  /**
   * Updates the forecast mode (used by parent when toggling)
   */
  public setForecastMode(mode: 'daily' | 'hourly'): void {
    this.currentForecast = mode;
  }


  /**
   * Handles touch events on the main weather screen.
   * - Touch on forecast box: toggle between daily/hourly
   * - Touch elsewhere on main screen: open settings (returns false to signal App to open settings)
   *
   * @param x - Touch X coordinate (0-239)
   * @param y - Touch Y coordinate (0-319)
   * @returns true if touch was handled by this widget, false if it should propagate (e.g., open settings)
   */
  public handleTouch(x: number, y: number): boolean {
    const forecastBox = MAIN_SCREEN.forecastBox;
    const box = {
      x: forecastBox.position.x,
      y: forecastBox.position.y,
      width: forecastBox.size.width,
      height: forecastBox.size.height,
    };

    // Check if touch is inside forecast box
    if (this.isPointInRect(x, y, box)) {
      // Toggle forecast mode
      const newMode = this.currentForecast === 'daily' ? 'hourly' : 'daily';
      this.currentForecast = newMode;
      if (this.onForecastToggle) {
        this.onForecastToggle(newMode);
      }
      return true; // consumed
    }

    // Touch on main screen area (anything not forecast box) - let App handle (open settings)
    // Return false to indicate not handled, so App can trigger settings
    return false;
  }

  private isPointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  private formatTemperature(temp: number, useFahrenheit: boolean): string {
    let t = temp;
    if (useFahrenheit) {
      t = t * (9/5) + 32;
    }
    const absTemp = Math.abs(t);
    const sign = t < 0 ? '\u2212' : '';
    return `${sign}${Math.round(absTemp)}°${useFahrenheit ? 'F' : 'C'}`;
  }

  async render(renderer: CanvasRenderer, state: AppState, timeString: string): Promise<void> {
    // 1. Clear and draw gradient background
    renderer.clear();
    renderer.gradient(
      0,
      0,
      SCREEN.width,
      SCREEN.height,
      COLORS.backgroundTop,
      COLORS.backgroundBottom
    );

    const weatherData = state.weatherData;
    const settings = state.settings;
    const strings = get_strings(settings.language);

    // 2. Render static elements
    this.renderClock(renderer, timeString);
    this.renderWifiBars(renderer, state.wifiConnected);

    // 3. Render weather content if available
    if (weatherData) {
      try {
        await this.renderTodayWeather(renderer, weatherData.current, settings, strings);
        await this.renderForecastSection(renderer, weatherData, settings, strings);
      } catch (err) {
        // Error context: forecastMode and is_day help identify the rendering context
        console.error('[MainScreen] Error rendering weather content (forecastMode=%s, is_day=%s):',
          this.currentForecast, weatherData.current.is_day, err);
        // Draw error indicator
        renderer.text('Render Error', 10, 50, '10px Montserrat', '#FF0000', 'left', 'top');
      }
    }
  }

  // --- Private rendering methods ---

  private renderClock(renderer: CanvasRenderer, timeString: string): void {
    const font = getFontStyle(14);
    renderer.text(
      timeString,
      MAIN_SCREEN.clock.position.x,
      MAIN_SCREEN.clock.position.y,
      font,
      COLORS.textBlue,
      'left',
      'top'
    );
  }

  private renderWifiBars(renderer: CanvasRenderer, connected: boolean): void {
    const containerW = MAIN_SCREEN.wifiContainer.size.width;
    const containerH = MAIN_SCREEN.wifiContainer.size.height;
    const containerX = SCREEN.width - containerW - 6; // TOP_RIGHT offset -6
    const containerY = 6; // TOP_RIGHT offset +6

    const barColor = connected ? COLORS.wifiActive : COLORS.wifiOff;
    const barWidth = MAIN_SCREEN.wifiContainer.barWidth;
    const bars = MAIN_SCREEN.wifiContainer.bars;

    for (const bar of bars) {
      const x = containerX + bar.x;
      const y = containerY + bar.y;
      renderer.rect(x, y, barWidth, bar.height, barColor, MAIN_SCREEN.wifiContainer.barRadius);
    }
  }

  private async renderTodayWeather(
    renderer: CanvasRenderer,
    current: CurrentWeather,
    settings: Settings,
    strings: LocalizedStrings
  ): Promise<void> {
    // Large icon (100x100)
    const iconName = chooseImage(current.code, current.is_day);
    const iconBitmap = await getIconBitmap(iconName);
    const iconX = MAIN_SCREEN.todayIcon.position.x;
    const iconY = MAIN_SCREEN.todayIcon.position.y;
    const iconSize = MAIN_SCREEN.todayIcon.size;
    renderer.imageSync(iconBitmap, iconX, iconY, iconSize.width, iconSize.height);

    const tempStr = this.formatTemperature(current.temp, settings.useFahrenheit);
    const tempFont = getFontStyle(42);
    const tempHeight = this.getTextHeight(renderer, tempFont, tempStr);

    // Position using OUT_RIGHT_MID offset from icon
    const tempX = iconX + iconSize.width + MAIN_SCREEN.todayTemp.alignTo.offsetX; // offsetX = 10
    const tempLabelY =
      iconY + iconSize.height / 2 + MAIN_SCREEN.todayTemp.alignTo.offsetY - tempHeight / 2; // offsetY = -12

    renderer.text(tempStr, tempX, tempLabelY, tempFont, COLORS.textWhite, 'left', 'top');

    // Feels Like (OUT_BOTTOM_LEFT from temp)
    const feelsStr = `${strings.feels_like_temp} ${this.formatTemperature(current.feels_like, settings.useFahrenheit)}`;
    const feelsFont = getFontStyle(14);
    const feelsX = tempX; // left aligned with temp
    const feelsY = tempLabelY + tempHeight + MAIN_SCREEN.feelsLike.alignTo.offsetY; // offsetY = 4

    renderer.text(feelsStr, feelsX, feelsY, feelsFont, COLORS.textCyan, 'left', 'top');
  }

  private async renderForecastSection(
    renderer: CanvasRenderer,
    weatherData: WeatherData,
    settings: Settings,
    strings: LocalizedStrings
  ): Promise<void> {
    // Section label
    const labelText =
      this.currentForecast === 'daily'
        ? strings.seven_day_forecast
        : strings.hourly_forecast;
    renderer.text(
      labelText,
      MAIN_SCREEN.forecastLabel.position.x,
      MAIN_SCREEN.forecastLabel.position.y,
      getFontStyle(12),
      COLORS.textCyan,
      'left',
      'top'
    );

    // Forecast box background
    const box = MAIN_SCREEN.forecastBox;
    renderer.rect(
      box.position.x,
      box.position.y,
      box.size.width,
      box.size.height,
      box.background,
      box.borderRadius
    );

    const pad = box.padding;
    const innerX = box.position.x + pad;
    const innerY = box.position.y + pad;
    const innerRight = box.position.x + box.size.width - pad;
    const rowHeight = box.rowHeight;

    // Render 7 rows
    for (let i = 0; i < 7; i++) {
      if (this.currentForecast === 'daily') {
        const isDay = i === 0 ? weatherData.current.is_day : 1;
        await this.renderDailyRow(
          renderer,
          weatherData.daily[i],
          i,
          innerX,
          innerY,
          innerRight,
          settings,
          strings,
          isDay
        );
      } else {
        await this.renderHourlyRow(
          renderer,
          weatherData.hourly[i],
          i,
          innerX,
          innerY,
          innerRight,
          settings,
          strings
        );
      }
    }
  }

  private async renderDailyRow(
    renderer: CanvasRenderer,
    daily: DailyForecast,
    index: number,
    innerX: number,
    innerY: number,
    innerRight: number,
    settings: Settings,
    strings: LocalizedStrings,
    isDay: number
  ): Promise<void> {
    const y = innerY + index * MAIN_SCREEN.forecastBox.rowHeight;
    const font16 = getFontStyle(16);

    // Day label (Today or weekday)
    let dayText: string;
    if (index === 0) {
      dayText = strings.today;
    } else {
      const [year, month, day] = daily.date.split('-').map(Number);
      const weekday = this.day_of_week(year, month, day);
      dayText = strings.weekdays[weekday];
    }
    renderer.text(dayText, innerX + 2, y, font16, COLORS.textWhite, 'left', 'top');

    // High temperature
    const highStr = this.formatTemperature(daily.high, settings.useFahrenheit);
    renderer.text(highStr, innerRight, y, font16, COLORS.textWhite, 'right', 'top');

    // Low temperature (offset -50 from right)
    const lowStr = this.formatTemperature(daily.low, settings.useFahrenheit);
    renderer.text(lowStr, innerRight - 50, y, font16, COLORS.textBlue, 'right', 'top');

    // Weather icon (at x=72, y=i*24, natural size)
    const iconName = chooseIcon(daily.code, isDay);
    const iconBitmap = await getIconBitmap(iconName);
    const iconX = innerX + 72;
    const iconY = y;
    renderer.imageSync(iconBitmap, iconX, iconY, iconBitmap.width, iconBitmap.height);
  }

  private async renderHourlyRow(
    renderer: CanvasRenderer,
    hourly: HourlyForecast,
    index: number,
    innerX: number,
    innerY: number,
    innerRight: number,
    settings: Settings,
    strings: LocalizedStrings
  ): Promise<void> {
    const y = innerY + index * MAIN_SCREEN.forecastBox.rowHeight;
    const font16 = getFontStyle(16);

    // Hour label
    let hourText: string;
    if (index === 0) {
      hourText = strings.now;
    } else {
      hourText = this.formatHour(hourly.hour, settings.use24Hour, strings);
    }
    renderer.text(hourText, innerX + 2, y, font16, COLORS.textWhite, 'left', 'top');

    // Precipitation probability (at x=-55 from right, right-aligned)
    const precipStr = `${Math.round(hourly.precipitation)}%`;
    renderer.text(precipStr, innerRight - 55, y, font16, COLORS.textCyan, 'right', 'top');

    // Temperature (right-aligned at innerRight)
    const tempStr = this.formatTemperature(hourly.temp, settings.useFahrenheit);
    renderer.text(tempStr, innerRight, y, font16, COLORS.textWhite, 'right', 'top');

    // Weather icon (at x=72, y=i*24)
    const iconName = chooseIcon(hourly.code, hourly.is_day);
    const iconBitmap = await getIconBitmap(iconName);
    const iconX = innerX + 72;
    const iconY = y;
    renderer.imageSync(iconBitmap, iconX, iconY, iconBitmap.width, iconBitmap.height);
  }

  // --- Helpers ---

  private getTextHeight(renderer: CanvasRenderer, font: string, text: string): number {
    renderer.ctx.font = font;
    const metrics = renderer.ctx.measureText(text);
    if (
      metrics.actualBoundingBoxAscent !== undefined &&
      metrics.actualBoundingBoxDescent !== undefined
    ) {
      return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    }
    // Fallback: use font size from string
    const match = font.match(/(\d+)px/);
    if (match) {
      const size = parseInt(match[1], 10);
      return size; // approximate
    }
    return 12;
  }

  private formatHour(hour: number, use24Hour: boolean, strings: LocalizedStrings): string {
    if (hour < 0 || hour > 23) return strings.invalid_hour;
    if (use24Hour) {
      return hour.toString().padStart(2, '0');
    } else {
      if (hour === 0) return `12${strings.am}`;
      if (hour === 12) return strings.noon;
      const isAM = hour < 12;
      const suffix = isAM ? strings.am : strings.pm;
      const displayHour = hour % 12;
      return `${displayHour}${suffix}`;
    }
  }

  // Zeller's congruence: returns 0=Sunday .. 6=Saturday
  private day_of_week(y: number, m: number, d: number): number {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    if (m < 3) y -= 1;
    return (
      y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) +
      t[m - 1] +
      d
    ) % 7;
  }
}

export default MainScreen;
