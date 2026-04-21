/**
 * Performance Measurement Script for Aura Simulator
 *
 * Captures performance metrics over a 15-second interval while interacting with the UI.
 * Metrics: Frame timing (via manual rAF tracking), memory usage, and task durations.
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import { join } from 'path';

const CONFIG = {
  port: 5173, // Vite dev server port
  durationMs: 15000, // Measure for 15 seconds
  warmupMs: 2000, // Warm up period before measuring
  interactionInterval: 1000, // Simulate touch every N ms
};

async function measurePerformance(): Promise<void> {
  console.log('=== Aura Simulator Performance Measurement ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 480, height: 640 }, // 2x scale
  });

  const page = await context.newPage();

  //监听控制台日志以捕获应用日志
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[Browser]', msg.text());
    }
  });

  //监听页面性能指标
  let frameTimings: number[] = [];
  let lastFrameTime = Date.now();

  //注入frame计时器
  await page.evaluate(() => {
    (window as any).__frameTimes = [];
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(callback) {
      const start = performance.now();
      const id = originalRAF(function(timestamp) {
        const frameTime = performance.now() - start;
        (window as any).__frameTimes.push(frameTime);
        callback(timestamp);
      });
      return id;
    };
  });

  console.log('[1/3] Navigating to simulator...');
  await page.goto(`http://localhost:${CONFIG.port}/`, { waitUntil: 'networkidle' });

  //等待应用初始化
  await page.waitForFunction(() => (window as any).__AURA_TEST__ !== undefined, { timeout: 10000 });
  console.log('App loaded and test API ready.');

  //预热
  console.log(`[2/3] Warming up for ${CONFIG.warmupMs}ms...`);
  await new Promise(resolve => setTimeout(resolve, CONFIG.warmupMs));

  //开始测量
  console.log(`[3/3] Measuring performance for ${CONFIG.durationMs}ms...`);
  await page.evaluate(async (duration) => {
    const state = (window as any).__AURA_TEST__.getState();
    const start = Date.now();

    //模拟周期性交互以测试交互性能
    const interval = setInterval(() => {
      //随机点击屏幕中心区域
      const x = 80 + Math.random() * 80;
      const y = 100 + Math.random() * 100;
      (window as any).__AURA_TEST__.handleTouch(x, y);
    }, 500);

    //监控frame时间
    const frameTimes: number[] = [];
    const monitor = () => {
      if (Date.now() - start < duration) {
        requestAnimationFrame(monitor);
      }
    };
    requestAnimationFrame(monitor);

    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);

    //返回收集的指标
    const rawFrames = (window as any).__frameTimes || [];
    const recentFrames = rawFrames.slice(-Math.floor(duration / 16.67)); // approx last N frames
    return {
      frameCount: rawFrames.length,
      avgFrameTime: recentFrames.reduce((a:number,b:number)=>a+b,0) / recentFrames.length,
      maxFrameTime: Math.max(...recentFrames),
      minFrameTime: Math.min(...recentFrames),
      heapUsed: performance.memory?.usedJSHeapSize || 0,
      heapTotal: performance.memory?.totalJSHeapSize || 0,
    };
  }, CONFIG.durationMs).then((metrics: any) => {
    console.log('\n=== Performance Metrics ===');
    console.log(`Measurement Duration: ${CONFIG.durationMs}ms`);
    console.log(`Frames Captured: ${metrics.frameCount}`);
    console.log(`Average Frame Time: ${metrics.avgFrameTime.toFixed(2)}ms (${(1000/metrics.avgFrameTime).toFixed(1)} fps)`);
    console.log(`Max Frame Time: ${metrics.maxFrameTime.toFixed(2)}ms`);
    console.log(`Min Frame Time: ${metrics.minFrameTime.toFixed(2)}ms`);
    console.log(`JS Heap Used: ${(metrics.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`JS Heap Total: ${(metrics.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`\nInterpretation:`);
    console.log(`- Average frame time < 16.67ms indicates smooth 60fps rendering`);
    console.log(`- Max frame time spikes indicate potential jank/lag`);
    console.log(`- Heap should remain stable (no continuous growth)`);

    //评估
    const fps = 1000 / metrics.avgFrameTime;
    if (fps >= 55) {
      console.log(`\n✓ PERFORMANCE: EXCELLENT (${fps.toFixed(1)} fps)`);
    } else if (fps >= 45) {
      console.log(`\n✓ PERFORMANCE: GOOD (${fps.toFixed(1)} fps)`);
    } else if (fps >= 30) {
      console.log(`\n⚠ PERFORMANCE: FAIR (${fps.toFixed(1)} fps) - may feel slightly sluggish`);
    } else {
      console.log(`\n✗ PERFORMANCE: POOR (${fps.toFixed(1)} fps) - visible lag expected`);
    }
  });

  await browser.close();
}

//运行
let retryCount = 0;
const maxRetries = 3;
while (retryCount < maxRetries) {
  try {
    await measurePerformance();
    process.exit(0);
  } catch (error) {
    retryCount++;
    console.error(`Attempt ${retryCount} failed:`, error);
    if (retryCount === maxRetries) {
      console.error('All attempts failed. Please ensure dev server is running on port', CONFIG.port);
      process.exit(1);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
