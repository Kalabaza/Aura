/**
 * LocationDialog Widget for Aura Simulator
 *
 * Renders the location search dialog as seen in aura.ino's create_location_dialog().
 * This is a presentational component that draws the full-screen dialog with all
 * interactive elements based on the provided props.
 *
 * Usage:
 *   const dialog = new LocationDialog();
 *   dialog.render(renderer, props);
 *
 * The parent component is responsible for handling user interactions and
 * updating the props accordingly.
 */

import { CanvasRenderer } from '../CanvasRenderer';
import {
  COLORS,
  FONTS,
  SCREEN,
  LOCATION_DIALOG,
} from '../Constants';
import type { LocalizedStrings } from '../../state/LocalizedStrings';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Props for the LocationDialog widget.
 * Mirrors the state and callbacks needed by the location dialog UI.
 */
export interface LocationDialogProps {
  /** Localized strings for current language */
  strings: LocalizedStrings;
  /** Current text in the search textarea */
  query: string;
  /** Cursor position within the query (0 = before first character) */
  cursorPosition: number;
  /** Array of location strings from search results */
  results: string[];
  /** Index of currently selected result, or null if none */
  selectedIndex: number | null;
  /** True while a search operation is in progress */
  isSearching: boolean;
  /** True when the Save button should be enabled (a result is selected) */
  canSave: boolean;
  /** Called when user changes the text query */
  onQueryChange: (query: string) => void;
  /** Called when cursor position changes */
  onCursorChange?: (position: number) => void;
  /** Called when user selects a result from the dropdown (by index) */
  onSelectResult: (index: number) => void;
  /** Called when user clicks the Save button */
  onSave: () => void;
  /** Called when user clicks the Cancel button */
  onCancel: () => void;
  /** Called when the textarea receives focus (touched) */
  onFocus?: () => void;
  /** Whether the textarea is currently focused */
  isFocused?: boolean;
}

// ============================================================================
// LAYOUT HELPER
// ============================================================================

/**
 * Internal layout structure with all computed absolute positions.
 */
interface LocationDialogLayout {
  // Window bounds (full screen)
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  headerHeight: number;

  // Positions
  cityLabel: { x: number; y: number };
  textarea: { x: number; y: number; width: number; height: number };
  resultsLabel: { x: number; y: number };
  dropdown: { x: number; y: number; width: number; height: number };
  cancelButton: { x: number; y: number; width: number; height: number };
  saveButton: { x: number; y: number; width: number; height: number };
}

/**
 * Computes all positions based on constants and screen dimensions.
 * The dialog occupies the full screen (240x320) with internal layout.
 */
