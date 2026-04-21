/**
 * Virtual Keyboard Widget for Aura Simulator
 *
 * Renders an on-screen keyboard matching the ESP32 device's LVGL keyboard.
 * Two modes: Letter mode (lowercase/uppercase) and Numeric mode.
 * Keyboard is perfectly centered horizontally.
 */

import { CanvasRenderer } from '../CanvasRenderer';
import { SCREEN, FONTS } from '../Constants';

export interface VirtualKeyboardProps {
  visible: boolean;
  onKey: (key: string) => void;
  onDone?: () => void;
  onCancel?: () => void;
}

export type LetterMode = 'lower' | 'upper';
export type KeyboardMode = 'letters' | 'numeric';

/**
 * VirtualKeyboard widget - matches device keyboard layout
 */
export class VirtualKeyboard {
  // Store key rectangles for hit testing
  private keyRects: Array<{ key: string; x: number; y: number; w: number; h: number }> = [];

  // Keyboard dimensions
  private readonly keyboardHeight = 108; // 4 rows + padding
  private readonly rowGap = 3;
  private readonly keyGap = 2;
  private readonly keyHeight = 22;

  // Font for key labels
  private readonly keyFont: string = `${FONTS.size12.size}px ${FONTS.size12.family}`;

  // Define keyboard layout (computed dynamically)
  private layout: Array<{ row: number; key: string; x: number; w: number; output: string; isSpecial: boolean }> = [];

  // Current state
  private letterMode: LetterMode = 'lower';
  private keyboardMode: KeyboardMode = 'letters';

  constructor() {
    this.buildLayout();
  }

  /**
   * Set the keyboard mode (letters or numeric)
   */
  public setMode(mode: KeyboardMode): void {
    if (this.keyboardMode !== mode) {
      this.keyboardMode = mode;
      this.buildLayout();
    }
  }

  /**
   * Toggle letter case (lower/upper) - only in letter mode
   */
  public toggleCase(): void {
    if (this.keyboardMode === 'letters') {
      this.letterMode = this.letterMode === 'lower' ? 'upper' : 'lower';
      this.buildLayout();
    }
  }

  /**
   * Get current letter mode
   */
  public getLetterMode(): LetterMode {
    return this.letterMode;
  }

  /**
   * Get current keyboard mode
   */
  public getKeyboardMode(): KeyboardMode {
    return this.keyboardMode;
  }

  /**
   * Reset keyboard to default state (lowercase letter mode)
   */
  public reset(): void {
    this.letterMode = 'lower';
    this.keyboardMode = 'letters';
    this.buildLayout();
  }

