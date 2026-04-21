/**
 * Layout Engine for Aura Simulator
 *
 * Translates LVGL alignment concepts to absolute pixel coordinates.
 * Provides anchor-based positioning system that mirrors LVGL's lv_obj_align() API.
 *
 * Usage:
 *   const layout = new LayoutEngine();
 *   layout.registerItem('icon', 10, 28, 100, 100);
 *   const pos = layout.alignTo('icon', 'OUT_RIGHT_MID', 10, -12);
 *   // pos = { x: 120, y: 74 } (centered vertically, to the right of icon)
 */

import { SCREEN } from './Constants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Alignment types that mirror LVGL's lv_align_t constants.
 * These specify where to position an item relative to a target's bounding box.
 *
 * Coordinate system: (0,0) = top-left, x increases right, y increases down.
 *
 * For non-OUT alignments: item is positioned inside/overlapping the target.
 * For OUT_* alignments: item is positioned completely outside the target.
 */
export type Alignment =
  // Top edge alignments
  | 'TOP_LEFT' | 'TOP_MID' | 'TOP_RIGHT'
  // Bottom edge alignments
  | 'BOTTOM_LEFT' | 'BOTTOM_MID' | 'BOTTOM_RIGHT'
  // Left edge alignments
  | 'LEFT_TOP' | 'LEFT_MID' | 'LEFT_BOTTOM'
  // Right edge alignments
  | 'RIGHT_TOP' | 'RIGHT_MID' | 'RIGHT_BOTTOM'
  // Center alignment
  | 'CENTER'
  // Outside top edge
  | 'OUT_TOP_LEFT' | 'OUT_TOP_MID' | 'OUT_TOP_RIGHT'
  // Outside bottom edge
  | 'OUT_BOTTOM_LEFT' | 'OUT_BOTTOM_MID' | 'OUT_BOTTOM_RIGHT'
  // Outside left edge
  | 'OUT_LEFT_TOP' | 'OUT_LEFT_MID' | 'OUT_LEFT_BOTTOM'
  // Outside right edge
  | 'OUT_RIGHT_TOP' | 'OUT_RIGHT_MID' | 'OUT_RIGHT_BOTTOM';

/**
 * Bounding box rectangle.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Layout item with position and optional dimensions.
 */
export interface LayoutItem {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// ============================================================================
// LAYOUT ENGINE CLASS
// ============================================================================

/**
 * LayoutEngine - Manages item layout using LVGL-style alignment.
 *
 * The engine maintains a registry of items by unique ID and computes
 * absolute positions using LVGL alignment rules.
 *
 * Key concepts:
 * - Items are positioned relative to a target item's bounding box
 * - Alignment determines which point on the target and item are matched
 * - Offsets (offsetX, offsetY) provide fine-tuning after alignment
 * - For OUT_* alignments, the item is placed outside the target's bounds
 */
export class LayoutEngine {
  /** Registry of layout items by ID */
  private items: Map<string, LayoutItem>;

  /** Screen bounds for boundary validation (optional) */
  private readonly screenBounds: Rect;

  /**
   * Creates a new LayoutEngine.
   *
   * @param screenWidth - Optional screen width (default from Constants.SCREEN.width)
   * @param screenHeight - Optional screen height (default from Constants.SCREEN.height)
   */
  constructor(screenWidth?: number, screenHeight?: number) {
    this.items = new Map();
    this.screenBounds = {
      x: 0,
      y: 0,
      width: screenWidth ?? SCREEN.width,
      height: screenHeight ?? SCREEN.height,
    };
  }

  // ==========================================================================
  // REGISTRATION METHODS
  // ==========================================================================

  /**
   * Registers or updates an item in the layout system.
   *
   * @param id - Unique identifier for the item
   * @param x - X coordinate (pixels from left). If not provided, defaults to 0.
   * @param y - Y coordinate (pixels from top). If not provided, defaults to 0.
   * @param width - Optional width in pixels (needed if other items will align to this one)
   * @param height - Optional height in pixels (needed if other items will align to this one)
   *
   * @returns The registered LayoutItem (for chaining if needed)
   */
  registerItem(
    id: string,
    x: number = 0,
    y: number = 0,
    width?: number,
    height?: number
  ): LayoutItem {
    const item: LayoutItem = { x, y };
    if (width !== undefined) item.width = width;
    if (height !== undefined) item.height = height;
    this.items.set(id, item);
    return item;
  }