function computeLayout(): LocationDialogLayout {
  const windowX = 0;
  const windowY = 0;
  const windowWidth = SCREEN.width;
  const windowHeight = SCREEN.height;
  const headerHeight = LOCATION_DIALOG.window.headerHeight;

  // Font metrics (approximate)
  const labelFontSize = FONTS.size14.size;
  const labelHeight = labelFontSize + 4; // 18px total height for 14px font

  // Content starts below header
  const contentBaseY = windowY + headerHeight;

  // City label: absolute position from top-left of content area
  const cityLabelX = windowX + LOCATION_DIALOG.cityLabel.position.x; // 5
  const cityLabelY = contentBaseY + LOCATION_DIALOG.cityLabel.position.y; // 5

  // Textarea: aligned OUT_BOTTOM_LEFT to city label with offset (0, 4)
  const textareaX = cityLabelX + LOCATION_DIALOG.textarea.position.x; // 0 -> same x as label
  const textareaY = cityLabelY + labelHeight + LOCATION_DIALOG.textarea.position.y; // 4px below label
  const textareaWidth = LOCATION_DIALOG.textarea.width; // 212
  const textareaHeight = 24; // one-line height

  // Results label: aligned OUT_BOTTOM_LEFT to textarea with offset (0, 10)
  const resultsLabelX = textareaX + LOCATION_DIALOG.resultsLabel.alignTo.offsetX; // 0
  const resultsLabelY = textareaY + textareaHeight + LOCATION_DIALOG.resultsLabel.alignTo.offsetY; // 10

  // Dropdown: aligned OUT_BOTTOM_LEFT to results label with offset (0, 4)
  const dropdownX = resultsLabelX + LOCATION_DIALOG.resultsDropdown.alignTo.offsetX; // 0
  const dropdownY = resultsLabelY + labelHeight + LOCATION_DIALOG.resultsDropdown.alignTo.offsetY; // 4
  const dropdownWidth = LOCATION_DIALOG.resultsDropdown.width; // 212
  const itemHeight = 24;
  const maxDropdownHeight = 120;

  // Height calculation: will be filled in later when we have props.results
  // We'll compute final dropdown height in render after we know results count.
  // Here we give a placeholder.
  const dropdownHeight = 0; // placeholder

  // Cancel button: LV_ALIGN_BOTTOM_LEFT, offset (5, -5)
  const cancelButtonWidth = LOCATION_DIALOG.cancelButton.size.width; // 90
  const cancelButtonHeight = LOCATION_DIALOG.cancelButton.size.height; // 36
  const cancelButtonX = windowX + LOCATION_DIALOG.cancelButton.position.x; // 5
  const cancelButtonY =
    windowHeight + LOCATION_DIALOG.cancelButton.position.y - cancelButtonHeight; // 320 -5 -36 = 279

  // Save button: LV_ALIGN_BOTTOM_RIGHT, offset (-5, -5)
  const saveButtonWidth = LOCATION_DIALOG.saveButton.size.width; // 90
  const saveButtonHeight = LOCATION_DIALOG.saveButton.size.height; // 36
  const saveButtonX =
    windowWidth + LOCATION_DIALOG.saveButton.position.x - saveButtonWidth; // 240 -5 -90 = 145
  const saveButtonY =
    windowHeight + LOCATION_DIALOG.saveButton.position.y - saveButtonHeight; // same as cancel

  return {
    windowX,
    windowY,
    windowWidth: windowWidth,
    windowHeight: windowHeight,
    headerHeight,
    cityLabel: { x: cityLabelX, y: cityLabelY },
    textarea: { x: textareaX, y: textareaY, width: textareaWidth, height: textareaHeight },
    resultsLabel: { x: resultsLabelX, y: resultsLabelY },
    dropdown: { x: dropdownX, y: dropdownY, width: dropdownWidth, height: 0 }, // to be computed
    cancelButton: { x: cancelButtonX, y: cancelButtonY, width: cancelButtonWidth, height: cancelButtonHeight },
    saveButton: { x: saveButtonX, y: saveButtonY, width: saveButtonWidth, height: saveButtonHeight },
  };
}

// ============================================================================
// WIDGET CLASS
// ============================================================================

/**
 * LocationDialog widget - renders a modal dialog for searching and selecting
 * a weather location.
 *
 * This widget is stateless; all state is passed via props. It simply renders
 * the UI based on the current props and does not handle user input directly.
 * Event callbacks are provided for the parent to wire up interactions.
 */
export class LocationDialog {
  // Store the last computed layout for hit testing in handleTouch
  private layout: LocationDialogLayout | null = null;

  /**
   * Renders the location dialog to the given renderer.
   *
   * @param renderer - The CanvasRenderer instance to draw on
   * @param props - Dialog state and callbacks
   */
  render(renderer: CanvasRenderer, props: LocationDialogProps): void {
    // Compute base layout
    this.layout = computeLayout();

    // Compute final dropdown height based on results
    const itemHeight = 24;
    const maxDropdownHeight = 120;
    let dropdownHeight = 0;
    if (props.results.length > 0) {
      dropdownHeight = Math.min(props.results.length * itemHeight, maxDropdownHeight);
    } else {
      // Even when empty, show a minimal box
      dropdownHeight = 30;
    }
    this.layout.dropdown = {
      ...this.layout.dropdown,
      height: dropdownHeight,
    };

    // 1. Window background (full screen)
    renderer.fill('#FFFFFF');

    // 2. Header
    this.drawHeader(renderer, this.layout!, props.strings);

    // 3. City label
    this.drawCityLabel(renderer, this.layout!, props.strings);

    // 4. Textarea
    this.drawTextarea(renderer, this.layout!, props.query, props.cursorPosition, props.isFocused, props.strings);

    // 5. Results label
    this.drawResultsLabel(renderer, this.layout!, props.strings);

    // 6. Dropdown
    this.drawDropdown(renderer, this.layout!, props);

    // 7. Buttons
    this.drawButtons(renderer, this.layout!, props);
  }

  // --------------------------------------------------------------------------
  // Drawing Methods
  // --------------------------------------------------------------------------

