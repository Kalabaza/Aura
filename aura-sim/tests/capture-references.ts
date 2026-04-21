/**
 * Capture Reference Screenshots for Visual Regression Tests
 *
 * This utility captures baseline screenshots for all test cases defined
 * in visual-test.ts and saves them to tests/references/.
 *
 * Usage:
 *   npm run test:visual:capture
 *
 * This should be run after intentional UI changes to establish new baselines.
 */

import { chromium } from 'playwright';
import type { Browser, Page, BrowserContext } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Same test cases as in visual-test.ts
const TEST_CASES = [
  'main_screen_english',
  'main_screen_spanish',
  'main_screen_fahrenheit',
  'main_screen_24hr',
  'loading_screen',
  'wifi_splash_screen',
  'settings_display_tab_english',
  'settings_general_tab_spanish',
  'location_dialog',
  'reset_wifi_modal',
  'main_screen_night_mode',
];

const CONFIG = {
  vitePort: 5173,
  viteHost: 'localhost',
  screenWidth: 240,
  screenHeight: 320,
  displayScale: 2,
  referencesDir: join(__dirname, 'references'),
  headless: true,
};

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    // Ignore
  }
}

function startViteServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const vite = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';

    vite.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes(`Local:   http://localhost:${CONFIG.vitePort}`) ||
          stdout.includes(`ready in`)) {
        resolve(vite);
      }
    });

    vite.on('error', (err) => {
      reject(new Error(`Failed to start Vite: ${err.message}`));
    });

    setTimeout(() => {
      reject(new Error('Vite failed to start within 30 seconds'));
    }, 30000);
  });
}

function stopViteServer(vite: ChildProcess): void {
  if (vite && !vite.killed) {
    vite.kill('SIGTERM');
    setTimeout(() => {
      if (!vite.killed) vite.kill('SIGKILL');
    }, 5000);
  }
}

class CaptureRunner {
  private viteProcess: ChildProcess | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async run(): Promise<void> {
    console.log('\n=== Aura Simulator Reference Capture ===\n');

    try {
      await ensureDir(CONFIG.referencesDir);
      console.log(`[1/4] Starting Vite dev server...`);
      await this.startServer();

      console.log(`[2/4] Launching browser...`);
      await this.launchBrowser();

      console.log(`[3/4] Navigating to simulator...`);
      await this.navigateToApp();

      console.log(`[4/4] Capturing reference screenshots...\n`);
      await this.captureAll();

      console.log('✓ All reference images captured successfully!\n');
      console.log(`References saved to: ${CONFIG.referencesDir}\n`);
      console.log('You can now run: npm run test:visual\n');

    } finally {
      await this.cleanup();
    }
  }

  private async startServer(): Promise<void> {
    this.viteProcess = await startViteServer();
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
  }

  private async navigateToApp(): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');

