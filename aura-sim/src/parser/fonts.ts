import { ParsedFont } from './AuraInoParser';

export function extractFonts(content: string, lines: string[]): ParsedFont[] {
  const fonts: ParsedFont[] = [];
  const regex = /LV_FONT_DECLARE\s*\(\s*lv_font_montserrat_latin_(\d+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const size = parseInt(match[1], 10);
    const lineNum = content.substring(0, match.index).split('\n').length;
    fonts.push({ name: `size${size}`, size, line: lineNum });
  }
  return fonts.sort((a, b) => a.size - b.size);
}
