# Agent Guidelines for Aura ESP32 Weather Widget

This document provides essential information for AI coding agents working on the Aura project. Aura is an ESP32-based weather widget for the Cheap Yellow Display (CYD) with a 2.8" ILI9341 screen.

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

### Running Tests
This project has **no automated unit tests**. All validation is manual on hardware:
1. Flash firmware via Arduino IDE or PlatformIO/VS Code
2. Power on device and observe initial boot
3. Connect to "Aura" WiFi network for captive portal configuration
4. Test weather display, touch interactions, and settings screens
5. Verify Serial Monitor output for errors

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
- Languages defined in `enum Language` in `translations.h`
- All UI text in `LocalizedStrings` struct; add new languages by extending it
- When modifying text strings, run `python3 aura/extract_unicode_chars.py aura/aura.ino` to identify required Unicode characters for font generation
- Font files must include all used Unicode characters (`°¿ÉÊÍÓÜßáäçèéíñóöúûü‐→`)

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

## Important: Hardware Dependency
This project **cannot be built, tested, or run without the physical ESP32-2432S028R ILI9341 hardware** (Cheap Yellow Display). There is no host-based simulation. All meaningful testing requires flashing to actual hardware.

## References
- MakerWorld case design: https://makerworld.com/en/models/1382304-aura-smart-weather-forecast-display
- Open-Meteo API: https://open-meteo.com/

---

**Last Updated**: 2026-03-24  
**Project License**: GPL 3.0