  /**
   * Registers an item with an explicit LayoutItem object.
   * Useful for items that have already been computed.
   *
   * @param id - Unique identifier
   * @param item - LayoutItem to register
   */
  registerItemExplicit(id: string, item: LayoutItem): void {
    this.items.set(id, { ...item });
  }

  /**
   * Retrieves the bounding box of a registered item.
   * If width/height are not set, they default to 0.
   *
   * @param id - Item identifier
   * @returns Rect with x, y, width, height, or null if not found
   */
  getItemRect(id: string): Rect | null {
    const item = this.items.get(id);
    if (!item) return null;

    return {
      x: item.x,
      y: item.y,
      width: item.width ?? 0,
      height: item.height ?? 0,
    };
  }

  /**
   * Gets the raw layout item (including optional width/height).
   * Use when you need to distinguish between "width not set" vs "width = 0".
   *
   * @param id - Item identifier
   * @returns LayoutItem or null if not found
   */
  getItem(id: string): LayoutItem | null {
    return this.items.get(id) ?? null;
  }

  /**
   * Checks if an item exists in the registry.
   *
   * @param id - Item identifier
   * @returns true if registered
   */
  hasItem(id: string): boolean {
    return this.items.has(id);
  }

  // ==========================================================================
  // ALIGNMENT CALCULATION
  // ==========================================================================

  /**
   * Computes the absolute position for aligning an item to a target.
   *
   * LVGL alignment concept: Match an "anchor point" on the item to a
   * corresponding anchor point on the target, then apply offsets.
   *
   * For regular alignments (TOP_LEFT, CENTER, etc.):
   *   - Anchor points are on the edges or center of the rectangles
   *   - The item may overlap the target
   *
   * For OUT_* alignments:
   *   - Anchor points are just outside the target's bounds
   *   - The item is placed completely outside the target
   *
   * @param targetId - ID of the target item to align to
   * @param alignment - LVGL alignment constant (e.g., 'OUT_RIGHT_MID')
   * @param offsetX - Horizontal pixel offset after alignment (default 0)
   * @param offsetY - Vertical pixel offset after alignment (default 0)
   *
   * @returns {x, y} absolute coordinates for the item's top-left corner
   *
   * @throws Error if targetId is not registered
   */
  alignTo(
    targetId: string,
    alignment: Alignment,
    offsetX: number = 0,
    offsetY: number = 0
  ): { x: number; y: number } {
    const targetRect = this.getItemRect(targetId);
    if (!targetRect) {
      throw new Error(`LayoutEngine: Target item '${targetId}' not found`);
    }

    // Compute anchor points
    const { x: targetAnchorX, y: targetAnchorY } = this.computeTargetAnchor(targetRect, alignment);
    const itemAnchorX = this.computeItemAnchorX(alignment);
    const itemAnchorY = this.computeItemAnchorY(alignment);

    // Position = target_anchor - item_anchor + offset
    const x = targetAnchorX - itemAnchorX + offsetX;
    const y = targetAnchorY - itemAnchorY + offsetY;

    return { x, y };
  }

  /**
   * Computes where an item would be positioned without actually registering it.
   * Useful for querying layout before creating items.
   *
   * @param targetId - Target item ID
   * @param alignment - Alignment type
   * @param offsetX - Horizontal offset
   * @param offsetY - Vertical offset
   * @param itemWidth - Width of the item to be positioned (default 0)
   * @param itemHeight - Height of the item to be positioned (default 0)
   *
   * @returns Computed {x, y} position
   */
  computePosition(
    targetId: string,
    alignment: Alignment,
    offsetX: number = 0,
    offsetY: number = 0,
    itemWidth: number = 0,
    itemHeight: number = 0
  ): { x: number; y: number } {
    const targetRect = this.getItemRect(targetId);
    if (!targetRect) {
      throw new Error(`LayoutEngine: Target item '${targetId}' not found`);
    }

    const { x: targetAnchorX, y: targetAnchorY } = this.computeTargetAnchor(targetRect, alignment);
    const itemAnchorX = this.computeItemAnchorX(alignment, itemWidth);
    const itemAnchorY = this.computeItemAnchorY(alignment, itemHeight);

    return {
      x: targetAnchorX - itemAnchorX + offsetX,
      y: targetAnchorY - itemAnchorY + offsetY,
    };
  }