    const url = `http://${CONFIG.viteHost}:${CONFIG.vitePort}/?testing=true`;
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForFunction(() => window.__AURA_TEST__);
    console.log('         App loaded and test API ready\n');
  }

  private async captureAll(): Promise<void> {
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testName = TEST_CASES[i];
      console.log(`  [${i + 1}/${TEST_CASES.length}] Capturing: ${testName}`);

      // Reload to reset state
      await this.page!.reload({ waitUntil: 'networkidle' });
      await this.page!.waitForFunction(() => window.__AURA_TEST__);

      const api = {
        setScreen: async (screen: string) => {
          await this.page!.evaluate((s) => window.__AURA_TEST__!.setScreen(s), screen);
          await this.page!.evaluate(() => window.__AURA_TEST__!.waitForStable(500));
        },
        setState: async (updates: Record<string, unknown>) => {
          await this.page!.evaluate((u) => window.__AURA_TEST__!.setState(u), updates);
          await this.page!.evaluate(() => window.__AURA_TEST__!.waitForStable(500));
        },
      };

      // Set fixed time for deterministic clock rendering
      const FIXED_TIMESTAMP = Date.UTC(2026, 2, 31, 14, 30, 0); // March 31, 2026 14:30 UTC
      await api.setState({ testNow: FIXED_TIMESTAMP });

      // Set up state based on test name
      switch (testName) {
        case 'main_screen_english':
          await this.setupMainScreenEnglish(api);
          break;
        case 'main_screen_spanish':
          await this.setupMainScreenSpanish(api);
          break;
        case 'main_screen_fahrenheit':
          await this.setupMainScreenFahrenheit(api);
          break;
        case 'main_screen_24hr':
          await this.setupMainScreen24hr(api);
          break;
        case 'loading_screen':
          await this.setupLoadingScreen(api);
          break;
        case 'wifi_splash_screen':
          await this.setupWifiSplash(api);
          break;
        case 'settings_display_tab_english':
          await this.setupSettingsDisplayTabEnglish(api);
          break;
        case 'settings_general_tab_spanish':
          await this.setupSettingsGeneralTabSpanish(api);
          break;
        case 'location_dialog':
          await this.setupLocationDialog(api);
          break;
        case 'reset_wifi_modal':
          await this.setupResetWifiModal(api);
          break;
        case 'main_screen_night_mode':
          await this.setupMainScreenNightMode(api);
          break;
        default:
          console.log(`         WARNING: No setup defined for ${testName}, skipping`);
          continue;
      }

      // Wait for render to stabilize
      await this.page!.evaluate(() => window.__AURA_TEST__!.render());
      await new Promise(resolve => setTimeout(resolve, 200));

      // Capture screenshot
      const buffer = await this.page!.screenshot({ type: 'png' });
      const filePath = join(CONFIG.referencesDir, `${testName}.png`);
      await fs.writeFile(filePath, buffer);
      console.log(`         ✓ Saved: ${testName}.png`);
    }
  }

  // State setup helpers
  private async setupMainScreenEnglish(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      settings: {
        useFahrenheit: false,
        use24Hour: false,
        language: 0,
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
        current: { temp: 18, feels_like: 16, code: 0, is_day: 1 },
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
  }

  private async setupMainScreenSpanish(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      settings: {
        useFahrenheit: false,
        use24Hour: false,
        language: 1,
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
        current: { temp: 22, feels_like: 24, code: 0, is_day: 1 },
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
  }

  private async setupMainScreenFahrenheit(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      settings: {
        useFahrenheit: true,
        use24Hour: false,
        language: 0,
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
        current: { temp: 64, feels_like: 61, code: 0, is_day: 1 },
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
  }

  private async setupMainScreen24hr(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      settings: {
        useFahrenheit: false,
        use24Hour: true,
        language: 0,
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
        current: { temp: 15, feels_like: 13, code: 0, is_day: 1 },
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
  }

  private async setupLoadingScreen(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      wifiConnected: true,
      weatherLoading: true,
      weatherData: null,
      lastWeatherUpdateMs: 0, // Doesn't matter, loading blocks periodic fetch
    });
    await api.setScreen('loading');
    // Freeze spinner at 0° for deterministic capture (matches visual-test.ts)
    await api.setState({
      testOverrides: { freezeSpinner: true, fixedSpinnerAngle: 0 }
    });
  }

  private async setupWifiSplash(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      wifiConnected: false,
      currentScreen: 'wifi_splash',
      weatherData: null,
      weatherLoading: false,
      lastWeatherUpdateMs: 0,
    });
  }

  private async setupSettingsDisplayTabEnglish(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
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
      activeSettingsTab: 'display',
      weatherData: {
        current: { temp: 18, feels_like: 16, code: 0, is_day: 1 },
        daily: [],
        hourly: [],
      },
    });
    await api.setScreen('settings');
  }

  private async setupSettingsGeneralTabSpanish(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
    await api.setState({
      settings: {
        useFahrenheit: true,
        use24Hour: true,
        language: 1,
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
      activeSettingsTab: 'general',
      weatherData: {
        current: { temp: 20, feels_like: 19, code: 1, is_day: 1 },
        daily: [],
        hourly: [],
      },
    });
    await api.setScreen('settings');
  }

  private async setupLocationDialog(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
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
  }

  private async setupResetWifiModal(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
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
  }

  private async setupMainScreenNightMode(api: { setScreen: (s: string) => Promise<void>; setState: (u: Record<string, unknown>) => Promise<void> }) {
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
      nightModeActive: true,
      testOverrides: { disableNightModeSync: true },
      weatherData: {
        current: {
          temp: 12,
          feels_like: 10,
          code: 0,
          is_day: 0,
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
  }

  private async cleanup(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    if (this.viteProcess) stopViteServer(this.viteProcess);
  }
}

// Run
const runner = new CaptureRunner();
runner.run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Capture failed:', err);
    process.exit(1);
  });
