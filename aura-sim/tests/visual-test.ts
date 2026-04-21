/**
 * Aura Simulator - Visual Regression Test Suite
 *
 * This script launches the simulator in a headless browser and performs
 * pixel-perfect comparisons against reference images for each UI state.
 *
 * Usage:
 *   npm run test:visual           # Run all visual tests (fail on differences)
 *   npm run test:visual:update    # Update all reference images with current renders
 *   npm run test:visual:capture   # Capture baseline screenshots for all states
 *
 * Requirements:
 *   - Node.js 18+
 *   - Playwright browsers installed (npx playwright install --with-deps chromium)
 *
 * Configuration:
 *   - Reference images: tests/references/
 *   - Diff output: tests/output/
 *   - Threshold: 0.1% pixel mismatch (configurable)
 */

import { chromium } from 'playwright';
import type { Browser, Page, BrowserContext } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Vite dev server
  vitePort: 5173,
  viteHost: 'localhost',

  // Viewport and scaling
  screenWidth: 240,
  screenHeight: 320,
  displayScale: 2, // 2x scaling for better screenshot quality (matches AppRoot)

  // Image comparison
  threshold: 0.001, // 0.1% pixel difference allowed
  pixelDiffThreshold: 0.1, // Color difference threshold per pixel (0-1)

  // Timing
  renderStabilizationMs: 500, // Wait after state change for animations
  pageLoadTimeoutMs: 30000,

  // Paths
  referencesDir: join(__dirname, 'references'),
  outputDir: join(__dirname, 'output'),

  // Whether to update references instead of comparing
  updateRefs: process.argv.includes('--update-refs'),

  // Browser launch options
  headless: true,
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface TestCase {
  name: string;
  description: string;
  setup: (api: TestAPI) => Promise<void>;
  options?: {
    skip?: boolean;
    tolerance?: number; // Override global threshold for this test
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  diffImagePath?: string;
  error?: string;
}

type TestAPI = {
  setScreen: (screen: string) => Promise<void>;
  setState: (updates: Record<string, unknown>) => Promise<void>;
  waitForStable: (ms?: number) => Promise<void>;
  getState: () => Promise<Record<string, unknown>>;
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    // Ignore if directory already exists
  }
}

/**
 * Start Vite dev server
 */
function startViteServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const vite = spawn('npm', ['run', 'dev'], {
      cwd: __dirname, // Run from aura-sim directory
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    vite.stdout.on('data', (data) => {
      stdout += data.toString();
      // Check if server is ready
      if (stdout.includes(`Local:   http://localhost:${CONFIG.vitePort}`) ||
          stdout.includes(`ready in`)) {
        resolve(vite);
      }
    });

    vite.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Vite]', data.toString().trim());
    });

    vite.on('error', (err) => {
      reject(new Error(`Failed to start Vite: ${err.message}`));
    });

    vite.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Vite exited with code ${code}\n${stderr}`));
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Vite failed to start within 30 seconds'));
    }, CONFIG.pageLoadTimeoutMs);
  });
}

/**
 * Stop Vite server
 */
function stopViteServer(vite: ChildProcess): void {
  if (vite && !vite.killed) {
    vite.kill('SIGTERM');
    // Force kill after 5 seconds if still alive
    setTimeout(() => {
      if (!vite.killed) vite.kill('SIGKILL');
    }, 5000);
  }
}

/**
 * Compare two images using pixelmatch
 */
async function compareImages(
  img1Buffer: Buffer,
  img2Buffer: Buffer,
  threshold: number = CONFIG.threshold
): Promise<{ diffPercent: number; diffPixels: number; totalPixels: number; diffBuffer: Buffer }> {
  // Dynamic import of pixelmatch and pngjs to avoid requiring them globally
  const pixelmatch = (await import('pixelmatch')).default;
  const { PNG } = await import('pngjs');

  const img1 = PNG.sync.read(img1Buffer);
  const img2 = PNG.sync.read(img2Buffer);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(`Image dimensions mismatch: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold: CONFIG.pixelDiffThreshold }
  );

  const totalPixels = width * height;
  const diffPercent = diffPixels / totalPixels;

  return {
    diffPercent,
    diffPixels,
    totalPixels,
    diffBuffer: PNG.sync.write(diff)
  };
}