  /**
   * Computes the anchor point on the target for the given alignment.
   * For OUT_* alignments, anchor is outside the target bounds.
   * For regular alignments, anchor is on or inside the target bounds.
   */
  private computeTargetAnchor(target: Rect, alignment: Alignment): { x: number; y: number } {
    const { x, y, width, height } = target;
    const halfW = width / 2;
    const halfH = height / 2;

    const isOut = alignment.startsWith('OUT_');
    const base = alignment.replace(/^OUT_/, '') as Alignment;
    const factor = isOut ? 1 : 0;

    let targetX: number;
    let targetY: number;

    switch (base) {
      case 'TOP_LEFT':
        targetX = x - factor * halfW;
        targetY = y - factor * halfH;
        break;
      case 'TOP_MID':
        targetX = x + halfW;
        targetY = y - factor * halfH;
        break;
      case 'TOP_RIGHT':
        targetX = x + width + factor * halfW;
        targetY = y - factor * halfH;
        break;

      case 'BOTTOM_LEFT':
        targetX = x - factor * halfW;
        targetY = y + height + factor * halfH;
        break;
      case 'BOTTOM_MID':
        targetX = x + halfW;
        targetY = y + height + factor * halfH;
        break;
      case 'BOTTOM_RIGHT':
        targetX = x + width + factor * halfW;
        targetY = y + height + factor * halfH;
        break;

      case 'LEFT_TOP':
        targetX = x - factor * halfW;
        targetY = y - factor * halfH;
        break;
      case 'LEFT_MID':
        targetX = x - factor * halfW;
        targetY = y + halfH;
        break;
      case 'LEFT_BOTTOM':
        targetX = x - factor * halfW;
        targetY = y + height + factor * halfH;
        break;

      case 'RIGHT_TOP':
        targetX = x + width + factor * halfW;
        targetY = y - factor * halfH;
        break;
      case 'RIGHT_MID':
        targetX = x + width + factor * halfW;
        targetY = y + halfH;
        break;
      case 'RIGHT_BOTTOM':
        targetX = x + width + factor * halfW;
        targetY = y + height + factor * halfH;
        break;

      case 'CENTER':
        targetX = x + halfW;
        targetY = y + halfH;
        break;

      default:
        // Should never happen if type is correct
        targetX = x;
        targetY = y;
        break;
    }

    return { x: targetX, y: targetY };
  }

  /**
   * Computes the anchor point on the item for the given alignment.
   * This determines which point of the item will be placed at the target anchor.
   */
  private computeItemAnchorX(alignment: Alignment, itemWidth: number = 0): number {
    const halfW = itemWidth / 2;

    // For OUT_* variants where item is outside on left/right, anchor depends on direction
    if (alignment.endsWith('_LEFT')) {
      return 0;  // Item's left edge
    }
    if (alignment.endsWith('_RIGHT')) {
      return itemWidth;  // Item's right edge
    }
    if (alignment.endsWith('_MID') || alignment === 'CENTER') {
      return halfW;  // Item's horizontal center
    }

    // Default (shouldn't happen for valid alignments)
    return 0;
  }

  private computeItemAnchorY(alignment: Alignment, itemHeight: number = 0): number {
    const halfH = itemHeight / 2;

    // For OUT_* variants where item is outside on top/bottom, anchor depends on direction
    if (alignment.startsWith('OUT_TOP') || alignment.endsWith('_TOP')) {
      return 0;  // Item's top edge
    }
    if (alignment.startsWith('OUT_BOTTOM') || alignment.endsWith('_BOTTOM')) {
      return itemHeight;  // Item's bottom edge
    }
    if (alignment.endsWith('_MID') || alignment === 'CENTER') {
      return halfH;  // Item's vertical center
    }

    // For things like LEFT_TOP, RIGHT_TOP without OUT, the _TOP means item's top
    if (alignment.includes('_TOP')) {
      return 0;
    }

    // Default
    return 0;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Clears all registered items from the layout system.
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Removes a specific item from the registry.
   *
   * @param id - Item ID to remove
   * @returns true if the item was removed, false if not found
   */
  removeItem(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * Updates an item's position without changing its dimensions.
   * Useful for repositioning items that are already registered.
   *
   * @param id - Item ID
   * @param x - New x coordinate
   * @param y - New y coordinate
   * @throws Error if item not found
   */
  updatePosition(id: string, x: number, y: number): void {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`LayoutEngine: Item '${id}' not found`);
    }
    item.x = x;
    item.y = y;
  }

