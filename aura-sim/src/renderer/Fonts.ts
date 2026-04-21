/**
 * Font configuration for Aura Simulator
 * Maps LVGL font declarations to web font families and sizes.
 *
 * The device uses Montserrat Latin fonts generated for LVGL.
 * In the simulator, we use Google Fonts Montserrat with matching weights.
 */

import { FONTS } from './Constants';

// One-time tracking to avoid repeated loads
let fontsInitPromise: Promise<void> | null = null;

/**
 * Font family to use for all UI text.
 * Montserrat is loaded via @font-face from Google Fonts or local files.
 */
export const FONT_FAMILY = 'Montserrat, sans-serif';

/**
 * Map LVGL font sizes (12, 14, 16, 20, 42) to CSS font specifications.
 * Each font size uses weight 400 (regular) as per LVGL font declarations.
 */
export const FONT_SIZES = {
  12: { size: '12px', family: FONT_FAMILY, weight: 400 as const },
  14: { size: '14px', family: FONT_FAMILY, weight: 400 as const },
  16: { size: '16px', family: FONT_FAMILY, weight: 400 as const },
  20: { size: '20px', family: FONT_FAMILY, weight: 400 as const },
  42: { size: '42px', family: FONT_FAMILY, weight: 400 as const },
} as const;

/** Pre-cached font style strings to avoid per-frame allocations */
const CACHED_FONT_STYLES: Record<number, string> = {
  12: `${FONT_SIZES[12].size} ${FONT_SIZES[12].family}`,
  14: `${FONT_SIZES[14].size} ${FONT_SIZES[14].family}`,
  16: `${FONT_SIZES[16].size} ${FONT_SIZES[16].family}`,
  20: `${FONT_SIZES[20].size} ${FONT_SIZES[20].family}`,
  42: `${FONT_SIZES[42].size} ${FONT_SIZES[42].family}`,
};

/**
 * Get CSS font string for a given LVGL font size.
 * Usage: `font: getFontStyle(14);` returns "14px Montserrat"
 * Returns cached string to avoid per-frame allocation.
 */
export function getFontStyle(size: 12 | 14 | 16 | 20 | 42): string {
  return CACHED_FONT_STYLES[size];
}

/**
 * Get full font CSS properties object for canvas or style usage.
 */
export function getFontProperties(size: 12 | 14 | 16 | 20 | 42): {
  fontSize: string;
  fontFamily: string;
  fontWeight: number;
} {
  const font = FONT_SIZES[size];
  return {
    fontSize: font.size,
    fontFamily: font.family,
    fontWeight: font.weight,
  };
}

let fontStylesInjected = false;

/**
 * Inject Google Fonts link and font-smoothing styles for canvas text.
 */
export function injectFontStyles(): void {
  if (fontStylesInjected) return;
  fontStylesInjected = true;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = 'https://fonts.googleapis.com';
  document.head.appendChild(link);

  const link2 = document.createElement('link');
  link2.rel = 'preconnect';
  link2.href = 'https://fonts.gstatic.com';
  link2.crossOrigin = 'anonymous';
  document.head.appendChild(link2);

  // Use <link> for faster font loading instead of @import in <style>
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400&display=swap';
  document.head.appendChild(stylesheet);

  const style = document.createElement('style');
  style.textContent = `
    canvas {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      font-smooth: always;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initialize fonts: inject Google Fonts <link> and wait for load.
 * Returns a promise that resolves when fonts are loaded and
 * ready for canvas rendering (includes a one-frame delay to
 * ensure paint propagation).
 */
export async function initializeFonts(): Promise<void> {
  if (fontsInitPromise) {
    return fontsInitPromise;
  }

  fontsInitPromise = new Promise((resolve) => {
    // Check if fonts are already loaded
    if (document.fonts && document.fonts.check('12px Montserrat')) {
      resolve();
      return;
    }

    injectFontStyles();

    if (document.fonts) {
      // Load the font and wait for it to be ready
      document.fonts.load('12px Montserrat').then(() => {
        // Wait one more frame so the browser can propagate the font to canvas
        requestAnimationFrame(() => {
          console.info('[Fonts] Fonts loaded successfully');
          resolve();
        });
      }).catch(() => {
        console.warn('[Fonts] Font loading failed, falling back to system fonts');
        resolve();
      });
    } else {
      console.warn('[Fonts] Font Loading API not supported, falling back to system fonts');
      resolve();
    }
  });

  return fontsInitPromise;
}

/**
 * CSS class names for common font sizes.
 * Apply to DOM elements directly.
 */
export const FONT_CLASSES = {
  size12: 'aura-font-12',
  size14: 'aura-font-14',
  size16: 'aura-font-16',
  size20: 'aura-font-20',
  size42: 'aura-font-42',
} as const;

/**
 * Inject CSS classes for font sizes (alternative to inline styles).
 */
export function injectFontClasses(): void {
  const style = document.createElement('style');
  style.textContent = `
    .aura-font-12 { font: 12px Montserrat; }
    .aura-font-14 { font: 14px Montserrat; }
    .aura-font-16 { font: 16px Montserrat; }
    .aura-font-20 { font: 20px Montserrat; }
    .aura-font-42 { font: 42px Montserrat; }
  `;
  document.head.appendChild(style);
}