/**
 * Save buffer to file
 */
async function saveFile(filePath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

/**
 * Load file as buffer
 */
async function loadFile(filePath: string): Promise<Buffer> {
  return await fs.readFile(filePath);
}

// ============================================================================
// TEST CASES
// ============================================================================

/**
 * Define all test cases for the simulator
 */
function getTestCases(): TestCase[] {
  return [
    {
      name: 'main_screen_english',
      description: 'Main weather screen with mock data (English, Celsius)',
      setup: async (api: TestAPI) => {
        // Set state with English language and Celsius
        await api.setState({
          settings: {
            useFahrenheit: false,
            use24Hour: false,
            language: 0, // English
            location: 'London',
            latitude: '51.5074',
            longitude: '-0.1278',
            useNightMode: false,
            useScreenOff: false,
            dayBrightness: 128,
            nightBrightness: 64,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: {
              temp: 18,
              feels_like: 16,
              code: 0, // Clear
              is_day: 1,
            },
            daily: [
              { day: 0, date: '2026-03-31', high: 19, low: 12, code: 0 },
              { day: 1, date: '2026-04-01', high: 17, low: 10, code: 2 },
              { day: 2, date: '2026-04-02', high: 15, low: 9, code: 3 },
              { day: 3, date: '2026-04-03', high: 14, low: 8, code: 61 },
              { day: 4, date: '2026-04-04', high: 16, low: 11, code: 80 },
              { day: 5, date: '2026-04-05', high: 18, low: 12, code: 1 },
              { day: 6, date: '2026-04-06', high: 20, low: 13, code: 0 },
            ],
            hourly: [
              { hour: 14, temp: 18, code: 0, precipitation: 0, is_day: 1 },
              { hour: 15, temp: 19, code: 1, precipitation: 5, is_day: 1 },
              { hour: 16, temp: 18, code: 2, precipitation: 10, is_day: 1 },
              { hour: 17, temp: 17, code: 3, precipitation: 20, is_day: 0 },
              { hour: 18, temp: 15, code: 61, precipitation: 40, is_day: 0 },
              { hour: 19, temp: 14, code: 80, precipitation: 30, is_day: 0 },
              { hour: 20, temp: 13, code: 2, precipitation: 10, is_day: 0 },
            ],
          },
        });
        await api.setScreen('main');
      },
    },
    {
      name: 'main_screen_spanish',
      description: 'Main weather screen (Español, Celsius)',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: false,
            use24Hour: false,
            language: 1, // Spanish
            location: 'Madrid',
            latitude: '40.4168',
            longitude: '-3.7038',
            useNightMode: false,
            useScreenOff: false,
            dayBrightness: 128,
            nightBrightness: 64,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: {
              temp: 22,
              feels_like: 24,
              code: 0,
              is_day: 1,
            },
            daily: [
              { day: 0, date: '2026-03-31', high: 24, low: 16, code: 0 },
              { day: 1, date: '2026-04-01', high: 22, low: 14, code: 1 },
              { day: 2, date: '2026-04-02', high: 20, low: 13, code: 2 },
              { day: 3, date: '2026-04-03', high: 21, low: 14, code: 0 },
              { day: 4, date: '2026-04-04', high: 23, low: 15, code: 63 },
              { day: 5, date: '2026-04-05', high: 25, low: 17, code: 0 },
              { day: 6, date: '2026-04-06', high: 26, low: 18, code: 1 },
            ],
            hourly: [
              { hour: 14, temp: 22, code: 0, precipitation: 0, is_day: 1 },
              { hour: 15, temp: 23, code: 0, precipitation: 0, is_day: 1 },
              { hour: 16, temp: 23, code: 1, precipitation: 5, is_day: 1 },
              { hour: 17, temp: 22, code: 2, precipitation: 10, is_day: 0 },
              { hour: 18, temp: 20, code: 61, precipitation: 30, is_day: 0 },
              { hour: 19, temp: 19, code: 63, precipitation: 50, is_day: 0 },
              { hour: 20, temp: 18, code: 80, precipitation: 20, is_day: 0 },
            ],
          },
        });
        await api.setScreen('main');
      },
    },
    {
      name: 'main_screen_fahrenheit',
      description: 'Main weather screen (English, Fahrenheit)',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: true,
            use24Hour: false,
            language: 0, // English
            location: 'New York',
            latitude: '40.7128',
            longitude: '-74.0060',
            useNightMode: false,
            useScreenOff: false,
            dayBrightness: 128,
            nightBrightness: 64,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: {
              temp: 64, // ~18°C
              feels_like: 61,
              code: 0,
              is_day: 1,
            },
            daily: [
              { day: 0, date: '2026-03-31', high: 66, low: 54, code: 0 },
              { day: 1, date: '2026-04-01', high: 63, low: 50, code: 2 },
              { day: 2, date: '2026-04-02', high: 59, low: 48, code: 3 },
              { day: 3, date: '2026-04-03', high: 57, low: 46, code: 61 },
              { day: 4, date: '2026-04-04', high: 61, low: 52, code: 80 },
              { day: 5, date: '2026-04-05', high: 64, low: 54, code: 1 },
              { day: 6, date: '2026-04-06', high: 68, low: 56, code: 0 },
            ],
            hourly: [
              { hour: 14, temp: 64, code: 0, precipitation: 0, is_day: 1 },
              { hour: 15, temp: 66, code: 1, precipitation: 5, is_day: 1 },
              { hour: 16, temp: 64, code: 2, precipitation: 10, is_day: 1 },
              { hour: 17, temp: 63, code: 3, precipitation: 20, is_day: 0 },
              { hour: 18, temp: 59, code: 61, precipitation: 40, is_day: 0 },
              { hour: 19, temp: 57, code: 80, precipitation: 30, is_day: 0 },
              { hour: 20, temp: 55, code: 2, precipitation: 10, is_day: 0 },
            ],
          },
        });
        await api.setScreen('main');
      },
    },
    {
      name: 'main_screen_24hr',
      description: 'Main weather screen with 24-hour time format',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: false,
            use24Hour: true, // 24-hour time
            language: 0, // English
            location: 'Paris',
            latitude: '48.8566',
            longitude: '2.3522',
            useNightMode: false,
            useScreenOff: false,
            dayBrightness: 128,
            nightBrightness: 64,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: {
              temp: 15,
              feels_like: 13,
              code: 0,
              is_day: 1,
            },
            daily: [
              { day: 0, date: '2026-03-31', high: 17, low: 10, code: 0 },
              { day: 1, date: '2026-04-01', high: 16, low: 9, code: 3 },
              { day: 2, date: '2026-04-02', high: 14, low: 7, code: 61 },
              { day: 3, date: '2026-04-03', high: 15, low: 8, code: 80 },
              { day: 4, date: '2026-04-04', high: 17, low: 10, code: 0 },
              { day: 5, date: '2026-04-05', high: 18, low: 11, code: 1 },
              { day: 6, date: '2026-04-06', high: 19, low: 12, code: 0 },
            ],
            hourly: [
              { hour: 14, temp: 15, code: 0, precipitation: 0, is_day: 1 },
              { hour: 15, temp: 16, code: 1, precipitation: 5, is_day: 1 },
              { hour: 16, temp: 15, code: 2, precipitation: 10, is_day: 1 },
              { hour: 17, temp: 14, code: 3, precipitation: 15, is_day: 0 },
              { hour: 18, temp: 13, code: 61, precipitation: 30, is_day: 0 },
              { hour: 19, temp: 12, code: 80, precipitation: 25, is_day: 0 },
              { hour: 20, temp: 11, code: 2, precipitation: 10, is_day: 0 },
            ],
          },
        });
        await api.setScreen('main');
      },
    },
    {
      name: 'loading_screen',
      description: 'Loading spinner screen',
      setup: async (api: TestAPI) => {
        // Set WiFi connected but no weather data (loading state)
        await api.setState({
          wifiConnected: true,
          weatherLoading: true,
          weatherData: null,
          lastWeatherUpdateMs: 0, // Doesn't matter, loading blocks periodic fetch
        });
        await api.setScreen('loading');
        // Freeze spinner at 0° for deterministic capture
        await api.setState({
          testOverrides: { freezeSpinner: true, fixedSpinnerAngle: 0 }
        });
      },
    },
    {
      name: 'wifi_splash_screen',
      description: 'WiFi configuration splash screen',
      setup: async (api: TestAPI) => {
        await api.setState({
          wifiConnected: false,
          currentScreen: 'wifi_splash',
          weatherData: null,
          weatherLoading: false,
          lastWeatherUpdateMs: 0,
        });
      },
    },
    {
      name: 'settings_display_tab_english',
      description: 'Settings window - Display tab (English)',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: false,
            use24Hour: false,
            language: 0,
            location: 'London',
            latitude: '51.5074',
            longitude: '-0.1278',
            useNightMode: true,
            useScreenOff: true,
            dayBrightness: 200,
            nightBrightness: 80,
            screenOffTimeout: 15,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: { temp: 18, feels_like: 16, code: 0, is_day: 1 },
            daily: [],
            hourly: [],
          },
        });
        await api.setScreen('settings');
        // Set active tab to display
        await api.setState({ activeSettingsTab: 'display' });
      },
    },
    {
      name: 'settings_general_tab_spanish',
      description: 'Settings window - General tab (Español)',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: true,
            use24Hour: true,
            language: 1, // Spanish
            location: 'Barcelona',
            latitude: '41.3851',
            longitude: '2.1734',
            useNightMode: false,
            useScreenOff: true,
            dayBrightness: 180,
            nightBrightness: 70,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: { temp: 20, feels_like: 19, code: 1, is_day: 1 },
            daily: [],
            hourly: [],
          },
        });
        await api.setScreen('settings');
        await api.setState({ activeSettingsTab: 'general' });
      },
    },
    {
      name: 'location_dialog',
      description: 'Location search dialog',
      setup: async (api: TestAPI) => {
        await api.setState({
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: { temp: 18, feels_like: 16, code: 0, is_day: 1 },
            daily: [],
            hourly: [],
          },
        });
        await api.setScreen('location');
      },
    },
    {
      name: 'reset_wifi_modal',
      description: 'Reset WiFi confirmation modal',
      setup: async (api: TestAPI) => {
        await api.setState({
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          weatherData: {
            current: { temp: 18, feels_like: 16, code: 0, is_day: 1 },
            daily: [],
            hourly: [],
          },
        });
        await api.setScreen('reset_wifi');
      },
    },
    {
      name: 'main_screen_night_mode',
      description: 'Main screen with night mode active',
      setup: async (api: TestAPI) => {
        await api.setState({
          settings: {
            useFahrenheit: false,
            use24Hour: false,
            language: 0,
            location: 'London',
            latitude: '51.5074',
            longitude: '-0.1278',
            useNightMode: true,
            useScreenOff: false,
            dayBrightness: 255,
            nightBrightness: 64,
            screenOffTimeout: 30,
          },
          wifiConnected: true,
          weatherLoading: false,
          lastWeatherUpdateMs: Date.now(),
          nightModeActive: true, // Force night mode
          testOverrides: { disableNightModeSync: true }, // Prevent manager from overriding
          weatherData: {
            current: {
              temp: 12,
              feels_like: 10,
              code: 0,
              is_day: 0, // Night time
            },
            daily: [
              { day: 0, date: '2026-03-31', high: 14, low: 8, code: 0 },
              { day: 1, date: '2026-04-01', high: 13, low: 7, code: 2 },
              { day: 2, date: '2026-04-02', high: 12, low: 6, code: 3 },
              { day: 3, date: '2026-04-03', high: 11, low: 5, code: 61 },
              { day: 4, date: '2026-04-04', high: 13, low: 7, code: 80 },
              { day: 5, date: '2026-04-05', high: 15, low: 9, code: 1 },
              { day: 6, date: '2026-04-06', high: 16, low: 10, code: 0 },
            ],
            hourly: [
              { hour: 22, temp: 12, code: 0, precipitation: 0, is_day: 0 },
              { hour: 23, temp: 11, code: 0, precipitation: 0, is_day: 0 },
              { hour: 0, temp: 10, code: 0, precipitation: 0, is_day: 0 },
              { hour: 1, temp: 10, code: 0, precipitation: 0, is_day: 0 },
              { hour: 2, temp: 9, code: 2, precipitation: 5, is_day: 0 },
              { hour: 3, temp: 9, code: 3, precipitation: 10, is_day: 0 },
              { hour: 4, temp: 9, code: 80, precipitation: 15, is_day: 0 },
            ],
          },
        });
        await api.setScreen('main');
      },
    },
  ];
}

