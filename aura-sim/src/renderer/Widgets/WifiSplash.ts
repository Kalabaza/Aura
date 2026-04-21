/**
 * WifiSplash Widget for Aura Simulator
 *
 * Renders the initial WiFi configuration splash screen.
 * Displays a gradient background with centered multi-line instructional text.
 *
 * Matches: wifi_splash_screen() in aura/aura.ino
 */

import { CanvasRenderer } from '../CanvasRenderer';
import { WIFI_SPLASH_SCREEN } from '../Constants';

/**
 * Configuration constants for the WiFi splash screen
 */
const WIFI_SPLASH = {
  padding: 10, // Padding from screen edges for text wrapping
  lineSpacing: 1.4, // Multiplier for line height (relative to font size)
} as const;

/**
 * WiFi Splash Screen Widget
 *
 * Usage:
 *   const renderer = new CanvasRenderer();
 *   const wifiSplash = new WifiSplash(renderer);
 *   wifiSplash.render(strings.wifi_config);
 */
export class WifiSplash {
  private renderer: CanvasRenderer;

  constructor(renderer: CanvasRenderer) {
    this.renderer = renderer;
  }

  /**
   * Render the WiFi splash screen.
   *
   * @param text - Multi-line text to display (lines separated by \n or \r\n)
   *
   * The text is rendered with:
   * - Background: vertical gradient #4c8cb9 (top) to #a6cdec (bottom)
   * - Font: 14px Montserrat
   * - Color: white
   * - Alignment: centered horizontally and vertically
   */
  render(text: string): void {
    const { width, height } = this.renderer;
    const ctx = this.renderer.ctx;

    // 1. Draw gradient background covering entire screen
    this.renderer.gradient(
      0,
      0,
      width,
      height,
      WIFI_SPLASH_SCREEN.background.top,
      WIFI_SPLASH_SCREEN.background.bottom
    );

    // 2. Prepare text rendering
    const fontSpec = WIFI_SPLASH_SCREEN.message.font;
    const font = `${fontSpec.size}px ${fontSpec.family}`;
    const lineHeight = fontSpec.size * WIFI_SPLASH.lineSpacing;
    const lines = this.normalizeLines(text);

    // Set text properties for measurement and drawing
    ctx.font = font;
    ctx.fillStyle = WIFI_SPLASH_SCREEN.message.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3. Calculate total text block height
    const totalTextHeight = lines.length * lineHeight;

    // 4. Calculate starting Y position to center the block vertically
    const startY = (height - totalTextHeight) / 2 + lineHeight / 2;

    // 5. Draw each line centered horizontally
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, width / 2, y);
    });
  }

  /**
   * Normalize line endings and preserve paragraph spacing.
   * - Converts \r\n to \n
   * - Trims trailing whitespace on each line
   * - Preserves empty lines (they render as blank lines)
   */
  private normalizeLines(text: string): string[] {
    // Normalize \r\n to \n, then split
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    // Trim trailing whitespace on each line, keep empty lines as ""
    return lines.map(line => line.trimEnd());
  }
}

export default WifiSplash;
