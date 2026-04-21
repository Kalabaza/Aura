/**
 * Quick Performance Test
 * - Measures JS heap before and after 100 clicks
 * - Measures average input-to-render latency via wrapped handleTouch
 */

import { chromium } from 'playwright';

async function run(): Promise<void> {
  const url = 'http://localhost:5173/';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 480, height: 640 },
  });
  const page = await context.newPage();

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (window as any).__AURA_TEST__ !== undefined, { timeout: 10000 });
  console.log('App ready');

  // Wait for initial render
  await new Promise(r => setTimeout(r, 1000));

  // Get initial heap
  const heap1 = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
  console.log(`Initial heap: ${(heap1 / 1024 / 1024).toFixed(2)} MB`);

  // Wrap app.handleTouch to measure execution time
  await page.evaluate(() => {
    const testAPI = (window as any).__AURA_TEST__;
    if (!testAPI || !testAPI.app || typeof testAPI.app.handleTouch !== 'function') return;
    const app = testAPI.app;
    const original = app.handleTouch.bind(app);
    let count = 0;
    let total = 0;
    app.handleTouch = function(x: number, y: number): boolean {
      const start = performance.now();
      const result = original(x, y);
      const elapsed = performance.now() - start;
      count++;
      total += elapsed;
      if (count >= 100) {
        (window as any).__PERF_RESULTS__ = { avgLatency: total / count, total, count };
      }
      return result;
    };
  });

  // Perform 100 clicks on the canvas at random positions
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas element not found');

  const DISPLAY_SCALE = 2; // 2x scaling
  const deviceWidth = 240;  // logical device width
  const deviceHeight = 320; // logical device height

  for (let i = 0; i < 100; i++) {
    const dx = Math.floor(Math.random() * deviceWidth) * DISPLAY_SCALE;
    const dy = Math.floor(Math.random() * deviceHeight) * DISPLAY_SCALE;
    await canvas.click({ position: { x: dx, y: dy } });
    await new Promise(r => setTimeout(r, 5)); // 5ms between clicks
  }

  // Wait for aggregation
  await new Promise(r => setTimeout(r, 200));
  const perfResults = await page.evaluate(() => (window as any).__PERF_RESULTS__);
  if (perfResults) {
    console.log(`\n=== Input Latency (100 clicks) ===`);
    console.log(`Average input processing time: ${perfResults.avgLatency.toFixed(2)}ms`);
    console.log(`(Lower is better; <5ms is excellent, <10ms good)`);
  } else {
    console.log('No latency results collected (check injection)');
  }

  // Get final heap
  const heap2 = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0);
  console.log(`\nFinal heap: ${(heap2 / 1024 / 1024).toFixed(2)} MB`);
  const heapDiff = heap2 - heap1;
  console.log(`Heap change after 100 clicks: ${heapDiff > 0 ? '+' : ''}${heapDiff} bytes (${(heapDiff/1024).toFixed(2)} KB)`);
  if (Math.abs(heapDiff) < 1024 * 100) { // less than 100KB
    console.log('✓ Memory stable (no significant growth)');
  } else {
    console.log('⚠ Memory increased noticeably - investigate potential leak');
  }

  console.log('\n=== Manual Frame Rate Check ===');
  console.log('To measure frame times:');
  console.log('1. Open the simulator in Chrome (http://localhost:5173)');
  console.log('2. Open DevTools (F12) → Performance tab');
  console.log('3. Click Record, interact for 30s, click Stop');
  console.log('4. Check FPS chart; should be near 60fps with no long frames');

  await browser.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