// ============================================================================
// TEST RUNNER
// ============================================================================

import { setupPlaywright } from '../src/tests/playwrightSetup';

class VisualTestRunner {
  private results: TestResult[] = [];

  async run(): Promise<number> {
    console.log('\n=== Aura Simulator Visual Regression Tests ===\n');

    try {
      // Ensure output directory exists
      await ensureDir(CONFIG.outputDir);

      // Setup Playwright (starts Vite, launches browser)
      console.log('[1/2] Starting Vite dev server and browser...');
      const { browser, page, close } = await setupPlaywright();
      this.browser = browser as any;
      this.page = page as any;
      this.closeResources = close;

      // Navigate is done in setupPlaywright
      console.log('[2/2] Ready to run tests');

      // Run test cases
      console.log('[4/5] Running test cases...\n');
      const testCases = getTestCases();

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`  [${i + 1}/${testCases.length}] ${testCase.name}`);
        console.log(`         ${testCase.description}`);

        const result = await this.runTestCase(testCase);
        this.results.push(result);

        if (result.passed) {
          console.log(`         ✓ Passed`);
        } else if (result.error) {
          console.log(`         ✗ Error: ${result.error}`);
        } else {
          console.log(`         ✗ Failed: ${result.diffPercent.toFixed(3)}% diff (${result.diffPixels}/${result.totalPixels} pixels)`);
          if (result.diffImagePath) {
            console.log(`           Diff saved: ${basename(result.diffImagePath)}`);
          }
        }
      }

