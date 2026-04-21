/**
 * Aura Simulator - React Root Component
 *
 * This React component serves as the bridge between React's declarative model
 * and the imperative canvas-based rendering system in App.ts.
 */

import React, { useEffect, useRef, useState } from 'react';
import { initializeFonts } from './renderer/Fonts';
import { App, ScreenType } from './App';

// DEBUG mode - set to true to enable touch event logging
const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

// Display scale factor for visibility (2x = 480x640)
const DISPLAY_SCALE = 2;

// Expose test API on window when in testing mode
declare global {
  interface Window {
    __AURA_TEST__?: {
      app: App;
      setState: (updates: Partial<import('./state/AppState').AppState>) => void;
      setScreen: (screen: ScreenType) => void;
      getState: () => import('./state/AppState').AppState;
      render: () => void;
      waitForStable: (ms?: number) => Promise<void>;
    };
  }
}

const AppRoot: React.FC = () => {
  // Listen for screen wake events to force UI update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = () => setTick(t => t + 1);
    canvas.addEventListener('screen-wake', handler);
    return () => canvas.removeEventListener('screen-wake', handler);
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<App | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('wifi_splash');
  const [error, setError] = useState<string | null>(null);
  const [displayScale, setDisplayScale] = useState(DISPLAY_SCALE);
  // Dummy tick to force re‑render for countdown updates
  const [tick, setTick] = useState(0);
  // Periodic tick to update UI every second for timeout countdown
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Fonts are loaded via initializeFonts() inside initApp().

  // Initialize App controller
  useEffect(() => {
    let mounted = true;

    const initApp = async () => {
      try {
        // Wait for fonts to load
        await initializeFonts();
        console.info('[AppRoot] Fonts loaded successfully');
        if (!mounted) return;

        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas element not found');
        }

        // Create App instance
        const app = new App(canvas);
        appRef.current = app;

        // Configure display scaling (initial value)
        app.renderer.setScale(displayScale);
        app.renderer.applyScaleToElement();

        // Initialize and start render loop
        await app.init();
        console.info('[AppRoot] App initialization complete');
        appRef.current = app;
        setIsReady(true);
        setCurrentScreen(app.getCurrentScreen());
        app.startLoop();
        console.info('[AppRoot] Render loop running');

        // Expose test API on window for debugging and visual regression testing
        // In development, always expose; in production, only if explicitly requested
        if (import.meta.env.DEV || import.meta.env.VITE_TESTING === 'true' || window.location.search.includes('testing=true')) {
          window.__AURA_TEST__ = {
            app,
            setState: (updates) => app.updateState(updates),
            setScreen: (screen) => app.setScreen(screen),
            getState: () => app.getState(),
            render: () => app.render(),
            waitForStable: async (ms = 100) => {
              await new Promise(resolve => setTimeout(resolve, ms));
              // Force a render to ensure state is up to date
              app.render();
            }
          };
          if (DEBUG) {
            console.debug('[AppRoot] Test API exposed on window.__AURA_TEST__');
          }
        }

      } catch (err) {
        console.error('Failed to initialize simulator:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    initApp();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.stopLoop();
        appRef.current = null;
      }
    };
  }, []);

  // Sync display scale changes to renderer
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.setScale(displayScale);
      appRef.current.renderer.applyScaleToElement();
    }
  }, [displayScale]);

  // Poll for screen changes (debug UI)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!appRef.current) return;
      const screen = appRef.current.getCurrentScreen();
      setCurrentScreen(screen);
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, []); // Empty dependency array - poller runs for entire component lifetime

  // Error state
  if (error) {
    return (
      <div style={{
        color: '#ff6b6b',
        fontFamily: 'monospace',
        padding: '20px',
        background: '#2a2a2a',
        borderRadius: '8px',
        maxWidth: '480px',
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Initialization Error</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {/* Canvas container */}
      <div
        style={{
          border: '2px solid #333',
          borderRadius: '4px',
          overflow: 'hidden',
          background: '#000',
          width: `${240 * displayScale}px`,
          height: `${320 * displayScale}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            imageRendering: 'pixelated',
            display: 'block',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            if (!appRef.current) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            // Convert click coordinates to device coordinates (0-239, 0-319)
            const x = Math.floor((e.clientX - rect.left) / displayScale);
            const y = Math.floor((e.clientY - rect.top) / displayScale);
            // Clamp to valid range
            const clampedX = Math.max(0, Math.min(239, x));
            const clampedY = Math.max(0, Math.min(319, y));
            if (DEBUG) {
              console.debug('[AppRoot] Touch at', { x: clampedX, y: clampedY });
            }
            appRef.current.handleTouch(clampedX, clampedY);
          }}
        />
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: `${240 * displayScale}px`,
        color: '#ccc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${11 * displayScale}px`,
      }}>
        {/* Scale selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ minWidth: '60px' }}>Scale:</span>
          {[1, 2, 3].map((scale) => (
            <button
              key={scale}
              onClick={() => setDisplayScale(scale)}
              style={{
                padding: '4px 12px',
                background: displayScale === scale ? '#4c8cb9' : '#333',
                color: displayScale === scale ? 'white' : '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 'inherit',
              }}
            >
              {scale}x
            </button>
          ))}
          {/* Timeout countdown display */}
          {appRef.current && (() => {
            const state = appRef.current.getState();
            const screen = state.currentScreen;
            if (screen === 'wifi_splash' || screen === 'loading') return null;
            const now = state.testNow ?? Date.now();
            const elapsedSec = Math.ceil((now - state.lastInteractionMs) / 1000);
            const timeout = state.settings.screenOffTimeout;
            const remaining = Math.max(0, timeout - elapsedSec);
            const enabled = state.settings.useScreenOff;
            const style = { marginLeft: '8px', color: enabled ? '#ccc' : 'transparent' };
            return <span style={style}>ScreenOff: {timeout}/{remaining}s</span>;
          })()}
        </div>

          {/* Screen selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ minWidth: '60px' }}>Screen:</span>
          <select
            value={currentScreen}
            onChange={(e) => {
              const screen = e.target.value as ScreenType;
              setCurrentScreen(screen);
              if (appRef.current) {
                appRef.current.setScreen(screen);
              }
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: '#333',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: 'inherit',
            }}
          >
            <option value="loading">Loading Spinner</option>
            <option value="main">Main Screen</option>
            <option value="wifi_splash">WiFi Splash</option>
            <option value="settings">Settings</option>
            <option value="location">Location Search</option>
            <option value="reset_wifi">Reset WiFi Modal</option>
          </select>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => {
              if (appRef.current) {
                appRef.current.updateState({ wifiConnected: true });
                if (!appRef.current.getState().weatherData) {
                  appRef.current.setScreen('loading');
                } else {
                  appRef.current.setScreen('main');
                }
              }
            }}
            style={{
              padding: '4px 12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'inherit',
            }}
          >
            Simulate WiFi
          </button>
          <button
            onClick={() => {
              if (appRef.current) {
                appRef.current.updateState({ wifiConnected: false });
                appRef.current.setScreen('wifi_splash');
              }
            }}
            style={{
              padding: '4px 12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'inherit',
            }}
          >
            Disconnect WiFi
          </button>
          <a
            href="./test-icons.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 12px',
              background: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'inherit',
            }}
          >
            Test Icons
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        color: '#666',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
        textAlign: 'center',
        maxWidth: `${240 * displayScale}px`,
        lineHeight: '1.4',
      }}>
        Aura ESP32 Simulator - Canvas rendering at 240×320 native resolution
      </div>
    </div>
  );
};

export default AppRoot;
