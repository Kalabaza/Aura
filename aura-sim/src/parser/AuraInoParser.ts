/**
 * AuraInoParser - Extracts UI constants from aura/aura.ino
 *
 * This parser performs static analysis on the Arduino C++ file to extract:
 * - Color values (hex from lv_color_hex calls)
 * - Screen dimensions (#define SCREEN_WIDTH/HEIGHT)
 * - Font declarations (LV_FONT_DECLARE)
 * - Layout positions and sizes (from lv_obj_align, lv_obj_set_size, etc.)
 * - Default values for settings
 *
 * The parser uses regex-based extraction and does not require a full C++ parser.
 * It generates a TypeScript file with all extracted constants.
 *
 * Usage:
 *   const parser = new AuraInoParser('/path/to/aura.ino');
 *   const output = parser.parse();
 *   console.log(output);
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractColors } from './colors';
import { extractScreenDimensions } from './screenDimensions';
import { extractFonts } from './fonts';
import { extractPositions } from './positions';
import { extractDimensions } from './dimensions';
import { extractDefaults } from './defaults';

// Get current directory for relative path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug flag - enables/disables debug logging
const DEBUG = import.meta.env?.DEV || import.meta.env?.VITE_DEBUG === 'true';

export interface ParsedColor {
  name: string;
  value: string;
  line?: number;
  comment?: string;
}

export interface ParsedDimension {
  name: string;
  width: number;
  height: number;
  line: number;
}

export interface ParsedPosition {
  name: string;
  x: number;
  y: number;
  line: number;
}

export interface ParsedFont {
  name: string;
  size: number;
  line: number;
}

export interface ParsedDefaults {
  latitude: string;
  longitude: string;
  location: string;
  dayBrightness: number;
  nightBrightness: number;
  currentLanguage: number;
  screenOffTimeoutIndex: number;
  lineReferences: Record<string, number>;
}

export interface ParsedResult {
  colors: ParsedColor[];
  screen: { width: number; height: number };
  fonts: ParsedFont[];
  positions: ParsedPosition[];
  dimensions: ParsedDimension[];
  defaults: ParsedDefaults;
  timestamp: number;
}

/**
 * AuraInoParser class
 */
export class AuraInoParser {
  private auraInoPath: string;

  constructor(auraInoPath?: string) {
    // Default to ../aura/aura.ino relative to this file
    this.auraInoPath = auraInoPath || join(__dirname, '..', '..', '..', 'aura', 'aura.ino');
  }

  /**
   * Parse the aura.ino file and extract constants
   */
  async parse(): Promise<ParsedResult> {
    const content = await readFile(this.auraInoPath, 'utf-8');
    const lines = content.split('\n');

    return {
      colors: await extractColors(content, lines),
      screen: extractScreenDimensions(content, lines),
      fonts: extractFonts(content, lines),
      positions: extractPositions(content, lines),
      dimensions: extractDimensions(content, lines),
      defaults: extractDefaults(content, lines),
      timestamp: Date.now(),
    };
  }

  /**
   * Extract colors from lv_color_hex() calls
   * Pattern: lv_color_hex(0x4c8cb9)
   */
  private async extractColors(content: string, lines: string[]): Promise<ParsedColor[]> {
    const colors: ParsedColor[] = [];
    const colorMap: Record<string, { line: number; count: number }> = {};

    // Find all lv_color_hex calls
    const regex = /lv_color_hex\s*\(\s*0x([0-9a-fA-F]{6})\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const hex = `#${match[1]}`.toLowerCase();
      const lineNum = this.getLineNumber(content, match.index);

      // Count occurrences to give meaningful names
      if (!colorMap[hex]) {
        colorMap[hex] = { line: lineNum, count: 0 };
      }
      colorMap[hex].count++;
    }

    // Assign names based on common colors from Constants.ts
    const commonColors: Record<string, string> = {
      '#4c8cb9': 'backgroundTop',
      '#a6cdec': 'backgroundBottom',
      '#ffffff': 'textWhite',
      '#e4ffff': 'textCyan',
      '#b9ecff': 'textBlue',
      '#5e9bc8': 'boxBackground',
      '#4a7a99': 'wifiInactive',
      '#ff4444': 'wifiOff',
      '#6aafd4': 'spinnerBackground',
      '#4caf50': 'buttonGreen',
      '#f44336': 'buttonRed',
      '#ff8c00': 'buttonOrange',
      '#e67600': 'buttonOrangePressed',
    };

    for (const [hex, info] of Object.entries(colorMap)) {
      const name = commonColors[hex] || this.generateColorName(hex, info.count);
      colors.push({
        name,
        value: hex,
        line: info.line,
      });
    }

    // Sort by line number for consistent ordering
    return colors.sort((a, b) => a.line - b.line);
  }

