import { ParsedColor } from './AuraInoParser';
import { COMMON_COLOR_MAP } from './colorMap';

export async function extractColors(content: string, lines: string[]): Promise<ParsedColor[]> {
  const colors: ParsedColor[] = [];
  const colorMap: Record<string, { line: number; count: number }> = {};

  const regex = /lv_color_hex\s*\(\s*0x([0-9a-fA-F]{6})\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const hex = `#${match[1]}`.toLowerCase();
    const lineNum = content.substring(0, match.index).split('\n').length;
    if (!colorMap[hex]) {
      colorMap[hex] = { line: lineNum, count: 0 };
    }
    colorMap[hex].count++;
  }

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
    const name = (COMMON_COLOR_MAP as any)[hex] || commonColors[hex] || `color_${hex.replace('#', '')}`;
    colors.push({ name, value: hex, line: info.line });
  }
  return colors.sort((a, b) => a.line - b.line);
}
