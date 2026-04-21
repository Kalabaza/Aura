/**
 * Canvas Renderer for Aura Simulator
 *
 * Provides a 2D canvas-based rendering engine that mirrors the LVGL
 * drawing operations from the actual ESP32 firmware. All coordinates
 * are in pixel space relative to the 240x320 device screen.
 *
 * Usage:
 *   const renderer = new CanvasRenderer(canvasElement);
 *   renderer.clear();
 *   renderer.rect(10, 10, 100, 50, '#4c8cb9');
 *   renderer.text('Hello', 20, 30, '14px Montserrat', '#FFFFFF');
 */

import { SCREEN } from './Constants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Color representation - hex string with optional alpha.
 * Examples: '#FF0000', '#FF000080' (with alpha)
 */
export type Color = string;

/**
 * Font specification for text rendering.
 * Format: '12px Montserrat' or 'bold 14px Arial', etc.
 */
export type Font = string;

/**
 * Text alignment options for drawing text.
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Vertical alignment for text baseline.
 */
export type TextBaseline = 'top' | 'middle' | 'bottom' | 'alphabetic';

/**
 * Rectangle drawing options.
 */
export interface RectOptions {
  fill?: Color;
  stroke?: Color;
  strokeWidth?: number;
  borderRadius?: number;
}

/**
 * Arc drawing options.
 */
export interface ArcOptions {
  color: Color;
  width?: number;
  startAngle?: number;  // degrees, 0 = east, clockwise
  endAngle?: number;    // degrees
}

/**
 * Gradient type specification.
 */
export type GradientDirection = 'vertical' | 'horizontal';

/**
 * Image source - can be a data URL or ImageBitmap.
 */
export type ImageSource = string | ImageBitmap;

// ============================================================================
// CANVAS RENDERER CLASS
// ============================================================================

/**
 * CanvasRenderer - Main rendering class for the Aura simulator.
 *
 * Creates an offscreen canvas matching the device screen dimensions (240x320)
 * and provides drawing primitives that correspond to LVGL drawing operations.
 *
 * The renderer supports optional scaling when rendering to a visible DOM element
 * via the `scale` parameter or `setScale()` method.
 */
export class CanvasRenderer {
  /** The offscreen canvas with native device resolution */
  public readonly canvas: HTMLCanvasElement;

  /** 2D rendering context */
  public readonly ctx: CanvasRenderingContext2D;

  /** Current scale factor for display (1 = native size) */
  private _scale: number;

  /** Device dimensions (native resolution) */
  public readonly width: number;
  public readonly height: number;

  /**
   * Creates a new CanvasRenderer.
   *
   * @param canvas - Optional existing canvas element to use. If not provided,
   *                 a new canvas element will be created.
   * @param scale - Optional scaling factor for display. Default is 1 (native).
   */
  constructor(canvas?: HTMLCanvasElement, scale: number = 1) {
    this.width = SCREEN.width;
    this.height = SCREEN.height;
    this._scale = scale;

    // Use provided canvas or create a new one
    if (canvas) {
      this.canvas = canvas;
    } else {
      this.canvas = document.createElement('canvas');
    }

    // Configure canvas to device resolution
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.imageRendering = 'pixelated'; // Crisp pixel display

    const context = this.canvas.getContext('2d', {
      alpha: false,  // Optimize for no transparency
      willReadFrequently: false,
    });

    if (!context) {
      throw new Error('Failed to create 2D canvas context');
    }

    this.ctx = context;
  }

  // ==========================================================================
  // SCALING
  // ==========================================================================

  /**
   * Get the current display scale factor.
   */
  get scale(): number {
    return this._scale;
  }

  /**
   * Set the display scale factor.
   * Affects the canvas.style.width/height when rendered to DOM.
   */
  setScale(scale: number): void {
    this._scale = scale;
  }

  /**
   * Get the display dimensions (canvas size when rendered to DOM).
   */
  get displayWidth(): number {
    return Math.round(this.width * this._scale);
  }

  get displayHeight(): number {
    return Math.round(this.height * this._scale);
  }