  private drawHeader(renderer: CanvasRenderer, layout: LocationDialogLayout, strings: LocalizedStrings): void {
    const { windowX, windowY, windowWidth, headerHeight } = layout;

    // Header background (blue gradient top color from theme)
    renderer.rect(windowX, windowY, windowWidth, headerHeight, COLORS.backgroundTop);

    // Header title (centered)
    const title = strings.change_location;
    const font = `${FONTS.size16.size}px ${FONTS.size16.family}`;
    const textX = windowX + windowWidth / 2;
    const textY = windowY + headerHeight / 2;
    renderer.text(title, textX, textY, font, COLORS.textWhite, 'center', 'middle');
  }

  private drawCityLabel(renderer: CanvasRenderer, layout: LocationDialogLayout, strings: LocalizedStrings): void {
    const { cityLabel } = layout;
    const text = strings.city;
    const font = `${FONTS.size14.size}px ${FONTS.size14.family}`;
    renderer.text(text, cityLabel.x, cityLabel.y, font, COLORS.textWhite, 'left', 'top');
  }

  private drawTextarea(renderer: CanvasRenderer, layout: LocationDialogLayout, query: string, cursorPosition: number = 0, isFocused: boolean = false, strings: LocalizedStrings): void {
    const { textarea } = layout;
    const placeholder = strings.city_placeholder;

    // Background (white)
    renderer.rect(textarea.x, textarea.y, textarea.width, textarea.height, '#FFFFFF');
    // Border color: blue when focused, gray otherwise
    const borderColor = isFocused ? '#2196F3' : '#CCCCCC';
    renderer.rect(textarea.x, textarea.y, textarea.width, textarea.height, borderColor, 2);

    // Text content or placeholder
    const font = `${FONTS.size12.size}px ${FONTS.size12.family}`;
    const textY = textarea.y + textarea.height / 2; // vertical center with 'middle' baseline
    const textColor = query ? '#000000' : '#999999';
    const displayText = query || placeholder;
    renderer.text(displayText, textarea.x + 5, textY, font, textColor, 'left', 'middle');

    // Draw cursor if focused
    if (isFocused) {
      // Calculate cursor X position based on cursorPosition
      const textBeforeCursor = query.substring(0, cursorPosition);
      const textWidth = renderer.measureText(textBeforeCursor, font);
      const cursorX = textarea.x + 5 + textWidth;
      const cursorY = textarea.y + textarea.height / 2 - FONTS.size12.size / 2;
      const cursorHeight = FONTS.size12.size;

      // Blinking cursor: toggle every 500ms based on time
      const showCursor = Math.floor(Date.now() / 500) % 2 === 0;

      if (showCursor) {
        renderer.rect(cursorX, cursorY, 2, cursorHeight, '#000000');
      }
    }
  }

  private drawResultsLabel(renderer: CanvasRenderer, layout: LocationDialogLayout, strings: LocalizedStrings): void {
    const { resultsLabel } = layout;
    const text = strings.search_results;
    const font = `${FONTS.size14.size}px ${FONTS.size14.family}`;
    renderer.text(text, resultsLabel.x, resultsLabel.y, font, COLORS.textWhite, 'left', 'top');
  }

  private drawDropdown(
    renderer: CanvasRenderer,
    layout: LocationDialogLayout,
    props: LocationDialogProps
  ): void {
    const { dropdown } = layout;
    const { results, selectedIndex, isSearching } = props;

    // Determine state
    const isEnabled = results.length > 0 && !isSearching;
    const bgColor = isEnabled ? '#FFFFFF' : '#EEEEEE';
    const borderColor = isEnabled ? '#CCCCCC' : '#BBBBBB';

    // Draw dropdown box
    renderer.rect(dropdown.x, dropdown.y, dropdown.width, dropdown.height, bgColor);
    renderer.rect(dropdown.x, dropdown.y, dropdown.width, dropdown.height, borderColor, 1);

    // If not enabled, we may show a placeholder or just leave empty
    if (results.length === 0 && !isSearching) {
      // Optionally draw "No results" placeholder
      const font = `${FONTS.size12.size}px ${FONTS.size12.family}`;
      renderer.text(
        'No results',
        dropdown.x + dropdown.width / 2,
        dropdown.y + dropdown.height / 2,
        font,
        '#888888',
        'center',
        'middle'
      );
    }

    // If enabled, render the list of results
    if (isEnabled && results.length > 0) {
      const font = `${FONTS.size12.size}px ${FONTS.size12.family}`;
      const itemHeight = 24;
      const paddingX = 5;

      // Clip drawing to inside the dropdown to avoid overflow
      renderer.save();
      renderer.clipRect(dropdown.x + 1, dropdown.y + 1, dropdown.width - 2, dropdown.height - 2);

      results.forEach((result, index) => {
        const itemY = dropdown.y + index * itemHeight;
        // Only draw if within visible height
        if (itemY + itemHeight > dropdown.y && itemY < dropdown.y + dropdown.height) {
          // Highlight background if selected
          if (selectedIndex === index) {
            renderer.rect(
              dropdown.x + 2,
              itemY,
              dropdown.width - 4,
              itemHeight,
              '#E3F2FD' // light blue highlight
            );
          }

          // Vertically center text within each 24px item (same as textbox style)
          const itemTextY = itemY + itemHeight / 2;
          renderer.text(
            result,
            dropdown.x + paddingX,
            itemTextY,
            font,
            '#000000',
            'left',
            'top'
          );
        }
      });

      renderer.unclip();
      renderer.restore();
    }
  }