  /**
   * Updates an item's dimensions without changing position.
   *
   * @param id - Item ID
   * @param width - New width (or undefined to clear)
   * @param height - New height (or undefined to clear)
   * @throws Error if item not found
   */
  updateDimensions(id: string, width?: number, height?: number): void {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`LayoutEngine: Item '${id}' not found`);
    }
    if (width !== undefined) item.width = width;
    if (height !== undefined) item.height = height;
  }

  /**
   * Gets all registered item IDs.
   *
   * @returns Array of item IDs
   */
  getItemIds(): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * Returns the current screen bounds.
   */
  getScreenBounds(): Rect {
    return { ...this.screenBounds };
  }

  /**
   * Performs a simple boundary check to see if a rectangle is within screen.
   * Useful for debugging layout issues.
   *
   * @param rect - Rectangle to check
   * @returns true if fully or partially within screen bounds
   */
  isVisibleInScreen(rect: Rect): boolean {
    const { x, y, width, height } = rect;
    const screen = this.screenBounds;

    return !(
      x + width < screen.x ||
      x > screen.x + screen.width ||
      y + height < screen.y ||
      y > screen.y + screen.height
    );
  }

  // ==========================================================================
  // CHAINING API (Optional convenience methods)
  // ==========================================================================

  /**
   * Registers an item and returns the LayoutEngine for chaining.
   *
   * @param id - Item ID
   * @param x - X position
   * @param y - Y position
   * @param width - Optional width
   * @param height - Optional height
   */
  add(id: string, x: number = 0, y: number = 0, width?: number, height?: number): this {
    this.registerItem(id, x, y, width, height);
    return this;
  }

  /**
   * Aligns an item to a target and optionally registers it with the computed position.
   * If itemId is provided, the item will be registered after alignment.
   *
   * @param targetId - Target to align to
   * @param alignment - Alignment type
   * @param itemId - If provided, register a new item at computed position
   * @param itemWidth - Width for the new item (if registering)
   * @param itemHeight - Height for the new item (if registering)
   * @param offsetX - Horizontal offset
   * @param offsetY - Vertical offset
   *
   * @returns Computed position (and registers item if itemId provided)
   */
  align(
    targetId: string,
    alignment: Alignment,
    itemId?: string,
    itemWidth?: number,
    itemHeight?: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): { x: number; y: number } {
    const pos = this.computePosition(
      targetId,
      alignment,
      offsetX,
      offsetY,
      itemWidth ?? 0,
      itemHeight ?? 0
    );

    if (itemId) {
      this.registerItem(itemId, pos.x, pos.y, itemWidth, itemHeight);
    }

    return pos;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parses an alignment string that may include the LV_ALIGN_ prefix.
 * Strips the prefix if present and returns the clean alignment constant.
 *
 * @param alignment - Alignment string (e.g., 'LV_ALIGN_TOP_LEFT' or 'TOP_LEFT')
 * @returns Clean alignment constant (e.g., 'TOP_LEFT')
 */
export function normalizeAlignment(alignment: string): Alignment {
  return alignment.replace(/^LV_ALIGN_/, '') as Alignment;
}

/**
 * Checks if an alignment is an "OUT" variant (positions outside the target).
 *
 * @param alignment - Alignment to check
 * @returns true if it's an OUT_* alignment
 */
export function isOutAlignment(alignment: string): boolean {
  return alignment.startsWith('OUT_') || alignment.startsWith('LV_ALIGN_OUT_');
}

/**
 * Gets the opposite alignment (useful for bidirectional layouts).
 * E.g., TOP_LEFT -> BOTTOM_RIGHT, OUT_RIGHT_MID -> OUT_LEFT_MID
 *
 * @param alignment - Source alignment
 * @returns Opposite alignment
 */
export function oppositeAlignment(alignment: Alignment): Alignment {
  const withoutOut = alignment.replace(/^OUT_/, '');
  const oppositeMap: Record<string, Alignment> = {
    TOP_LEFT: 'BOTTOM_RIGHT',
    TOP_MID: 'BOTTOM_MID',
    TOP_RIGHT: 'BOTTOM_LEFT',
    BOTTOM_LEFT: 'TOP_RIGHT',
    BOTTOM_MID: 'TOP_MID',
    BOTTOM_RIGHT: 'TOP_LEFT',
    LEFT_TOP: 'RIGHT_BOTTOM',
    LEFT_MID: 'RIGHT_MID',
    LEFT_BOTTOM: 'RIGHT_TOP',
    RIGHT_TOP: 'LEFT_BOTTOM',
    RIGHT_MID: 'LEFT_MID',
    RIGHT_BOTTOM: 'LEFT_TOP',
    CENTER: 'CENTER',
  };

  const opposite = oppositeMap[withoutOut];
  if (!opposite) return alignment; // Return as-is if unknown

  // Preserve OUT_ prefix if present
  return alignment.startsWith('OUT_') ? opposite : opposite;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default LayoutEngine;