  /**
   * Apply the current scale to the canvas element's style dimensions.
   * Call this when attaching the canvas to the DOM.
   */
  applyScaleToElement(): void {
    this.canvas.style.width = `${this.displayWidth}px`;
    this.canvas.style.height = `${this.displayHeight}px`;
  }

  // ==========================================================================
  // CLEARING
  // ==========================================================================

  /**
   * Clears the entire canvas to transparent black.
   * Use `fill()` to clear with a solid color.
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Fills the entire canvas with a solid color.
   *
   * @param color - Fill color (hex string)
   */
  fill(color: Color): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // ==========================================================================
  // DRAWING PRIMITIVES
  // ==========================================================================

  /**
   * Draws a filled rectangle.
   *
   * @param x - Left coordinate
   * @param y - Top coordinate
   * @param w - Width
   * @param h - Height
   * @param color - Fill color (hex string)
   * @param borderRadius - Optional corner radius (default 0)
   */
  rect(x: number, y: number, w: number, h: number, color: Color, borderRadius: number = 0): void {
    this.ctx.fillStyle = color;

    if (borderRadius > 0) {
      this.roundRect(x, y, w, h, borderRadius);
    } else {
      this.ctx.fillRect(x, y, w, h);
    }
  }

  /**
   * Internal helper for drawing rounded rectangles.
   * Uses canvas roundRect() if available, otherwise falls back to manual path.
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    if (this.ctx.roundRect) {
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, w, h, r);
      this.ctx.fill();
    } else {
      // Fallback for older browsers
      this.ctx.beginPath();
      this.ctx.moveTo(x + r, y);
      this.ctx.lineTo(x + w - r, y);
      this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      this.ctx.lineTo(x + w, y + h - r);
      this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.ctx.lineTo(x + r, y + h);
      this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      this.ctx.lineTo(x, y + r);
      this.ctx.quadraticCurveTo(x, y, x + r, y);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  /**
   * Draws text on the canvas.
   *
   * @param text - The string to draw
   * @param x - X coordinate (left, center, or right based on align)
   * @param y - Y coordinate (top, middle, or bottom based on baseline)
   * @param font - Font specification (e.g., '14px Montserrat')
   * @param color - Text color (hex string)
   * @param align - Horizontal alignment (default 'left')
   * @param baseline - Vertical alignment (default 'top')
   */
  text(
    text: string,
    x: number,
    y: number,
    font: Font,
    color: Color,
    align: TextAlign = 'left',
    baseline: TextBaseline = 'top'
  ): void {
    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  }

  /**
   * Measures the width of a text string with the given font.
   *
   * @param text - Text to measure
   * @param font - Font specification
   * @returns Width in pixels
   */
  measureText(text: string, font: Font): number {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  }

  /**
   * Draws an image from a source.
   *
   * @param src - Image source (data URL string or ImageBitmap)
   * @param x - Destination X coordinate
   * @param y - Destination Y coordinate
   * @param w - Destination width
   * @param h - Destination height
   *
   * Note: If src is a string (data URL), it will be loaded asynchronously.
   * For best performance, pre-load images as ImageBitmap objects.
   */
  async image(src: ImageSource, x: number, y: number, w: number, h: number): Promise<void> {
    let img: ImageBitmap | HTMLImageElement;

    if (src instanceof ImageBitmap) {
      img = src;
    } else if (typeof src === 'string') {
      // Load image from data URL (async)
      img = await this.loadImage(src);
    } else {
      throw new Error('Invalid image source');
    }

    this.ctx.drawImage(img, x, y, w, h);
  }

  /**
   * Synchronous image draw - use only with already-loaded ImageBitmap.
   * This is the fast path for pre-loaded images.
   */
  imageSync(img: ImageBitmap, x: number, y: number, w: number, h: number): void {
    this.ctx.drawImage(img, x, y, w, h);
  }

