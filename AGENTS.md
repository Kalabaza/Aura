# Agent Guidelines for Aura ESP32 Weather Widget

**Version**: 2026-04-03  
**Last Updated**: 2026-04-03 - Phase 1 & 2 optimizations complete  
**Status**: Active - Firmware stable, Simulator v0.1.0 optimized and validated

This document provides essential information for AI coding agents working on the Aura project. Aura consists of two components:

1. **Firmware**: ESP32-based weather widget for the Cheap Yellow Display (CYD)
2. **Simulator**: Browser-based development tool for UI/UX work without hardware

Both components must maintain pixel-perfect parity in user experience.

## Build, Flash, and Test Commands

### PlatformIO (Preferred for CLI)
```bash
# Build only
platformio run

# Build and upload (requires connected ESP32)
platformio run --target upload

# Build and monitor serial output
platformio run --target monitor
```

### VS Code + PlatformIO Extension
1. Install the "PlatformIO IDE" extension in VS Code (recommended in .vscode/extensions.json)
2. Open the project folder in VS Code
3. Use the PlatformIO toolbar at the bottom for:
   - Build (checkmark icon)
   - Upload (arrow icon)
   - Monitor (plug icon)

### Arduino IDE (Original Setup)
1. Open Arduino IDE
2. Board: "ESP32 Dev Module"
3. Partition Scheme: "Huge App (3MB No OTA/1MB SPIFFS)"
4. Open `aura/weather.ino` (or `aura/aura.ino` depending on your setup)
5. Click "Verify" to compile (2-3 minutes)
6. Click "Upload" to flash (1-2 minutes)
7. Open Serial Monitor at 115200 baud for debug output

### Simulator Development
The simulator is the recommended environment for UI development and testing without hardware.

```bash
cd aura-sim

# Install dependencies (first time only)
npm install

# Start development server with file watcher
npm start

# Open http://localhost:5173 in browser
```

Available scripts:
- `npm run dev` - Development server with HMR
- `npm run watch:ino` - Watch `aura.ino` and auto-regenerate constants
- `npm run build` - Production build
- `npm run test:visual` - Visual regression tests (Playwright)
- `npm run test:visual:update` - Update visual reference images
- `npm run test:visual:capture` - Capture baseline reference images
- `npm run test:clean` - Remove `tests/references/` folder to avoid committing baselines
- `npm run package` - Create distributable ZIP
- `npm run start` - Run dev server and file watcher concurrently
- `npm run dev` - Development server with HMR
- `npm run watch:ino` - Watch `aura.ino` and auto-regenerate constants
- `npm run build` - Production build
- `npm run test:visual` - Visual regression tests
- `npm run package` - Create distributable ZIP

### Running Tests

#### Firmware
Manual hardware testing only:
1. Flash firmware via Arduino IDE or PlatformIO/VS Code
2. Power on device and observe initial boot
3. Connect to "Aura" WiFi network for captive portal configuration
4. Test weather display, touch interactions, and settings screens
5. Verify Serial Monitor output for errors

#### Simulator
1. **Visual inspection**: Compare simulator rendering to device screenshots
2. **Automated**: `npm run test:visual` - pixel-diff against reference images
3. **Interaction testing**: Verify all touch targets, navigation flows
4. **Constants verification**: Ensure `constants.auto.ts` matches `aura.ino`

All simulator tests are in `aura-sim/tests/`.

## Code Style Guidelines

### Language and Format
- This is an **Arduino/C++** project with C++17 support via PlatformIO
- Follow `.clang-format` configuration:
  - BasedOnStyle: Google
  - IndentWidth: 2
  - ColumnLimit: 100
  - BreakBeforeBraces: Allman
- Maximum line length: 100 characters

### Naming Conventions
- **Functions**: `lowercase_snake_case()` (e.g., `create_ui()`, `fetch_and_update_weather()`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `SCREEN_WIDTH`, `WEATHER_UPDATE_INTERVAL`)
- **Variables**: `lowercase_snake_case` for locals, `g_` or `s_` prefix for globals when needed
- **Classes/Structs**: `PascalCase` (e.g., `LocalizedStrings`)
- **Enums**: `PascalCase` with values in `UPPER_SNAKE_CASE` (e.g., `Language` enum with `LANG_EN`)
- **Files**: `lowercase_snake_case.ino` or `.cpp`/`.h`

