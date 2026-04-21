export function extractScreenDimensions(content: string, lines: string[]): { width: number; height: number } {
  const widthMatch = content.match(/#define\s+SCREEN_WIDTH\s+(\d+)/);
  const heightMatch = content.match(/#define\s+SCREEN_HEIGHT\s+(\d+)/);
  return {
    width: widthMatch ? parseInt(widthMatch[1], 10) : 240,
    height: heightMatch ? parseInt(heightMatch[1], 10) : 320,
  };
}
