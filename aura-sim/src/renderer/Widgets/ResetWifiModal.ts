/**
 * Reset WiFi Confirmation Modal for Aura Simulator
 *
 * Renders a modal dialog asking the user to confirm Wi-Fi credentials reset.
 * Mirrors the reset_wifi_event_handler() function from aura.ino (lines 928-958).
 *
 * Usage:
 *   const modal = new ResetWifiModal();
 *   modal.render(renderer, strings->reset_confirmation, onCancel, onConfirm);
 *
 * Or as part of a widget system:
 *   <ResetWifiModal
 *     message={strings.reset_confirmation}
 *     onCancel={handleCancel}
 *     onConfirm={handleConfirm}
 *   />
 */

import { CanvasRenderer } from '../CanvasRenderer';
import {
  COLORS,
  FONTS,
  RESET_WIFI_MODAL,
  SCREEN,
} from '../Constants';
import type { LocalizedStrings } from '../../state/LocalizedStrings';

// ============================================================================
// TYPES
// ============================================================================

export interface ResetWifiModalLayout {
  /** Overall modal box */
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Title bar area */
  header: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Title text position */
  title: {
    x: number;
    y: number;
  };
  /** Message text area */
  message: {
    x: number;
    y: number;
    width: number;
    height: number;
    lineHeight: number;
  };
  /** Close button (X in top-right corner) */
  closeButton: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Cancel button */
  cancelBtn: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Yes/Reset button */
  confirmBtn: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// CLASS
// ============================================================================

/**
 * ResetWifiModal - Renders the Reset WiFi confirmation dialog.
 *
 * This is a stateless renderer component. It computes layout and draws
 * all elements to the provided CanvasRenderer instance.
 *
 * The modal consists of:
 * - A centered container with 2px black border and 4px radius
 * - Header area with localized title (16px font, left-aligned with 10px margin)
 * - Content area with multiline confirmation message (12px font)
 * - Built-in close button (X) in top-right corner
 * - Footer with two buttons: Cancel (green) and Reset (red, 12px font)
 *
 * All positions and styles are derived from Constants.ts/RESET_WIFI_MODAL
 * and the original aura.ino implementation (lines 928-958).
 */
export class ResetWifiModal {
  // Modal dimensions
  private readonly modalWidth: number = RESET_WIFI_MODAL.msgbox.width;
  private readonly borderWidth: number = RESET_WIFI_MODAL.msgbox.border.width;
  private readonly borderRadius: number = RESET_WIFI_MODAL.msgbox.border.radius;
  private readonly headerHeight: number = 30; // Typical LVGL msgbox header
  private readonly padding: number = 10;
  private readonly buttonWidth: number = 90;
  private readonly buttonHeight: number = 36;
  private readonly footerSpacing: number = 10;
  private readonly closeButtonSize: number = 20;
  private readonly titleMarginLeft: number = RESET_WIFI_MODAL.msgbox.titleMarginLeft;

  // Fonts
  private readonly titleFont: string = `16px Montserrat`;
  private readonly messageFont: string = `12px Montserrat`;
  private readonly buttonFont: string = `12px Montserrat`;

  // Colors
  private readonly backgroundColor: string = COLORS.boxBackground; // White could also work, but using Aura theme
  private readonly borderColor: string = RESET_WIFI_MODAL.msgbox.border.color;
  private readonly titleTextColor: string = COLORS.textWhite;
  private readonly messageTextColor: string = COLORS.textWhite; // White text on blue background
  private readonly closeButtonColor: string = COLORS.textWhite;
  private readonly cancelButtonColor: string = COLORS.buttonGreen;
  private readonly confirmButtonColor: string = COLORS.buttonRed;
  private readonly confirmButtonPressedColor: string = '#C62828'; // Darker red for pressed state

  // Computed layout
  private layout: ResetWifiModalLayout | null = null;

  constructor() {}

