import { ParsedPosition } from './AuraInoParser';

export function extractPositions(content: string, lines: string[]): ParsedPosition[] {
  const positions: ParsedPosition[] = [];
  const alignRegex = /lv_obj_align\s*\(\s*\w+\s*,\s*LV_ALIGN_\w+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = alignRegex.exec(content)) !== null) {
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    const lineNum = content.substring(0, match.index).split('\n').length;
    positions.push({ name: `align_pos_${positions.length}`, x, y, line: lineNum });
  }
  const setPosRegex = /lv_obj_set_pos\s*\(\s*\w+\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g;
  while ((match = setPosRegex.exec(content)) !== null) {
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    const lineNum = content.substring(0, match.index).split('\n').length;
    positions.push({ name: `set_pos_${positions.length}`, x, y, line: lineNum });
  }
  return positions.sort((a, b) => a.line - b.line);
}
