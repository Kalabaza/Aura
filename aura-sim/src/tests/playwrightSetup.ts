import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Starts the Vite dev server, launches a Playwright Chromium browser, and returns
 * the browser, page, and a cleanup function.
 */
export async function setupPlaywright() {
  const CONFIG = {
    vitePort: 5173,
    viteHost: 'localhost',
    screenWidth: 240,
    screenHeight: 320,
    displayScale: 2,
    headless: true,
    pageLoadTimeoutMs: 30000,
  } as const;

  function startViteServer(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const vite = spawn('npm', ['run', 'dev'], {
        cwd: __dirname,
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      vite.stdout.on('data', data => {
        stdout += data.toString();
        if (stdout.includes(`Local:   http://${CONFIG.viteHost}:${CONFIG.vitePort}`) || stdout.includes('ready in')) {
          resolve(vite);
        }
      });
      vite.stderr.on('data', data => console.error('[Vite]', data.toString().trim()));
      vite.on('error', err => reject(new Error(`Failed to start Vite: ${err.message}`)));
      setTimeout(() => reject(new Error('Vite failed to start within timeout')), CONFIG.pageLoadTimeoutMs);
    });
  }

  function stopViteServer(vite: ChildProcess) {
    if (vite && !vite.killed) {
      vite.kill('SIGTERM');
      setTimeout(() => { if (!vite.killed) vite.kill('SIGKILL'); }, 5000);
    }
  }

  const viteProcess = await startViteServer();
  // small wait for stability
  await new Promise(r => setTimeout(r, 2000));

  const browser: Browser = await chromium.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context: BrowserContext = await browser.newContext({
    viewport: {
      width: CONFIG.screenWidth * CONFIG.displayScale,
      height: CONFIG.screenHeight * CONFIG.displayScale,
    },
    timezoneId: 'UTC',
  });
  const page: Page = await context.newPage();

  const url = `http://${CONFIG.viteHost}:${CONFIG.vitePort}/?testing=true`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: CONFIG.pageLoadTimeoutMs });
  await page.waitForFunction(() => (window as any).__AURA_TEST__ && (window as any).__AURA_TEST__.waitForStable, { timeout: 10000 });

  async function close() {
    await context.close();
    await browser.close();
    stopViteServer(viteProcess);
  }

  return { browser, page, close } as const;
}
