/**
 * FileWatcher - Watches aura/aura.ino for changes and triggers hot reload
 *
 * This module uses chokidar to watch the Arduino source file for modifications.
 * When a change is detected (debounced), it triggers the AuraInoParser to
 * regenerate the constants file, then emits an event to notify the app.
 *
 * Usage:
 *   const watcher = new FileWatcher({
 *     onConstantsUpdated: (module) => console.log('Constants reloaded'),
 *     onError: (err) => console.error('Watcher error:', err)
 *   });
 *   watcher.start();
 *
 *   // Later
 *   watcher.stop();
 */

import chokidar from 'chokidar';
import { AuraInoParser } from '../parser/AuraInoParser.ts';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for relative path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Debug flag for verbose logging in development */
const DEBUG = import.meta.env?.DEV || import.meta.env?.VITE_DEBUG === 'true';

/**
 * Configuration for the file watcher
 */
export interface FileWatcherConfig {
  /** Path to aura.ino (default: ../aura/aura.ino) */
  auraInoPath?: string;
  /** Path where constants.generated.ts will be written (default: ./parser/constants.generated.ts) */
  outputPath?: string;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
  /** Callback when constants are regenerated */
  onConstantsUpdated: (modulePath: string, timestamp: number) => void;
  /** Callback on errors */
  onError?: (error: Error) => void;
  /** Callback when watching starts */
  onStart?: () => void;
  /** Callback when watching stops */
  onStop?: () => void;
}

/**
 * FileWatcher class
 */
export class FileWatcher {
  private config: FileWatcherConfig;
  private parser: AuraInoParser;
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isWatching: boolean = false;

  constructor(config: FileWatcherConfig) {
    // Allow overriding the aura.ino path via environment variable (useful for Docker)
    const envPath = process.env.AURA_INO_PATH;
    const defaultPath = join(__dirname, '..', '..', '..', 'aura', 'aura.ino');

    this.config = {
      auraInoPath: envPath ? join(envPath) : defaultPath,
      outputPath: join(__dirname, '..', 'renderer', 'constants.auto.ts'),
      debounceMs: 500,
      ...config,
    };

    this.parser = new AuraInoParser(this.config.auraInoPath);
  }

  /**
   * Start watching the aura.ino file
   */
  public start(): void {
    if (this.isWatching) {
      if (DEBUG) {
        console.debug('[FileWatcher] Already watching, skipping start');
      }
      return;
    }

    console.info('[FileWatcher] Starting file watcher...');
    if (DEBUG) {
      console.debug(`[FileWatcher] Watching: ${this.config.auraInoPath}`);
      console.debug(`[FileWatcher] Output: ${this.config.outputPath}`);
      console.debug(`[FileWatcher] Debounce: ${this.config.debounceMs}ms`);
    }

    try {
      this.watcher = chokidar.watch(this.config.auraInoPath!, {
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      });

      this.watcher.on('change', async (path) => {
        if (DEBUG) {
          console.debug(`[FileWatcher] Change detected in: ${path}`);
        }
        await this.handleChange();
      });

      this.watcher.on('error', (error) => {
        console.error('[FileWatcher] Watcher error:', error);
        this.config.onError?.(error);
      });

      this.watcher.on('ready', () => {
        console.info('[FileWatcher] Watcher ready, generating initial constants...');
        this.isWatching = true;
        this.config.onStart?.();

        // Generate initial constants file
        this.generateOnce();
      });

    } catch (error) {
      console.error('[FileWatcher] Failed to start watcher:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Stop watching
   */
  public stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      if (DEBUG) {
        console.debug('[FileWatcher] Cleared debounce timer');
      }
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    this.isWatching = false;
    console.info('[FileWatcher] File watcher stopped');
    this.config.onStop?.();
  }

  /**
   * Check if watcher is active
   */
  public isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Generate constants file immediately (used on startup)
   */
  private async generateOnce(): Promise<void> {
    try {
      const startTime = Date.now();
      if (DEBUG) {
        console.debug('[FileWatcher] Regenerating initial constants...');
      }

      await this.parser.generateFile(this.config.outputPath!);

      const duration = Date.now() - startTime;
      if (DEBUG) {
        console.debug(`[FileWatcher] Initial constants generated (${duration}ms)`);
      }

      this.config.onConstantsUpdated(this.config.outputPath!, Date.now());
    } catch (error) {
      console.error('[FileWatcher] Initial generation failed:', error);
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Handle file change event with debouncing
   */
  private async handleChange(): Promise<void> {
    // Clear any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      if (DEBUG) {
        console.debug('[FileWatcher] Cleared pending debounce');
      }
    }

    // Debounce: wait before processing
    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      if (DEBUG) {
        console.debug(`[FileWatcher] Debounce complete, regenerating constants...`);
      }

      try {
        const startTime = Date.now();
        await this.parser.generateFile(this.config.outputPath!);

        const duration = Date.now() - startTime;
        if (DEBUG) {
          console.debug(`[FileWatcher] Constants regenerated (${duration}ms)`);
        }

        // Notify listeners
        this.config.onConstantsUpdated(
          this.config.outputPath!,
          Date.now()
        );
      } catch (error) {
        console.error('[FileWatcher] Regeneration failed:', error);
        this.config.onError?.(error as Error);
      }
    }, this.config.debounceMs);
  }

  /**
   * Force a regeneration (useful for manual refresh)
   */
  public async forceRegenerate(): Promise<void> {
    if (DEBUG) {
      console.debug('[FileWatcher] Force regeneration requested');
    }
    try {
      const startTime = Date.now();
      await this.parser.generateFile(this.config.outputPath!);

      const duration = Date.now() - startTime;
      if (DEBUG) {
        console.debug(`[FileWatcher] Force regeneration completed (${duration}ms)`);
      }

      this.config.onConstantsUpdated(this.config.outputPath!, Date.now());
    } catch (error) {
      console.error('[FileWatcher] Force regeneration failed:', error);
      this.config.onError?.(error as Error);
    }
  }
}

/**
 * Factory function to create and start a file watcher
 */
export function createFileWatcher(config: FileWatcherConfig): FileWatcher {
  const watcher = new FileWatcher(config);
  watcher.start();
  return watcher;
}

// When run directly as a script: `node src/watcher/FileWatcher.ts`
// Start the watcher with default configuration
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const watcher = createFileWatcher({
    onConstantsUpdated: (modulePath, timestamp) => {
      console.info(`[CLI] Constants updated: ${modulePath}`);
    },
    onStart: () => {
      console.info('[CLI] File watcher started');
    },
    onStop: () => {
      console.info('[CLI] File watcher stopped');
    },
    onError: (err) => {
      console.error('[CLI] Error:', err);
      process.exit(1);
    },
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.info('[CLI] Shutting down...');
    watcher.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.info('[CLI] Shutting down...');
    watcher.stop();
    process.exit(0);
  });
}