  /**
   * Extract screen dimensions from #define SCREEN_WIDTH and SCREEN_HEIGHT
   */
  private extractScreenDimensions(content: string, lines: string[]): { width: number; height: number } {
    const widthMatch = content.match(/#define\s+SCREEN_WIDTH\s+(\d+)/);
    const heightMatch = content.match(/#define\s+SCREEN_HEIGHT\s+(\d+)/);

    return {
      width: widthMatch ? parseInt(widthMatch[1], 10) : 240,
      height: heightMatch ? parseInt(heightMatch[1], 10) : 320,
    };
  }

  /**
   * Extract font declarations from LV_FONT_DECLARE
   * Pattern: LV_FONT_DECLARE(lv_font_montserrat_latin_12);
   */
  private extractFonts(content: string, lines: string[]): ParsedFont[] {
    const fonts: ParsedFont[] = [];
    const regex = /LV_FONT_DECLARE\s*\(\s*lv_font_montserrat_latin_(\d+)\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const size = parseInt(match[1], 10);
      const lineNum = this.getLineNumber(content, match.index);

      fonts.push({
        name: `size${size}`,
        size,
        line: lineNum,
      });
    }

    return fonts.sort((a, b) => a.size - b.size);
  }

  /**
   * Extract positions from lv_obj_align and lv_obj_align_to calls
   * This is a heuristic extraction focusing on common patterns
   */
  private extractPositions(content: string, lines: string[]): ParsedPosition[] {
    const positions: ParsedPosition[] = [];

    // Pattern 1: lv_obj_align(obj, LV_ALIGN_..., x, y)
    const alignRegex = /lv_obj_align\s*\(\s*\w+\s*,\s*LV_ALIGN_\w+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
    let match;

    while ((match = alignRegex.exec(content)) !== null) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      const lineNum = this.getLineNumber(content, match.index);

      positions.push({
        name: `align_pos_${positions.length}`,
        x,
        y,
        line: lineNum,
      });
    }

    // Pattern 2: lv_obj_set_pos(obj, x, y)
    const setPosRegex = /lv_obj_set_pos\s*\(\s*\w+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;

    while ((match = setPosRegex.exec(content)) !== null) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      const lineNum = this.getLineNumber(content, match.index);

      positions.push({
        name: `set_pos_${positions.length}`,
        x,
        y,
        line: lineNum,
      });
    }

    return positions.sort((a, b) => a.line - b.line);
  }

  /**
   * Extract dimensions from lv_obj_set_size calls
   */
  private extractDimensions(content: string, lines: string[]): ParsedDimension[] {
    const dimensions: ParsedDimension[] = [];
    const regex = /lv_obj_set_size\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      const lineNum = this.getLineNumber(content, match.index);

      dimensions.push({
        name: `size_${dimensions.length}`,
        width,
        height,
        line: lineNum,
      });
    }

    return dimensions.sort((a, b) => a.line - b.line);
  }

  /**
   * Extract default values from #define and variable initializations
   */
  private extractDefaults(content: string, lines: string[]): ParsedDefaults {
    const lineRefs: Record<string, number> = {};

    // Latitude default
    const latMatch = content.match(/#define\s+LATITUDE_DEFAULT\s+"([^"]+)"/);
    lineRefs.latitude = latMatch ? this.getLineNumber(content, content.indexOf(latMatch[0])) : 0;

    // Longitude default
    const lonMatch = content.match(/#define\s+LONGITUDE_DEFAULT\s+"([^"]+)"/);
    lineRefs.longitude = lonMatch ? this.getLineNumber(content, content.indexOf(lonMatch[0])) : 0;

    // Location default
    const locMatch = content.match(/#define\s+LOCATION_DEFAULT\s+"([^"]+)"/);
    lineRefs.location = locMatch ? this.getLineNumber(content, content.indexOf(locMatch[0])) : 0;

    // Day brightness default (from settings slider)
    const brightMatch = content.match(/defaultValue:\s*(\d+)/);
    lineRefs.dayBrightness = brightMatch ? this.getLineNumber(content, content.indexOf(brightMatch[0])) : 0;

    // Night brightness default
    const nightMatch = content.match(/defaultValue:\s*(\d+).*Night brightness/);
    lineRefs.nightBrightness = nightMatch ? this.getLineNumber(content, content.indexOf(nightMatch[0])) : 0;

    // Current language default (LANG_EN = 0)
    lineRefs.currentLanguage = 0; // Hardcoded as 0 for LANG_EN

    // Screen off timeout default index
    const timeoutMatch = content.match(/screenOffTimeoutIndex:\s*(\d+)/);
    lineRefs.screenOffTimeoutIndex = timeoutMatch
      ? parseInt(timeoutMatch[1], 10)
      : 2;

    return {
      latitude: latMatch ? latMatch[1] : '51.5074',
      longitude: lonMatch ? lonMatch[1] : '-0.1278',
      location: locMatch ? locMatch[1] : 'London',
      dayBrightness: brightMatch ? parseInt(brightMatch[1], 10) : 128,
      nightBrightness: nightMatch ? parseInt(nightMatch[1], 10) : 64,
      currentLanguage: 0,
      screenOffTimeoutIndex: lineRefs.screenOffTimeoutIndex,
      lineReferences: lineRefs,
    };
  }

  /**
   * Get line number from character offset
   */
  private getLineNumber(content: string, charOffset: number): number {
    const lines = content.substring(0, charOffset).split('\n');
    return lines.length;
  }

  /**
   * Generate a name for a color based on its hex value and frequency
   */
  private generateColorName(hex: string, count: number): string {
    // If it appears only once, give a generic name
    if (count === 1) {
      return `color_${hex.replace('#', '')}`;
    }
    // If it appears multiple times, it might be a reused color
    return `reusedColor_${hex.replace('#', '')}`;
  }

  /**
   * Generate TypeScript code from parsed result
   */
  generateTypeScript(result: ParsedResult): string {
    const lines: string[] = [];

    lines.push(`/**
 * Auto-generated constants from aura/aura.ino
 * Generated: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated by AuraInoParser
 * To regenerate: Run the file watcher or manually invoke the parser
 */
`);

    // SCREEN first (no dependencies)
    lines.push(`// ============================================================================`);
    lines.push(`// SCREEN DIMENSIONS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const SCREEN = {`);
    lines.push(`  width: ${result.screen.width} as const,`);
    lines.push(`  height: ${result.screen.height} as const,`);
    lines.push(`} as const;`);
    lines.push(``);

    // FONTS
    lines.push(`// ============================================================================`);
    lines.push(`// FONTS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const FONTS = {`);

    for (const font of result.fonts) {
      lines.push(`  size${font.size}: { size: ${font.size}, weight: 400 as const, family: 'Montserrat' } as const, // aura.ino:${font.line}`);
    }

    lines.push(`} as const;`);
    lines.push(``);

    // getFont function (depends on FONTS)
    const fontSizes = result.fonts.map(f => f.size);
    lines.push(`// Helper to get font by size`);
    lines.push(`export function getFont(size: ${fontSizes.join(' | ')}) {`);
    lines.push(`  return FONTS[` + '`size${size}`' + '];');
    lines.push(`}`);
    lines.push(``);

    // LV_PALETTE (needed by COLORS)
    lines.push(`// ============================================================================`);
    lines.push(`// LV_PALETTE CONSTANTS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const LV_PALETTE = {`);
    lines.push(`  RED: 0 as const,`);
    lines.push(`  GREEN: 1 as const,`);
    lines.push(`  BLUE: 2 as const,`);
    lines.push(`  GREY: 3 as const,`);
    lines.push(`} as const;`);
    lines.push(``);

    lines.push(`// Helper to convert LV_PALETTE constants to hex`);
    lines.push(`export function lvPaletteToHex(palette: number): string {`);
    lines.push(`  const paletteMap: Record<number, string> = {`);
    lines.push(`    [LV_PALETTE.RED]: '#F44336',`);
    lines.push(`    [LV_PALETTE.GREEN]: '#4CAF50',`);
    lines.push(`    [LV_PALETTE.BLUE]: '#2196F3',`);
    lines.push(`    [LV_PALETTE.GREY]: '#9E9E9E',`);
    lines.push(`  };`);
    lines.push(`  return paletteMap[palette] || '#9E9E9E';`);
    lines.push(`}`);
    lines.push(``);

    // COLORS are defined manually in Constants.ts to allow custom naming
    // (some hex values have multiple semantic names)
    // TIMINGS
    lines.push(`// ============================================================================`);
    lines.push(`// TIMINGS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const TIMINGS = {`);
    lines.push(`  spinnerRotation: 16 as const, // ms (aura.ino:815)`);
    lines.push(`  spinnerAngleDelta: 4 as const, // degrees per tick (aura.ino:782)`);
    lines.push(`  settingsTimeout: 30000 as const, // ms (aura.ino:124)`);
    lines.push(`  screenOffTimeoutDefault: 30 as const, // seconds (aura.ino:75, default index)`);
    lines.push(`  weatherUpdateInterval: 600000 as const, // ms (aura.ino:28)`);
    lines.push(`  screenUpdateInterval: 1000 as const, // ms (aura.ino:29)`);
    lines.push(`  touchWakeIgnore: 500 as const, // ms (aura.ino:422)`);
    lines.push(`} as const;`);
    lines.push(``);

    // DEFAULTS
    lines.push(`// ============================================================================`);
    lines.push(`// DEFAULTS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const DEFAULTS = {`);
    lines.push(`  latitude: '${result.defaults.latitude}' as const,`);
    lines.push(`  longitude: '${result.defaults.longitude}' as const,`);
    lines.push(`  location: '${result.defaults.location}' as const,`);
    lines.push(`  dayBrightness: ${result.defaults.dayBrightness} as const,`);
    lines.push(`  nightBrightness: ${result.defaults.nightBrightness} as const,`);
    lines.push(`  currentLanguage: ${result.defaults.currentLanguage} as const,`);
    lines.push(`  screenOffTimeoutIndex: ${result.defaults.screenOffTimeoutIndex} as const,`);
    lines.push(`} as const;`);
    lines.push(``);

    // ALIGN
    lines.push(`// ============================================================================`);
    lines.push(`// ALIGNMENT CONSTANTS`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`export const ALIGN = {`);
    lines.push(`  TOP_LEFT: 'TOP_LEFT' as const,`);
    lines.push(`  TOP_MID: 'TOP_MID' as const,`);
    lines.push(`  TOP_RIGHT: 'TOP_RIGHT' as const,`);
    lines.push(`  BOTTOM_LEFT: 'BOTTOM_LEFT' as const,`);
    lines.push(`  BOTTOM_MID: 'BOTTOM_MID' as const,`);
    lines.push(`  BOTTOM_RIGHT: 'BOTTOM_RIGHT' as const,`);
    lines.push(`  LEFT_TOP: 'LEFT_TOP' as const,`);
    lines.push(`  LEFT_MID: 'LEFT_MID' as const,`);
    lines.push(`  LEFT_BOTTOM: 'LEFT_BOTTOM' as const,`);
    lines.push(`  RIGHT_TOP: 'RIGHT_TOP' as const,`);
    lines.push(`  RIGHT_MID: 'RIGHT_MID' as const,`);
    lines.push(`  RIGHT_BOTTOM: 'RIGHT_BOTTOM' as const,`);
    lines.push(`  CENTER: 'CENTER' as const,`);
    lines.push(`  OUT_TOP_LEFT: 'OUT_TOP_LEFT' as const,`);
    lines.push(`  OUT_TOP_MID: 'OUT_TOP_MID' as const,`);
    lines.push(`  OUT_TOP_RIGHT: 'OUT_TOP_RIGHT' as const,`);
    lines.push(`  OUT_BOTTOM_LEFT: 'OUT_BOTTOM_LEFT' as const,`);
    lines.push(`  OUT_BOTTOM_MID: 'OUT_BOTTOM_MID' as const,`);
    lines.push(`  OUT_BOTTOM_RIGHT: 'OUT_BOTTOM_RIGHT' as const,`);
    lines.push(`  OUT_LEFT_TOP: 'OUT_LEFT_TOP' as const,`);
    lines.push(`  OUT_LEFT_MID: 'OUT_LEFT_MID' as const,`);
    lines.push(`  OUT_LEFT_BOTTOM: 'OUT_LEFT_BOTTOM' as const,`);
    lines.push(`  OUT_RIGHT_TOP: 'OUT_RIGHT_TOP' as const,`);
    lines.push(`  OUT_RIGHT_MID: 'OUT_RIGHT_MID' as const,`);
    lines.push(`  OUT_RIGHT_BOTTOM: 'OUT_RIGHT_BOTTOM' as const,`);
    lines.push(`} as const;`);
    lines.push(``);
    lines.push(`export type Alignment = typeof ALIGN[keyof typeof ALIGN];`);
    lines.push(``);

    lines.push(`// ============================================================================`);
    lines.push(`// EXPORT SUMMARY`);
    lines.push(`// ============================================================================`);
    lines.push(``);
    lines.push(`// Extracted: ${result.colors.length} colors, ${result.fonts.length} fonts, ${result.positions.length} positions, ${result.dimensions.length} dimensions`);
    lines.push(`// Generated at: ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  /**
   * Parse and generate the TypeScript file
   */
  async generateFile(outputPath?: string): Promise<string> {
    const result = await this.parse();
    const typescript = this.generateTypeScript(result);

    if (outputPath) {
      const fs = await import('fs');
      await fs.promises.writeFile(outputPath, typescript, 'utf-8');
      if (DEBUG) {
        console.debug('[AuraInoParser] Generated constants at:', outputPath);
      }
    }

    return typescript;
  }
}

// Standalone function for CLI usage
export async function parseAuraIno(inputPath?: string, outputPath?: string): Promise<string> {
  const parser = new AuraInoParser(inputPath);
  return await parser.generateFile(outputPath);
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  parseAuraIno(process.argv[2], process.argv[3])
    .catch(err => console.error('Parse failed:', err));
}