### Imports and Includes
Order of includes:
1. Arduino/ESP32 framework headers (`<Arduino.h>`, `<esp_system.h>`)
2. Standard library headers
3. Third-party library headers (lvgl, TFT_eSPI, ArduinoJson, etc.)
4. Project headers (e.g., `"translations.h"`)

Always use angle brackets for system/libraries: `#include <Arduino.h>`
Use quotes for project headers: `#include "translations.h"`

### Types
- Use explicit fixed-width types: `uint32_t`, `int16_t`, `size_t`, etc.
- Prefer `String` class over C strings for Arduino compatibility
- Use `const` and `constexpr` for compile-time constants
- Use `static` for file-scope variables
- Use `bool` instead of `int` for true/false values

### Error Handling
- Check all return values from I/O operations (`HTTPClient::GET()`, `WiFi.status()`)
- Use `Serial.println()` for debug/error logging
- Handle JSON deserialization errors with `DeserializationError`
- Prefer early returns to reduce nesting
- Use `nullptr` instead of `NULL`

### Memory Management
- ESP32 has limited RAM (~320KB). Be conservative with allocations.
- Use `DynamicJsonDocument` with appropriate size (usually 8-32KB)
- Avoid large stack allocations; use static/global buffers when appropriate
- Free HTTPClient resources with `http.end()` after each request
- Use `PROGMEM` for large constant data (icons, fonts are already handled)

### LVGL UI Code
- LVGL objects are managed manually; use `lv_obj_del()` to clean up
- Set event callbacks with `lv_obj_add_event_cb()`
- Use `lv_obj_clean()` to remove all children from a screen
- Avoid creating objects in tight loops without cleanup
- Use `lv_timer_t*` for periodic tasks; always delete timers with `lv_timer_del()`

### Arduino Sketch Structure
- Main file: `aura/aura.ino` (contains `setup()` and `loop()`)
- Helper functions declared at top, defined below
- Global/static variables for UI components and state
- Use `static` keyword for internal linkage when appropriate

### Hardware-Specific Code
- Pin definitions in `#define` statements at top (e.g., `XPT2046_CS`, `LCD_BACKLIGHT_PIN`)
- Touchscreen calibration values hardcoded (update only for different hardware)
- Screen dimensions: `SCREEN_WIDTH 240`, `SCREEN_HEIGHT 320`
- Display driver: `TFT_eSPI` with `User_Setup.h` configuration

## Configuration Files

### Required Configuration Files
These must be placed in Arduino libraries folder (`~/Documents/Arduino/libraries/`):
- `TFT_eSPI/User_Setup.h` - Display driver configuration
- `lvgl/src/lv_conf.h` - LVGL library configuration

### PlatformIO Configuration
`platformio.ini` specifies:
- Board: `esp32dev`
- Framework: Arduino
- Partition scheme: `huge_app.csv` (3MB app, 1MB SPIFFS)
- Library dependencies with exact versions

### VS Code Configuration
- `.vscode/settings.json` - Workspace-specific settings (PlatformIO integration)
- `.vscode/extensions.json` - Recommends PlatformIO IDE extension
- Use VS Code + PlatformIO IDE extension for seamless development experience

## Project Structure
```
aura/                    # Main source directory (src_dir)
├── aura.ino            # Main Arduino sketch entry point
├── translations.h      # Localized strings for multi-language support
├── icon_*.c            # Weather icon images (compiled as C arrays)
├── image_*.c           # Larger weather images
└── lv_font_*.c         # Custom LVGL fonts

TFT_eSPI/
└── User_Setup.h        # Display/touchscreen pin configuration

lvgl/
└── src/
    └── lv_conf.h       # LVGL configuration

.vscode/
├── settings.json       # VS Code workspace settings
└── extensions.json     # VS Code extension recommendations

platformio.ini          # PlatformIO build configuration
.clang-format           # Code formatting rules
AGENTS.md               # THIS FILE - agent guidelines
```