  /**
   * Helper to load an image from a data URL asynchronously.
   */
  private loadImage(src: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        createImageBitmap(img)
          .then(resolve)
          .catch(reject);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Draws an arc (partial circle).
   *
   * @param cx - Center X coordinate
   * @param cy - Center Y coordinate
   * @param r - Radius
   * @param startAngle - Start angle in degrees (0 = east, clockwise)
   * @param endAngle - End angle in degrees
   * @param color - Stroke color (hex string)
   * @param width - Line width (default 1)
   *
   * Note: Unlike fillArc, this draws only the arc outline.
   */
  arc(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
    color: Color,
    width: number = 1
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'butt';

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, this.degToRad(startAngle), this.degToRad(endAngle));
    this.ctx.stroke();
  }

  /**
   * Converts degrees to radians for canvas arc operations.
   * Canvas uses radians with 0 at east (3 o'clock), increasing clockwise.
   */
  private degToRad(degrees: number): number {
    return (degrees - 90) * (Math.PI / 180);  // Adjust so 0 = north like LVGL
  }

  /**
   * Draws a vertical gradient fill.
   *
   * @param x - Left coordinate
   * @param y - Top coordinate
   * @param w - Width
   * @param h - Height
   * @param colorTop - Color at the top
   * @param colorBottom - Color at the bottom
   */
  gradient(
    x: number,
    y: number,
    w: number,
    h: number,
    colorTop: Color,
    colorBottom: Color
  ): void {
    const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, colorTop);
    gradient.addColorStop(1, colorBottom);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, w, h);
  }

  // ==========================================================================
  // ADVANCED OPERATIONS
  // ==========================================================================

  /**
   * Saves the current canvas state (transform, clipping region, etc.).
   * Paired with restore() for temporary transformations.
   */
  save(): void {
    this.ctx.save();
  }

  /**
   * Restores the canvas state from a previous save().
   */
  restore(): void {
    this.ctx.restore();
  }

  /**
   * Sets the global alpha (transparency) for subsequent drawing operations.
   *
   * @param alpha - Value between 0 (fully transparent) and 1 (fully opaque)
   */
  setAlpha(alpha: number): void {
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  }

  /**
   * Clips drawing to a rectangle region.
   * All subsequent drawing operations will be restricted to this area
   * until restore() is called.
   *
   * @param x - Left coordinate of clip region
   * @param y - Top coordinate of clip region
   * @param w - Width of clip region
   * @param h - Height of clip region
   */
  clipRect(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  /**
   * Clears the clipping region (restores to previous state).
   * Equivalent to calling restore() if save() was called before clipping.
   */
  unclip(): void {
    this.restore();
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Gets the canvas as a data URL (PNG format).
   *
   * @returns Data URL string representing the current canvas contents
   */
  toDataURL(): string {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Gets the canvas as a Blob for further processing.
   *
   * @param type - Image MIME type (default 'image/png')
   * @param quality - Quality parameter for lossy formats (0-1)
   * @returns Promise resolving to Blob
   */
  toBlob(type?: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        type,
        quality
      );
    });
  }

  /**
   * Draws a filled circle.
   * Convenience method not explicitly required but useful for the project.
   *
   * @param cx - Center X
   * @param cy - Center Y
   * @param r - Radius
   * @param color - Fill color
   */
  circle(cx: number, cy: number, r: number, color: Color): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Draws a line.
   *
   * @param x1 - Start X
   * @param y1 - Start Y
   * @param x2 - End X
   * @param y2 - End Y
   * @param color - Line color
   * @param width - Line width
   */
  line(x1: number, y1: number, x2: number, y2: number, color: Color, width: number = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  /**
   * Draws a multi-segment polyline.
   *
   * @param points - Array of [x, y] coordinate pairs
   * @param color - Line color
   * @param width - Line width
   * @param close - If true, closes the path (becomes polygon)
   */
  polyline(points: [number, number][], color: Color, width: number = 1, close: boolean = false): void {
    if (points.length < 2) return;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i][0], points[i][1]);
    }

    if (close) {
      this.ctx.closePath();
    }
    this.ctx.stroke();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CanvasRenderer;
