import { ParsedDimension } from './AuraInoParser';

export function extractDimensions(content: string, lines: string[]): ParsedDimension[] {
  const dimensions: ParsedDimension[] = [];
  const regex = /lv_obj_set_size\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const lineNum = content.substring(0, match.index).split('\n').length;
    dimensions.push({ name: `size_${dimensions.length}`, width, height, line: lineNum });
  }
  return dimensions.sort((a, b) => a.line - b.line);
}