## Multi-language Support
- Languages defined in `enum Language` in `translations.h` (firmware) and `LocalizedStrings.ts` (simulator)
- All UI text in `LocalizedStrings` struct; add new languages by extending both files
- When modifying text strings, run `python3 aura/extract_unicode_chars.py aura/aura.ino` to identify required Unicode characters for font generation
- Font files must include all used Unicode characters (`°¿ÉÊÍÓÜßáäçèéíñóöúûü‐→`)
- Simulator uses Google Fonts Montserrat which supports all required glyphs already

## Simulator Code Style

### Language and Format
- TypeScript 5.0+ with strict type checking enabled
- Use explicit return types on public methods
- Maximum line length: 100 characters
- Use semicolons (consistent with existing codebase)
- Prefer `const` over `let`; avoid `var`

### Naming Conventions
- **Classes**: `PascalCase` (e.g., `CanvasRenderer`, `NightModeManager`)
- **Interfaces**: `PascalCase` prefixed with `I` optional (e.g., `AppState`, `Widget`)
- **Functions/Methods**: `lowercaseCamelCase()` (e.g., `createApp()`, `updateState()`)
- **Constants**: `UPPER_SNAKE_CASE` for exported constants; `camelCase` for module-level
- **Files**: `lowercase_snake_case.ts` for utilities, `PascalCase.ts` for classes
- **Variables**: `lowercase_camel_case` for locals and properties; `g_` or `s_` rarely needed

### Imports and Includes
Order of imports:
1. Node built-ins (`fs`, `path`)
2. Third-party packages (`react`, `lvgl`, etc.)
3. Project modules (relative imports)

Always use absolute imports from project root with `@` alias (if configured) or relative paths.

### Types
- Use TypeScript built-in types: `Record<string, unknown>`, `Partial<T>`, `Readonly<T>`
- Define interfaces for all state and props; avoid implicit `any`
- Use `null` for absent objects, `undefined` for uninitialized scalars
- Use `as const` for literal object types (especially layout constants)

### Error Handling
- Async operations should `try`/`catch` and log to `console.error`
- Widget `render()` methods may be async; errors should not crash render loop
- File parser should throw descriptive errors with line numbers
- User-facing errors should be stored in state and rendered (not just logged)

### Memory Management
- Simulator: Pre-cache all icon `ImageBitmap`s at startup to avoid async load during render
- Firmware: See firmware-specific constraints in original section
- Canvas operations are fast; avoid creating objects (arrays, objects) in hot render loop
- Icon cache is global `Map<string, ImageBitmap>`; acceptable to grow unbounded for dev

### Logging
- Use standard browser `console` methods: `console.error`, `console.warn`, `console.info`
- Debug-only logs should be wrapped with the `DEBUG` flag.
- `console.error` for errors that affect functionality
- `console.warn` for non-critical issues or deprecations
- `console.info` for important operational events (state changes, fetches, etc.)
- Avoid logging in hot render loops; use conditional or rate-limited logging if needed
- Always include a clear tag prefix: `[ModuleName]` for easy filtering

The `DEBUG` flag is defined as:

```typescript
const DEBUG = import.meta.env?.DEV || import.meta.env.VITE_DEBUG === 'true';
```

### Widget Interface (Simulator)

All widgets must implement:

```typescript
interface Widget {
  render(
    renderer: CanvasRenderer,
    state: AppState,
    derived: DerivedState
  ): Promise<void> | void;

  handleTouch(x: number, y: number, ...props: any): boolean;

  start?(): void;   // Start animations (optional)
  stop?(): void;    // Cleanup (cancel timers, animation frames)
}
```

- `render()` may be async if loading images; otherwise return `void`
- `handleTouch()` returns `true` if event consumed, `false` to propagate
- `start()` called on screen entry; `stop()` called on screen exit
- Widgets are instantiated once and reused (cached in `App`)

### CanvasRenderer Usage

Use these methods (mirrors LVGL):

```typescript
renderer.clear();
renderer.fill(color);                                    // fill canvas
renderer.rect(x, y, w, h, color, borderRadius?);
renderer.text(str, x, y, font, color, align?, baseline?);
renderer.arc(cx, cy, r, startAngle, endAngle, color, width?);  // angles in degrees
renderer.gradient(x, y, w, h, topColor, bottomColor);
renderer.imageSync(bitmap, x, y, w, h);                  // pre-cached bitmap
await renderer.image(dataUrl, x, y, w, h);              // async load
renderer.clipRect(x, y, w, h);  // / restore()
```