  private drawButtons(
    renderer: CanvasRenderer,
    layout: LocationDialogLayout,
    props: LocationDialogProps
  ): void {
    const { cancelButton, saveButton } = layout;
    const { canSave, strings } = props;

    // Draw Cancel button (red)
    this.drawButton(
      renderer,
      cancelButton.x,
      cancelButton.y,
      cancelButton.width,
      cancelButton.height,
      strings.cancel,
      COLORS.buttonRed
    );

    // Draw Save button (green if enabled, gray if disabled)
    const saveColor = canSave ? COLORS.buttonGreen : '#AAAAAA';
    this.drawButton(
      renderer,
      saveButton.x,
      saveButton.y,
      saveButton.width,
      saveButton.height,
      strings.save,
      saveColor
    );
  }

  private drawButton(
    renderer: CanvasRenderer,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    backgroundColor: string
  ): void {
    // Button background with rounded corners (matching SettingsWindow style)
    renderer.rect(x, y, width, height, backgroundColor, 4);
    // Border with matching rounded corners
    const borderColor = this.darkenColor(backgroundColor, 20);
    renderer.rect(x, y, width, height, borderColor, 4);

    // Text (centered)
    const font = `${FONTS.size14.size}px ${FONTS.size14.family}`;
    renderer.text(text, x + width / 2, y + height / 2, font, COLORS.textWhite, 'center', 'middle');
  }

  // Helper to darken a hex color for borders
  private darkenColor(hex: string, amount: number): string {
    // Convert hex to RGB, darken, convert back
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Handles touch events on the location dialog.
   * Routes touches to appropriate callbacks based on which element was touched.
   *
   * @param x - Touch X coordinate
   * @param y - Touch Y coordinate
   * @param props - Current dialog props (needed for callbacks and state)
   * @returns true if touch was handled, false otherwise
   */
  public handleTouch(x: number, y: number, props: LocationDialogProps): boolean {
    if (!this.layout) return false;

    const l = this.layout;
    const itemHeight = 24; // height of each dropdown item

    // Check textarea (consume touch and trigger focus callback)
    if (this.isPointInRect(x, y, { x: l.textarea.x, y: l.textarea.y, width: l.textarea.width, height: l.textarea.height })) {
      if (props.onFocus) {
        props.onFocus();
      }
      return true; // consume
    }

    // Check dropdown area - only if results exist and not searching
    if (props.results.length > 0 && !props.isSearching) {
      const dropdownRect = { x: l.dropdown.x, y: l.dropdown.y, width: l.dropdown.width, height: l.dropdown.height };
      if (this.isPointInRect(x, y, dropdownRect)) {
        // Calculate which item was touched
        const relativeY = y - l.dropdown.y;
        const index = Math.floor(relativeY / itemHeight);
        if (index >= 0 && index < props.results.length) {
          props.onSelectResult(index);
        }
        return true;
      }
    }

    // Check Cancel button
    if (this.isPointInRect(x, y, { x: l.cancelButton.x, y: l.cancelButton.y, width: l.cancelButton.width, height: l.cancelButton.height })) {
      props.onCancel();
      return true;
    }

    // Check Save button
    if (this.isPointInRect(x, y, { x: l.saveButton.x, y: l.saveButton.y, width: l.saveButton.width, height: l.saveButton.height })) {
      if (props.canSave) {
        props.onSave();
        return true;
      }
      return false; // disabled, don't consume
    }

    // Touch outside interactive elements but inside dialog - consume to prevent background interaction
    // The full window background counts as inside
    if (x >= 0 && x <= SCREEN.width && y >= 0 && y <= SCREEN.height) {
      return true;
    }

    return false;
  }

  private isPointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default LocationDialog;