  /**
   * Build the keyboard layout geometry.
   * Keyboard rows are centered horizontally on the 240px screen.
   */
  private buildLayout(): void {
    this.layout = [];
    const screenWidth = SCREEN.width;
    const kbTopPadding = 4;
    const kbY = SCREEN.height - this.keyboardHeight + kbTopPadding;

    // Key widths (in pixels) - adjusted for 240px width
    const digitW = 18; // Reduced from 20 to fit 10 digits
    const letterW = 15; // Reduced from 18 to fit 10 letters (with 2px gaps)
    const symbolW = 16;
    const backspaceW = 30;
    const enterW = 30;
    const modeW = 30; // ABC / 1# / abc key
    const arrowW = 22;
    const checkW = 26;
    // spaceW will be calculated dynamically to fill row width

    const gap = this.keyGap;

    // Helper to build a row that fills the screen width.
    // Keys with undefined `w` are flexible and will expand to fill remaining space.
    // Keys with defined `w` are fixed width.
    const addRow = (rowNum: number, keys: Array<{ label: string; w?: number; output: string; isSpecial?: boolean }>) => {
      const totalKeys = keys.length;
      const totalGaps = (totalKeys - 1) * gap;

      let fixedWidthSum = 0;
      let flexibleCount = 0;
      keys.forEach(k => {
        if (k.w === undefined) {
          flexibleCount++;
        } else {
          fixedWidthSum += k.w;
        }
      });

      const totalFixed = fixedWidthSum + totalGaps;
      const remaining = screenWidth - totalFixed;

      let x = 0;
      if (flexibleCount > 0) {
        const baseFlexW = Math.floor(remaining / flexibleCount);
        let remainder = remaining % flexibleCount;

        keys.forEach(item => {
          const w = item.w !== undefined ? item.w : (baseFlexW + (remainder > 0 ? 1 : 0));
          if (item.w === undefined && remainder > 0) remainder--;
          this.layout.push({
            row: rowNum,
            key: item.label,
            x,
            w,
            output: item.output,
            isSpecial: item.isSpecial || false
          });
          x += w + gap;
        });
      } else {
        keys.forEach(item => {
          const w = item.w!;
          this.layout.push({
            row: rowNum,
            key: item.label,
            x,
            w,
            output: item.output,
            isSpecial: item.isSpecial || false
          });
          x += w + gap;
        });
      }
    };

    if (this.keyboardMode === 'letters') {
      // Row 1: 1# (mode switch) + letters + backspace
      // 1# q w e r t y u i o p ⌫
      addRow(0, [
        { label: '1#', w: modeW, output: 'MODE_NUMERIC', isSpecial: true },
        ...(this.letterMode === 'lower' ? 'qwertyuiop' : 'QWERTYUIOP').split('').map(ch => ({ label: ch, output: ch })),
        { label: '⌫', w: backspaceW, output: 'BACKSPACE', isSpecial: true }
      ]);

      // Row 2: ABC (case toggle) + letters + enter
      // ABC a s d f g h j k l ⏎ (lowercase)
      // abc A S D F G H J K L ⏎ (uppercase)
      const letters2 = this.letterMode === 'lower' ? 'asdfghjkl' : 'ASDFGHJKL';
      addRow(1, [
        { label: this.letterMode === 'lower' ? 'ABC' : 'abc', w: modeW, output: 'CAPS', isSpecial: true },
        ...letters2.split('').map(ch => ({ label: ch, output: ch })),
        { label: '⏎', w: enterW, output: 'DONE', isSpecial: true }
      ]);

      // Row 3: Symbols + letters + punctuation
      // _ - z x c v b n m . , : (lowercase)
      // _ - Z X C V B N M . , : (uppercase)
      const letters3 = this.letterMode === 'lower' ? 'zxcvbnm' : 'ZXCVBNM';
      addRow(2, [
        { label: '_',  output: '_', isSpecial: true },
        { label: '-',  output: '-', isSpecial: true },
        ...letters3.split('').map(ch => ({ label: ch, output: ch })),
        { label: '.',  output: '.' },
        { label: ',',  output: ',' },
        { label: ':',  output: ':' }
      ]);

      // Row 4: Hide + cursor-left + space + cursor-right + done
      // ⌨ < [space] > ✓
      // Calculate dynamic space width to fill the row exactly
      // Keys: hide(arrowW) + left(arrowW) + space(dynamic) + right(arrowW) + done(checkW)
      // Gaps: 4 gaps between 5 keys

      addRow(3, [
        { label: '⌨', w: arrowW, output: 'HIDE', isSpecial: true },
        { label: '<', w: arrowW, output: 'LEFT', isSpecial: true },
        { label: ' ', output: ' ' },
        { label: '>', w: arrowW, output: 'RIGHT', isSpecial: true },
        { label: '✓', w: checkW, output: 'DONE', isSpecial: true }
      ]);
    } else {
      // Numeric mode
      // Row 1: digits + backspace
      // 1 2 3 4 5 6 7 8 9 0 ⌫
      addRow(0, [
        ...'1234567890'.split('').map(ch => ({ label: ch, output: ch })),
        { label: '⌫', w: backspaceW, output: 'BACKSPACE', isSpecial: true }
      ]);

      // Row 2: abc (back to letters) + symbols
      // abc + & / * = % ! ? # < >
      addRow(1, [
        { label: 'abc', w: modeW, output: 'MODE_LETTERS', isSpecial: true },
        { label: '+',  output: '+' },
        { label: '&',  output: '&' },
        { label: '/',  output: '/' },
        { label: '*',  output: '*' },
        { label: '=',  output: '=' },
        { label: '%',  output: '%' },
        { label: '!',  output: '!' },
        { label: '?',  output: '?' },
        { label: '#',  output: '#' },
        { label: '<',  output: '<' },
        { label: '>',  output: '>' }
      ]);

      // Row 3: More symbols
      // \ @ $ ( ) { } [ ] ; " '
      addRow(2, [
        { label: '\\',  output: '\\' },
        { label: '@',  output: '@' },
        { label: '$',  output: '$' },
        { label: '(',  output: '(' },
        { label: ')',  output: ')' },
        { label: '{',  output: '{' },
        { label: '}',  output: '}' },
        { label: '[',  output: '[' },
        { label: ']',  output: ']' },
        { label: ';',  output: ';' },
        { label: '"',  output: '"' },
        { label: "'",  output: "'" }
      ]);

      // Row 4: Hide + navigation + space + done
      // ⌨ < [space] > ✓
      // Calculate dynamic space width to fill the row exactly
      // Keys: hide(arrowW) + left(arrowW) + space(dynamic) + right(arrowW) + done(checkW)
      // Gaps: 4 gaps between 5 keys

      addRow(3, [
        { label: '⌨', w: arrowW, output: 'HIDE', isSpecial: true },
        { label: '<', w: arrowW, output: 'BACKSPACE', isSpecial: true },
        { label: ' ', output: ' ' },
        { label: '>', w: arrowW, output: 'RIGHT', isSpecial: true },
        { label: '✓', w: checkW, output: 'DONE', isSpecial: true }
      ]);
    }
  }