  /**
   * Renders the modal to the provided renderer.
   *
   * @param renderer - CanvasRenderer instance to draw to
   * @param strings - Localized strings for current language
   * @param message - The confirmation message text (multiline supported)
   * @param onCancel - Callback for cancel action (close button, Cancel button)
   * @param onConfirm - Callback for confirm action (Reset button)
   */
  public render(
    renderer: CanvasRenderer,
    strings: LocalizedStrings,
    message: string,
    onCancel: () => void,
    onConfirm: () => void
  ): void {
    this.computeLayout(renderer, strings, message);
    this.drawBackground(renderer);
    this.drawBorder(renderer);
    this.drawHeader(renderer, strings);
    this.drawMessage(renderer, message);
    this.drawCloseButton(renderer);
    this.drawFooterButtons(renderer, strings);
  }

  /**
   * Computes the layout for all modal elements.
   * Centers the modal on screen and positions all child elements.
   */
  private computeLayout(
    renderer: CanvasRenderer,
    strings: LocalizedStrings,
    message: string
  ): void {
    const screenCenterX = Math.floor(SCREEN.width / 2);
    const screenCenterY = Math.floor(SCREEN.height / 2);

    const modalX = screenCenterX - Math.floor(this.modalWidth / 2);

    // Title height estimation (16px font line height ~20px)
    const titleHeight = 24;

    // Calculate message block height
    const lineHeight = 16; // 12px font with line spacing
    const messageLines = this.wrapText(renderer, message, this.modalWidth - 2 * this.padding);
    const messageHeight = messageLines.length * lineHeight;

    // Total modal height
    const contentHeight = this.padding + messageHeight + this.padding + this.buttonHeight + this.footerSpacing;
    const totalHeight = this.headerHeight + contentHeight;

    const modalY = screenCenterY - Math.floor(totalHeight / 2);

    this.layout = {
      box: {
        x: modalX,
        y: modalY,
        width: this.modalWidth,
        height: totalHeight,
      },
      header: {
        x: modalX,
        y: modalY,
        width: this.modalWidth,
        height: this.headerHeight,
      },
      title: {
        x: modalX + this.titleMarginLeft,
        y: modalY + Math.floor((this.headerHeight - 16) / 2) + 2, // Vertically centered with 16px font
      },
      message: {
        x: modalX + this.padding,
        y: modalY + this.headerHeight + this.padding,
        width: this.modalWidth - 2 * this.padding,
        height: messageHeight,
        lineHeight: lineHeight,
      },
      closeButton: {
        x: modalX + this.modalWidth - this.closeButtonSize - 5,
        y: modalY + 5,
        width: this.closeButtonSize,
        height: this.closeButtonSize,
      },
      cancelBtn: {
        x: modalX + Math.floor(this.modalWidth / 2) - this.buttonWidth - this.footerSpacing / 2,
        y: modalY + this.headerHeight + contentHeight - this.buttonHeight - this.footerSpacing,
        width: this.buttonWidth,
        height: this.buttonHeight,
      },
      confirmBtn: {
        x: modalX + Math.floor(this.modalWidth / 2) + this.footerSpacing / 2,
        y: modalY + this.headerHeight + contentHeight - this.buttonHeight - this.footerSpacing,
        width: this.buttonWidth,
        height: this.buttonHeight,
      },
    };
  }

  /**
   * Draws the modal background (white rectangle with rounded corners).
   */
  private drawBackground(renderer: CanvasRenderer): void {
    if (!this.layout) return;
    renderer.rect(
      this.layout.box.x,
      this.layout.box.y,
      this.layout.box.width,
      this.layout.box.height,
      this.backgroundColor,
      this.borderRadius
    );
  }

