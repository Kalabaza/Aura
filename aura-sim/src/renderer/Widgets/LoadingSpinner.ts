/**
 * LoadingSpinner Widget
 *
 * A rotating spinner with a message, used for loading screens.
 * Matches the implementation in aura/aura.ino show_loading_screen().
 *
 * Features:
 * - Vertical gradient background
 * - Rotating 90° arc indicator with static background ring
 * - Configurable message text
 * - Smooth animation at ~60fps using requestAnimationFrame
 */

import { CanvasRenderer } from '../CanvasRenderer';
import { LOADING_SCREEN, SCREEN, COLORS } from '../Constants';

/**
 * Configuration interface for LoadingSpinner.
 * Uses constants from LOADING_SCREEN for exact values.
 */
export interface LoadingSpinnerConfig {
  /** Background gradient colors */
  backgroundTop: string;
  backgroundBottom: string;
  /** Spinner arc configuration */
  spinnerSize: { width: number; height: number };
  spinnerPosition: { x: number; y: number }; // offset from center
  indicatorColor: string;
  bgColor: string;
  lineWidth: number;
  arcAngle: number; // indicator arc length in degrees
  bgArcAngle: number; // background ring (360 for full circle)
  rotationSpeed: number; // degrees per frame
  rotationInterval: number; // ms between frames (for reference)
  /** Message configuration */
  messageFont: { size: number; weight: number; family: string };
  messageColor: string;
  messagePosition: { x: number; y: number }; // offset from center
}

/**
 * LoadingSpinner class
 *
 * Renders a loading spinner with rotating arc and message.
 * The spinner is centered on the screen with configurable offsets.
 *
 * Usage:
 *   const spinner = new LoadingSpinner(renderer, 'Loading...');
 *   spinner.start();
 *   // ... later
 *   spinner.updateMessage('Fetching data...');
 *   spinner.stop();
 */
export class LoadingSpinner {
  private renderer: CanvasRenderer;
  private message: string;
  private config: LoadingSpinnerConfig;

  // Animation state
  private angle: number = 0; // current rotation angle in degrees (0-359)
  private animationFrameId: number | null = null;
  private isAnimating: boolean = false;

  // Computed center position
  private centerX: number;
  private centerY: number;

  /**
   * Creates a new LoadingSpinner.
   *
   * @param renderer - The CanvasRenderer to draw on
   * @param message - Initial message text to display
   * @param config - Optional custom configuration (uses defaults from Constants if omitted)
   */
  constructor(renderer: CanvasRenderer, message: string, config?: Partial<LoadingSpinnerConfig>) {
    this.renderer = renderer;
    this.message = message;

    // Merge custom config with defaults from Constants
    this.config = {
      backgroundTop: LOADING_SCREEN.background.top,
      backgroundBottom: LOADING_SCREEN.background.bottom,
      spinnerSize: LOADING_SCREEN.spinner.size,
      spinnerPosition: LOADING_SCREEN.spinner.position,
      indicatorColor: LOADING_SCREEN.spinner.indicatorColor,
      bgColor: LOADING_SCREEN.spinner.bgColor,
      lineWidth: LOADING_SCREEN.spinner.lineWidth,
      arcAngle: LOADING_SCREEN.spinner.arcAngle,
      bgArcAngle: LOADING_SCREEN.spinner.bgArcAngle,
      rotationSpeed: LOADING_SCREEN.spinner.rotationSpeed,
      rotationInterval: LOADING_SCREEN.spinner.rotationInterval,
      messageFont: {
        size: LOADING_SCREEN.message.font.size,
        weight: LOADING_SCREEN.message.font.weight,
        family: LOADING_SCREEN.message.font.family,
      },
      messageColor: LOADING_SCREEN.message.color,
      messagePosition: LOADING_SCREEN.message.position,
      ...config,
    };

    // Compute center of screen
    this.centerX = Math.floor(SCREEN.width / 2);
    this.centerY = Math.floor(SCREEN.height / 2);
  }