**Important**: All coordinates are in device pixels (0-239, 0-319). The renderer handles scaling for display automatically.

### State Management Patterns

- **Single source of truth**: `App.state` (immutable updates via `updateState()`)
- **Derived state**: Computed each frame in `updateDerivedState()` and cached
- **Screen transitions**: `setScreen()` updates `currentScreen`; `onScreenChange()` handles widget lifecycle
- **Persistence**: Settings changes automatically saved to `localStorage` in `updateState()`
- **No direct mutation**: Never do `app.state.settings.brightness = 100`; always `app.updateState({ settings: {...} })`

### Parser Extension (AuraInoParser)

The parser uses regular expressions to extract constants. To support new patterns:

1. Add extraction method: `private extractFoo(content: string): ParsedFoo[] { ... }`
2. Call it in `parse()` and merge results into `ParsedResult`
3. Add to `generateTypeScript()` output if needed
4. Test with sample `aura.ino` snippets to verify regex captures

**Common extraction patterns**:
- Screen dimensions: `#define\s+SCREEN_WIDTH\s+(\d+)`
- Colors: `lv_color_hex\(0x([0-9a-fA-F]+)\)`
- Fonts: `LV_FONT_DECLARE\(lv_font_montserrat_latin_(\d+)\)`
- Positions: `lv_obj_align\([^,]+,\s+LV_ALIGN_([A-Z_]+)\s*,\s*(\d+)\s*,\s*(\d+)\)`

### File Structure (Simulator)

```
src/
├── App.ts                 # App controller - read this first to understand flow
├── AppRoot.tsx            # Minimal React entry point (mostly just canvas creation)
├── CanvasRenderer.ts      # Core drawing - understand methods before writing widgets
├── state/                 # State management
│   ├── AppState.ts        # All TypeScript interfaces - must mirror firmware
│   ├── Preferences.ts     # Persistence layer (localStorage)
│   └── LocalizedStrings.ts # Multi-language strings (keep in sync with translations.h)
├── renderer/
│   ├── Widgets/           # One file per screen - follow existing patterns
│   ├── Constants.ts       # Manual overrides (semantic names)
│   ├── Constants.auto.ts  # AUTO-GENERATED - do not edit
│   └── Fonts.ts           # Font helper utilities
├── parser/                # Static analysis - regex-based extraction
├── watcher/               # File watching - chokidar integration
├── features/              # Cross-cutting concerns (night mode, etc.)
└── assets/                # Static resources (icons.ts generated from PNGs)
```

## Testing Strategy

### Simulator Tests

**Visual Regression** (`tests/visual-test.ts`):
- Uses Playwright to launch headless browser
- Navigates to each UI state programmatically
- Captures screenshots and compares with `tests/references/` using `pixelmatch`
- Tolerance: 0.1% pixels (allows minor font rendering differences)
- Run: `npm run test:visual`
- Update baselines: `npm run test:visual:update`

**Manual Test Checklist**:
- [ ] Boot sequence: WiFi splash → loading → main (or splash if no WiFi)
- [ ] Touch main screen → opens settings
- [ ] Tap forecast box → toggles daily/hourly
- [ ] Settings tabs switch (Display, General)
- [ ] Brightness slider updates preview
- [ ] Night mode switch (test with system time or mock)
- [ ] Screen off toggle + timeout behavior
- [ ] Language dropdown changes all text
- [ ] Location dialog: enter city, select from dropdown, save
- [ ] Reset WiFi shows confirmation modal
- [ ] Clock updates every second
- [ ] WiFi bars reflect connectivity state

### Firmware Tests

No automated tests exist. Manual procedure:
1. Flash firmware
2. Verify boot logs on Serial Monitor (115200 baud)
3. Connect to "Aura" AP, configure WiFi
4. Wait for weather fetch (check "Updated weather from open-meteo")
5. Test all interactions as above
6. Watch for errors: "HTTP GET failed", JSON parse errors, malloc failures

## Visual Testing

The Aura simulator includes visual regression tests using Playwright. These tests capture screenshots of each UI state and compare them against baseline reference images to detect unintended visual changes.