  /**
   * Draws the border around the modal (2px black, rounded corners).
   * Uses stroke to create an outline effect.
   */
  private drawBorder(renderer: CanvasRenderer): void {
    if (!this.layout) return;
    const { box } = this.layout;
    renderer.ctx.save();
    renderer.ctx.beginPath();
    if (renderer.ctx.roundRect) {
      renderer.ctx.roundRect(box.x, box.y, box.width, box.height, this.borderRadius);
    } else {
      // Fallback for older browsers: manual roundRect
      this.roundRectPath(renderer.ctx, box.x, box.y, box.width, box.height, this.borderRadius);
    }
    renderer.ctx.lineWidth = this.borderWidth;
    renderer.ctx.strokeStyle = this.borderColor;
    renderer.ctx.stroke();
    renderer.ctx.restore();
  }

  /**
   * Helper to create a rounded rectangle path (for stroking).
   * Mirrors the roundRect logic in CanvasRenderer.
   */
  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Draws the title text in the header area.
   * The modal background is already drawn; this simply adds the title label.
   */
  private drawHeader(renderer: CanvasRenderer, strings: LocalizedStrings): void {
    if (!this.layout) return;

    const { title } = this.layout;

    // Title text (localized "Reset")
    renderer.text(
      strings.reset,
      title.x,
      title.y,
      this.titleFont,
      this.titleTextColor,
      'left',
      'top'
    );
  }

  /**
   * Draws the confirmation message text, wrapping as needed.
   */
  private drawMessage(renderer: CanvasRenderer, message: string): void {
    if (!this.layout) return;

    const { message: msgLayout } = this.layout;
    const lines = this.wrapText(renderer, message, msgLayout.width);

    lines.forEach((line, index) => {
      renderer.text(
        line,
        msgLayout.x,
        msgLayout.y + index * msgLayout.lineHeight,
        this.messageFont,
        this.messageTextColor,
        'left',
        'top'
      );
    });
  }

  /**
   * Draws the close button (X) in the top-right corner.
   * A simple X shape or a small button-like element.
   */
  private drawCloseButton(renderer: CanvasRenderer): void {
    if (!this.layout) return;

    const { closeButton } = this.layout;

    // Draw a small X button with light background
    renderer.rect(
      closeButton.x,
      closeButton.y,
      closeButton.width,
      closeButton.height,
      COLORS.boxBackground,
      3
    );

    // Draw X symbol
    const cx = closeButton.x + closeButton.width / 2;
    const cy = closeButton.y + closeButton.height / 2;
    const size = closeButton.width / 3;

    renderer.ctx.strokeStyle = this.closeButtonColor;
    renderer.ctx.lineWidth = 2;
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(cx - size, cy - size);
    renderer.ctx.lineTo(cx + size, cy + size);
    renderer.ctx.moveTo(cx + size, cy - size);
    renderer.ctx.lineTo(cx - size, cy + size);
    renderer.ctx.stroke();
  }

  /**
   * Draws the footer buttons (Cancel and Reset).
   */
  private drawFooterButtons(renderer: CanvasRenderer, strings: LocalizedStrings): void {
    if (!this.layout) return;

    const { cancelBtn, confirmBtn } = this.layout;

    // Cancel button - green
    this.drawButton(renderer, cancelBtn, strings.cancel, COLORS.buttonGreen);

    // Confirm button - red (localized "reset" string)
    this.drawButton(renderer, confirmBtn, strings.reset, COLORS.buttonRed);
  }

  /**
   * Draws a single button with text.
   *
   * @param renderer - Canvas renderer
   * @param bounds - Button position and size
   * @param text - Button label
   * @param bgColor - Normal background color
   * @param pressedColor - Background when pressed (optional, not used for static render)
   */
  private drawButton(
    renderer: CanvasRenderer,
    bounds: { x: number; y: number; width: number; height: number },
    text: string,
    bgColor: string,
    pressedColor?: string
  ): void {
    // Button background with radius
    renderer.rect(bounds.x, bounds.y, bounds.width, bounds.height, bgColor, 4);

    // Button text - centered
    renderer.text(
      text,
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      '12px Montserrat',
      COLORS.textWhite,
      'center',
      'middle'
    );
  }