  /**
   * Renders the keyboard if visible.
   */
  public render(renderer: CanvasRenderer, props: VirtualKeyboardProps): void {
    if (!props.visible) {
      return;
    }

    // Clear previous key rects
    this.keyRects = [];

    // Draw keyboard background (light gray bar at bottom)
    const kbY = SCREEN.height - this.keyboardHeight;
    renderer.rect(0, kbY, SCREEN.width, this.keyboardHeight, '#EEEEEE');

    // Draw keys based on precomputed layout
    for (const item of this.layout) {
      const keyY = kbY + 4 + item.row * (this.keyHeight + this.rowGap);
      const keyH = this.keyHeight;
      const keyX = item.x;
      const keyW = item.w;

      // Determine background color based on key type
      // Regular character keys: white (#FFFFFF)
      // Special/toggle keys: grey (#CCCCCC) for better contrast
      const bgColor = item.isSpecial ? '#CCCCCC' : '#FFFFFF';
      const borderColor = '#CCCCCC';
      const innerColor = item.isSpecial ? '#BBBBBB' : '#FAFAFA';

      // Draw key background (slight 3D effect)
      renderer.rect(keyX, keyY, keyW, keyH, bgColor, 2);
      // Inner highlight
      renderer.rect(keyX + 2, keyY + 2, keyW - 4, keyH - 4, innerColor, 0);

      // Draw key text
      const displayText = item.key;

      renderer.text(
        displayText,
        keyX + keyW / 2,
        keyY + keyH / 2,
        this.keyFont,
        '#000000',
        'center',
        'middle'
      );

      // Store rect for hit testing (include output for proper handling)
      this.keyRects.push({
        key: item.output,
        x: keyX,
        y: keyY,
        w: keyW,
        h: keyH
      });
    }
  }

  /**
   * Handles a touch event. Returns true if the touch was on a key.
   */
  public handleTouch(x: number, y: number, props: VirtualKeyboardProps): boolean {
    if (!props.visible) {
      return false;
    }

    const kbY = SCREEN.height - this.keyboardHeight;

    // If touch is above the keyboard area, don't handle
    if (y < kbY) {
      return false;
    }

    // Check if touch is on any key
    for (const kr of this.keyRects) {
      if (x >= kr.x && x <= kr.x + kr.w && y >= kr.y && y <= kr.y + kr.h) {
        const outputKey = kr.key;

        // Handle mode switching keys (consume, don't pass to parent)
        if (outputKey === 'CAPS') {
          // Toggle case in letter mode
          this.toggleCase();
          return true;
        }

        if (outputKey === 'MODE_LETTERS') {
          // Switch from numeric to letter mode, reset to lowercase
          this.setMode('letters');
          this.letterMode = 'lower';
          return true;
        }

        if (outputKey === 'MODE_NUMERIC') {
          // Switch from letters to numeric mode
          this.setMode('numeric');
          return true;
        }

        if (outputKey === 'HIDE') {
          // Hide keyboard
          if (props.onCancel) {
            props.onCancel();
          }
          return true;
        }

        // For all other keys, pass to parent
        props.onKey(outputKey);

        // Done triggers the onDone callback
        if (outputKey === 'DONE' && props.onDone) {
          props.onDone();
        }
        return true;
      }
    }

    // Touch within keyboard area but not on a key: consume to block underlying UI
    return true;
  }
}