### Prerequisites

1. **Install system dependencies** for Playwright/Chromium:
   ```bash
   sudo npx playwright install-deps chromium
   ```
   Or manually:
   ```bash
   sudo apt-get update
   sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
     libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
     libxrandr2 libgbm1 libasound2
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

### Running Tests

**First-time setup** - capture baseline reference images:
```bash
cd aura-sim
npm run test:visual:capture
```
This will:
- Start the Vite development server
- Launch Chromium with timezone set to UTC
- Navigate through all 11 UI states
- Capture screenshots to `tests/references/`
- Commit these reference images to version control

**Run the visual regression suite**:
```bash
npm run test:visual
```
This will:
- Start the Vite dev server
- Navigate to each UI state
- Compare current rendering against reference images
- Report any pixel differences (>0.1% tolerance)
- Exit with code 0 if all tests pass

### Test Coverage

The suite covers 11 UI states:
- Main screen variations (English, Spanish, Fahrenheit, 24hr format, night mode)
- Loading spinner
- WiFi splash screen
- Settings window (Display and General tabs)
- Location search dialog
- Reset WiFi confirmation modal

### Troubleshooting

- **Tests fail with "CONFIG is not defined"**: Ensure the simulator is running on localhost (the test API `window.__AURA_TEST__` must be available). Check that `import.meta.env.DEV` is true (run `npm run dev` mode).
- **Browser fails to launch**: Verify system dependencies are installed (`libnss3`, etc.) and Playwright Chromium is installed.
- **All tests fail initially**: Reference images not captured yet. Run `npm run test:visual:capture` first.
- **Time display incorrect**: The tests use UTC timezone; ensure your system time is synchronized.

### Updating Baselines

If intentional visual changes are made (e.g., UI redesign, color updates), recapture baselines:
```bash
npm run test:visual:capture
```
Review and commit the updated reference images.

## Debugging Tips

### Simulator

1. **Constants not updating**: Run `npm run watch:ino -- --force`; check parser output
2. **Icons missing**: `console.log(Object.keys(Icons))`; verify icon name matches
3. **Touch misaligned**: Log normalized coordinates: `console.log(x, y)` in `App.handleTouch`
4. **Layout mismatch**: Draw debug hitboxes with `renderer.ctx.strokeRect(...)`
5. **Performance**: Check FPS counter, profile Chrome DevTools, avoid allocations in render loop
6. **Debug logs**: Enable verbose logging by setting `VITE_DEBUG=true` in a `.env` file or by running in development mode (`npm run dev`). Use the browser console's filter to view specific log levels (error, warn, info, debug). Logs are tagged with module names in brackets (e.g., `[App]`, `[Weather]`) for easy filtering.

### Firmware

1. **Compilation errors**: Verify library versions in `platformio.ini`; check `TFT_eSPI/User_Setup.h` and `lv_conf.h` are in Arduino libraries folder
2. **Blank screen**: Check pin mappings in `User_Setup.h` match hardware; verify backlight pin (GPIO21) has PWM
3. **Touch not working**: Check XPT2046 SPI initialization; adjust calibration constants; verify `touchscreen_read()` returns valid coordinates
4. **WiFi issues**: Check Serial Monitor for captive portal messages; ensure `WiFiManager` debug callbacks enabled
5. **Memory errors**: Look for "malloc failed" or "allocation failed"; reduce buffer sizes, move large data to `PROGMEM`
6. **Weather not updating**: Check API response in Serial; verify `WiFi.status() == WL_CONNECTED`; check geocoding results

**Serial Monitor Commands** (115200 baud):
- `"WiFi connected"` - network established
- `"Updated weather from open-meteo"` - successful fetch
- `"Completed location search"` - geocoding succeeded
- `"HTTP GET failed"` or JSON parse errors - network/API issues

## Critical Files to Update

When making changes, ensure these files are updated:

| Change | Files to Update |
|--------|----------------|
| UI layout/colors/sizes (firmware) | `aura/aura.ino` (LVGL calls) |
| Constants extraction | `aura-sim/src/parser/AuraInoParser.ts` |
| Manual overrides | `aura-sim/src/renderer/Constants.ts` |
| Weather icons | `aura-sim/src/assets/icons.ts` (via conversion script) |
| Multi-language strings | `aura/translations.h` and `aura-sim/src/state/LocalizedStrings.ts` |
| Build configuration | `platformio.ini` (firmware lib versions) |
| Documentation | `AGENTS.md`, `PROJECT_STATUS.md`, `aura-sim/README.md` |
| Tests | `aura-sim/tests/visual-test.ts`, reference images |

## CI/CD and Automation

- No formal CI currently configured
- Visual tests can be run locally: `npm run test:visual`
- Consider adding GitHub Actions for:
  - Firmware build verification (PlatformIO)
  - Simulator visual tests (Playwright)
  - TypeScript compilation check
  - Parser validation against `aura.ino`

## Distribution

### Firmware
- Built `.bin` files can be flashed via PlatformIO or Arduino IDE
- No distribution package; users must build from source

### Simulator
```bash
cd aura-sim
npm run build    # creates dist/ with static files
npm run package  # creates ZIP with instructions
```

Distribute `dist/` folder or ZIP. Users can:
- Open `dist/index.html` directly (file:// works but file watcher limited)
- Serve via any static file server: `python3 -m http.server 8000`
- Use Docker (Dockerfile provided)

## License
GPL 3.0 - See full license text in repository root.

## Important Implementation Notes

### WiFi and Networking
- Uses `WiFiManager` for captive portal AP mode (SSID: "Aura")
- WiFi credentials saved in ESP32 NVS via Preferences
- Weather data from Open-Meteo API (no API key required)
- Geocoding via Open-Meteo Geocoding API
- NTP time sync with `pool.ntp.org` and `time.nist.gov`

### Screen Behavior
- Auto-off after configurable timeout (5-60 seconds) when screen off enabled
- Night mode with reduced brightness active 8PM-6AM
- Touch wakes screen temporarily; 500ms ignore period after wake
- Settings window auto-closes after 30 seconds of inactivity
- Backlight controlled via PWM on `LCD_BACKLIGHT_PIN` (GPIO21)

### Weather Data
- Updates every 10 minutes (configurable in code)
- Current conditions + 7-day daily forecast + 7-hour hourly forecast
- Temperature conversion between Celsius/Fahrenheit
- Weather code mapping via `choose_image()` and `choose_icon()` functions

## Debugging Tips
1. **Compilation errors**: Verify library versions match `platformio.ini` and configuration files are properly placed
2. **Blank screen**: Check `User_Setup.h` pin mappings match hardware connections
3. **Touch not working**: Verify XPT2046 pins and SPI initialization; adjust calibration values in `touchscreen_read()`
4. **WiFi issues**: Check Serial Monitor for captive portal messages; use `WiFiManager` debug callbacks
5. **Memory errors**: Watch for "malloc failed" or " allocation failed" on Serial; reduce buffer sizes or images
6. **Weather not updating**: Check API response in Serial Monitor; verify `WiFi.status() == WL_CONNECTED`

### Serial Monitor Commands
Serial output is at 115200 baud. Look for:
- `"WiFi connected"` - network connection established
- `"Updated weather from open-meteo"` - successful weather fetch
- `"Completed location search"` - geocoding succeeded
- `"HTTP GET failed"` or JSON parse errors - network/API issues

## Libraries and Versions
- ArduinoJson 7.4.1
- HttpClient 2.2.0
- TFT_eSPI 2.5.43
- WiFiManager 2.0.17
- XPT2046_Touchscreen 1.4
- LVGL 9.2.2

**Always use these exact versions**; newer versions may break compatibility.

## Simulator Architecture & Integration

### Overview
The simulator (`aura-sim/`) is a React-free TypeScript application that renders the Aura UI on an HTML5 canvas at the device's native 240×320 resolution. It mirrors the LVGL-based firmware's behavior exactly.

### Architecture Highlights

**App.ts** - Central orchestrator and single source of truth for application state. Runs a `requestAnimationFrame` render loop that delegates to widget classes.

**CanvasRenderer** - Low-level 2D drawing engine providing LVGL-like primitives (`rect`, `text`, `image`, `arc`, `gradient`). All widgets draw through this abstraction.

**Widgets** - Screen-specific renderers (`MainScreen`, `SettingsWindow`, `LocationDialog`, `LoadingSpinner`, `WifiSplash`, `ResetWifiModal`). Each implements:
- `render(renderer, state, derived)` - draws the screen
- `handleTouch(x, y)` - returns `true` if event handled
- Optional `start()`/`stop()` for animations

**File Watcher & Parser** - Monitors `aura/aura.ino` for changes and auto-generates `src/renderer/constants.auto.ts` using regex-based static analysis. This enables hot-reload of colors, positions, font sizes, and timing constants without page refresh.

**NightModeManager** - Encapsulates time-based and screen-off logic identical to firmware behavior.

**Logging** - Simplified approach using standard `console` methods with `DEBUG` flag for conditional debug output. No custom logger infrastructure.

### State Model
TypeScript interfaces in `aura-sim/src/state/AppState.ts` mirror the firmware's global variables exactly:
- `currentScreen`: which widget to render
- `wifiConnected`: network status
- `weatherData`: current/forecast data (mock in simulator)
- `settings`: persisted preferences (brightness, units, language, etc.)
- Runtime flags: `nightModeActive`, `screenOffActive`, `tempScreenWakeupActive`

### Constants System

**Manual constants** (`Constants.ts`): Semantic colors and layout positions. These can be edited to override parser output if needed.

**Auto-generated constants** (`constants.auto.ts`): Extracted from `aura.ino` by `AuraInoParser`. Includes:
- `SCREEN` dimensions (240, 320)
- `FONTS` (size12, size14, size16, size42) with Montserrat family
- `TIMINGS` (spinner rotation, settings timeout, weather interval, etc.)
- `DEFAULTS` (latitude, longitude, brightness values)
- DO NOT EDIT manually; regenerated automatically.

### Data Flow

1. User touches canvas → `App.handleTouch(x, y)`
2. `NightModeManager` checks screen state (wake, cooldown)
3. Current widget's `handleTouch()` processes event
4. `App.updateState()` merges updates, triggers side effects (persistence, weather fetch)
5. Next frame: `App.render()` → widget `render()` → `CanvasRenderer` draws

### Hot Reload

When `aura.ino` changes:
1. File watcher (500ms debounce) → runs `AuraInoParser`
2. Parser writes `constants.auto.ts`
3. Vite HMR detects module change and updates live bindings
4. Next render automatically uses new values (no page refresh)

### Keeping Firmware & Simulator in Sync

- **Pixel positions**: Defined once in `aura.ino` using LVGL `lv_obj_set_pos()` / `lv_obj_align()`. Parser extracts these to auto-generate simulator coordinates.
- **Colors**: Firmware uses `lv_color_hex(0x...)`. Parser extracts hex values to `COLORS` in `Constants.ts`.
- **Timings**: Firmware `#define` constants (e.g., `WEATHER_UPDATE_INTERVAL`) are parsed to `TIMINGS`.
- **Fonts**: Firmware `LV_FONT_DECLARE()` → simulator `FONTS.sizeXX`.
- **Strings**: Firmware `translations.h` → simulator `LocalizedStrings.ts`. Must be manually kept in sync.

**IF PARSER FAILS TO EXTRACT**:
- Manual overrides in `Constants.ts` take precedence over `constants.auto.ts`
- Document the missing pattern and update `AuraInoParser.ts` to handle it

## Hardware Dependency
**Firmware**: The ESP32 firmware **cannot be built, tested, or run without the physical ESP32-2432S028R ILI9341 hardware** (Cheap Yellow Display). There is no host-based simulation for the actual device.

**Simulator**: The simulator runs entirely in a browser and is the primary development tool for UI/UX work. It provides pixel-accurate representation of the device screen but uses mock weather data.

**Integration Testing**: Final validation requires flashing to actual hardware to verify:
- Touchscreen accuracy and calibration
- WiFi captive portal functionality
- Real API connectivity (Open-Meteo)
- Memory usage and performance on constrained hardware

## References
- MakerWorld case design: https://makerworld.com/en/models/1382304-aura-smart-weather-forecast-display
- Open-Meteo API: https://open-meteo.com/

---

**Last Updated**: 2026-04-01
**Project License**: GPL 3.0