  /**
   * Starts the rotation animation.
   * Uses requestAnimationFrame for smooth 60fps animation.
   * Does nothing if already animating.
   */
  public start(): void {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.angle = 0; // reset angle

    const animate = (): void => {
      if (!this.isAnimating) return;

      // Update rotation angle
      this.angle = (this.angle + this.config.rotationSpeed) % 360;

      // Render frame
      this.render();

      // Schedule next frame
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Stops the rotation animation.
   * Cancels any pending animation frame.
   * Does nothing if not animating.
   */
  public stop(): void {
    if (!this.isAnimating) return;

    this.isAnimating = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Updates the message text.
   * The new message will appear on the next render.
   *
   * @param newMsg - The new message string
   */
  public updateMessage(newMsg: string): void {
    this.message = newMsg;

    // If currently animating, trigger an immediate render to show update
    if (this.isAnimating) {
      this.render();
    }
  }

  /**
   * Returns the current rotation angle (0-359).
   * Useful for testing or debugging.
   */
  public getCurrentAngle(): number {
    return this.angle;
  }

  /**
   * Returns whether the spinner is currently animating.
   */
  public isRunning(): boolean {
    return this.isAnimating;
  }

  /**
   * Sets the current rotation angle (0-359 degrees).
   * Useful for testing or deterministic rendering.
   * @param angle - The angle in degrees (will be modulo 360)
   */
  public setAngle(angle: number): void {
    this.angle = angle % 360;
  }

  /**
   * Renders the complete loading spinner.
   * Draws:
   * 1. Full-screen gradient background
   * 2. Static background ring (full circle)
   * 3. Rotating indicator arc (90° segment)
   * 4. Message text centered below spinner
   */
  public render(): void {
    const { width, height } = SCREEN;

    // Clear and fill background with gradient
    this.renderer.clear();
    this.renderer.gradient(
      0, 0, width, height,
      this.config.backgroundTop,
      this.config.backgroundBottom
    );

    // Compute spinner center position
    const spinnerCx = this.centerX + this.config.spinnerPosition.x;
    const spinnerCy = this.centerY + this.config.spinnerPosition.y;
    const spinnerRadius = Math.floor(this.config.spinnerSize.width / 2);

    // Draw background ring (static full circle)
    this.renderer.arc(
      spinnerCx,
      spinnerCy,
      spinnerRadius,
      0, // start angle (0° = east/north after degToRad adjustment)
      this.config.bgArcAngle,
      this.config.bgColor,
      this.config.lineWidth
    );

    // Draw rotating indicator arc (90° segment)
    // The arc starts at current angle and extends 90° clockwise
    this.renderer.arc(
      spinnerCx,
      spinnerCy,
      spinnerRadius,
      this.angle,
      this.angle + this.config.arcAngle,
      this.config.indicatorColor,
      this.config.lineWidth
    );

    // Draw message text centered below spinner
    const messageX = this.centerX + this.config.messagePosition.x;
    const messageY = this.centerY + this.config.messagePosition.y;
    const fontStr = `${this.config.messageFont.weight} ${this.config.messageFont.size}px ${this.config.messageFont.family}`;

    this.renderer.text(
      this.message,
      messageX,
      messageY,
      fontStr,
      this.config.messageColor,
      'center',
      'top'
    );
  }

  /**
   * Convenience method: render a single static frame without starting animation.
   * Useful for taking a snapshot or if animation is handled externally.
   *
   * @param angle - Rotation angle for the indicator arc (default: current angle)
   */
  public renderStatic(angle?: number): void {
    const renderAngle = angle !== undefined ? angle : this.angle;

    // Temporarily set angle if provided
    const originalAngle = this.angle;
    if (angle !== undefined) {
      this.angle = renderAngle;
    }

    this.render();

    // Restore original angle if we changed it
    if (angle !== undefined) {
      this.angle = originalAngle;
    }
  }

  /**
   * Resets the spinner to initial state (angle = 0) and stops animation.
   * Useful when preparing to show the spinner again.
   */
  public reset(): void {
    this.stop();
    this.angle = 0;
  }

  /**
   * Destroys the spinner, cancels any animation, and cleans up resources.
   * After calling this, the spinner should not be used.
   */
  public destroy(): void {
    this.stop();
    // No additional cleanup needed as renderer is external
  }
}

export default LoadingSpinner;