  /**
   * Wraps text to fit within a given width.
   *
   * @param renderer - Canvas renderer for measuring text
   * @param text - Input text (may contain newlines)
   * @param maxWidth - Maximum line width in pixels
   * @returns Array of lines
   */
  private wrapText(renderer: CanvasRenderer, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = renderer.measureText(testLine, this.messageFont);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  }

  /**
   * Returns the computed layout (useful for hit testing).
   */
  public getLayout(): ResetWifiModalLayout | null {
    return this.layout;
  }

  /**
   * Checks if a point (x, y) is within the Cancel button bounds.
   * Useful for event handling.
   */
  public isPointInCancelButton(x: number, y: number): boolean {
    if (!this.layout) return false;
    const { cancelBtn } = this.layout;
    return (
      x >= cancelBtn.x &&
      x <= cancelBtn.x + cancelBtn.width &&
      y >= cancelBtn.y &&
      y <= cancelBtn.y + cancelBtn.height
    );
  }

  /**
   * Checks if a point is within the Yes/Reset button bounds.
   */
  public isPointInConfirmButton(x: number, y: number): boolean {
    if (!this.layout) return false;
    const { confirmBtn } = this.layout;
    return (
      x >= confirmBtn.x &&
      x <= confirmBtn.x + confirmBtn.width &&
      y >= confirmBtn.y &&
      y <= confirmBtn.y + confirmBtn.height
    );
  }

  /**
   * Checks if a point is within the close button bounds.
   */
  public isPointInCloseButton(x: number, y: number): boolean {
    if (!this.layout) return false;
    const { closeButton } = this.layout;
    return (
      x >= closeButton.x &&
      x <= closeButton.x + closeButton.width &&
      y >= closeButton.y &&
      y <= closeButton.y + closeButton.height
    );
  }

  /**
   * Checks if a point is within the modal bounds (outside the modal = clicking to dismiss?).
   * Typically, modals don't dismiss on outside click, but the close button and footer buttons are used.
   */
  public isPointInsideModal(x: number, y: number): boolean {
    if (!this.layout) return false;
    const { box } = this.layout;
    return (
      x >= box.x &&
      x <= box.x + box.width &&
      y >= box.y &&
      y <= box.y + box.height
    );
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Handles touch events on the reset WiFi modal.
   *
   * @param x - Touch X coordinate
   * @param y - Touch Y coordinate
   * @param onCancel - Cancel callback
   * @param onConfirm - Confirm/Reset callback
   * @returns true if touch was handled, false otherwise
   */
  public handleTouch(x: number, y: number, onCancel: () => void, onConfirm: () => void): boolean {
    if (!this.layout) return false;

    // Check close button (X)
    if (this.isPointInCloseButton(x, y)) {
      onCancel();
      return true;
    }

    // Check Cancel button
    if (this.isPointInCancelButton(x, y)) {
      onCancel();
      return true;
    }

    // Check Confirm button
    if (this.isPointInConfirmButton(x, y)) {
      onConfirm();
      return true;
    }

    // If touch is inside modal but not on a button, consume it
    if (this.isPointInsideModal(x, y)) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// FACTORY FUNCTION (Optional convenience)
// ============================================================================

/**
 * Creates and renders a Reset WiFi modal in one call.
 *
 * @param renderer - Canvas renderer
 * @param strings - Localized strings
 * @param message - Confirmation message
 * @param onCancel - Cancel callback
 * @param onConfirm - Confirm callback (WiFi reset)
 * @returns The modal instance
 */
export function renderResetWifiModal(
  renderer: CanvasRenderer,
  strings: LocalizedStrings,
  message: string,
  onCancel: () => void,
  onConfirm: () => void
): ResetWifiModal {
  const modal = new ResetWifiModal();
  modal.render(renderer, strings, message, onCancel, onConfirm);
  return modal;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ResetWifiModal;