      // Print summary
      this.printSummary();

      // Return exit code: 0 if all passed, 1 if any failed
      const failedCount = this.results.filter(r => !r.passed && !r.error).length;
      const errorCount = this.results.filter(r => r.error).length;
      return failedCount > 0 || errorCount > 0 ? 1 : 0;

    } finally {
      await this.cleanup();
    }
  }

  private async startServer(): Promise<void> {
    this.viteProcess = await startViteServer();
    // Small delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async launchBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: CONFIG.screenWidth * CONFIG.displayScale,
        height: CONFIG.screenHeight * CONFIG.displayScale,
      },
      timezoneId: 'UTC',
    });

    this.page = await this.context.newPage();

    // Listen for console messages
    this.page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`  [Browser] ${msg.text()}`);
      }
    });
  }

  private async navigateToApp(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const url = `http://${CONFIG.viteHost}:${CONFIG.vitePort}/?testing=true`;
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: CONFIG.pageLoadTimeoutMs });

    // Wait for test API to be available
    await this.page.waitForFunction(() => {
      return window.__AURA_TEST__ && window.__AURA_TEST__.waitForStable;
    }, { timeout: 10000 });

    console.log('         App loaded and test API ready');
  }

  private async runTestCase(testCase: TestCase): Promise<TestResult> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      // Reset state by reloading page
      await this.page.reload({ waitUntil: 'networkidle' });
      await this.page.waitForFunction(() => window.__AURA_TEST__);

      const api: TestAPI = {
        setScreen: async (screen) => {
          await this.page!.evaluate((s) => window.__AURA_TEST__!.setScreen(s), screen);
          await this.page!.evaluate(
            (ms) => window.__AURA_TEST__!.waitForStable(ms),
            CONFIG.renderStabilizationMs
          );
        },
        setState: async (updates) => {
          await this.page!.evaluate((u) => window.__AURA_TEST__!.setState(u), updates);
          await this.page!.evaluate(
            (ms) => window.__AURA_TEST__!.waitForStable(ms),
            CONFIG.renderStabilizationMs
          );
        },
        waitForStable: async (ms) => {
          await this.page!.evaluate(
            (waitMs) => window.__AURA_TEST__!.waitForStable(waitMs),
            ms
          );
        },
        getState: async () => {
          return await this.page!.evaluate(() => window.__AURA_TEST__!.getState());
        },
      };

      // Set fixed time for deterministic clock rendering across all tests
      const FIXED_TIMESTAMP = Date.UTC(2026, 2, 31, 14, 30, 0); // March 31, 2026 14:30 UTC
      await api.setState({ testNow: FIXED_TIMESTAMP });

      // Execute test setup
      await testCase.setup(api);

      // Wait for rendering to stabilize
      await api.waitForStable(CONFIG.renderStabilizationMs);

      // Force one more render to ensure clean state
      await this.page.evaluate(() => window.__AURA_TEST__!.render());
      await new Promise(resolve => setTimeout(resolve, 100));

      // Take screenshot
      const screenshotBuffer = await this.page.screenshot({ type: 'png' });

      const refPath = join(CONFIG.referencesDir, `${testCase.name}.png`);
      const outputPath = join(CONFIG.outputDir, `${testCase.name}.png`);
      const diffPath = join(CONFIG.outputDir, `${testCase.name}.diff.png`);

      if (CONFIG.updateRefs) {
        // Update reference image
        await saveFile(refPath, screenshotBuffer);
        await saveFile(outputPath, screenshotBuffer); // Also save as output for comparison
        return {
          name: testCase.name,
          passed: true,
          diffPercent: 0,
          diffPixels: 0,
          totalPixels: CONFIG.screenWidth * CONFIG.screenHeight * CONFIG.displayScale ** 2,
        };
      }

      // Check if reference exists
      let refBuffer: Buffer;
      try {
        refBuffer = await loadFile(refPath);
      } catch (err) {
        return {
          name: testCase.name,
          passed: false,
          error: `Reference image not found: ${basename(refPath)}. Run 'npm run test:visual:capture' to create baseline.`,
          diffPercent: 0,
          diffPixels: 0,
          totalPixels: 0,
        };
      }

      // Compare images
      const { diffPercent, diffPixels, totalPixels, diffBuffer } = await compareImages(
        screenshotBuffer,
        refBuffer,
        testCase.options?.tolerance
      );

      const passed = diffPercent <= (testCase.options?.tolerance ?? CONFIG.threshold);

      if (!passed) {
        await saveFile(diffPath, diffBuffer);
      }

      return {
        name: testCase.name,
        passed,
        diffPercent,
        diffPixels,
        totalPixels,
        diffImagePath: passed ? undefined : diffPath,
      };

    } catch (err: unknown) {
      const error = err as Error;
      return {
        name: testCase.name,
        passed: false,
        error: error.message,
        diffPercent: 0,
        diffPixels: 0,
        totalPixels: 0,
      };
    }
  }

  private printSummary(): void {
    console.log('\n=== Test Summary ===\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed && !r.error).length;
    const errors = this.results.filter(r => r.error).length;
    const total = this.results.length;

    console.log(`Total:  ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Error:  ${errors}`);
    console.log('');

    if (failed > 0 || errors > 0) {
      console.log('Failed tests:');
      this.results
        .filter(r => !r.passed || r.error)
        .forEach(r => {
          console.log(`  - ${r.name}${r.error ? `: ${r.error}` : ''}`);
        });
      console.log('');
    }

    if (CONFIG.updateRefs) {
      console.log('Reference images updated. Commit these changes if intentional.\n');
    } else {
      console.log('To update reference images after intentional changes:');
      console.log('  npm run test:visual:update\n');
    }
  }

  private async cleanup(): Promise<void> {
    // Close browser
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }

    // Stop dev server
    if (this.viteProcess) {
      stopViteServer(this.viteProcess);
    }
  }
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

async function main(): Promise<number> {
  const runner = new VisualTestRunner();
  return await runner.run();
}

// Run and exit with appropriate code
main()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
