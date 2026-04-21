/**
 * Preferences - A browser-localStorage backed implementation of Arduino's Preferences library.
 *
 * Mirrors the ESP32 Preferences library API for use in the Aura simulator.
 * Data is stored in browser's localStorage with namespacing support.
 *
 * Arduino Preferences API reference:
 * - begin(namespace, readonly) - open a preference namespace
 * - getString(key, defaultValue) - get string value
 * - getInt(key, defaultValue) - get signed integer
 * - getUInt(key, defaultValue) - get unsigned integer
 * - getBool(key, defaultValue) - get boolean
 * - putString(key, value) - put string value
 * - putInt(key, value) - put signed integer
 * - putUInt(key, value) - put unsigned integer
 * - putBool(key, value) - put boolean
 * - clear() - remove all keys in current namespace
 * - end() - close namespace (no-op in this implementation)
 */

/**
 * Internal storage structure for a namespace
 */
interface NamespaceData {
  [key: string]: string; // All values stored as strings
}

const DEBUG = import.meta.env?.DEV || import.meta.env?.VITE_DEBUG === 'true';

/**
 * Global storage map - in memory cache of localStorage
 */
const storageMap: Map<string, NamespaceData> = new Map();

/**
 * Wrapper around localStorage that provides namespaced key-value storage.
 * Mimics Arduino's Preferences library for the simulator.
 */
export class Preferences {
  private namespace: string = '';
  private readonly: boolean = false;
  private data: NamespaceData = {};

  /**
   * Begin a preferences namespace.
   * @param namespace - The namespace name (e.g., "weather")
   * @param readonly - If true, opens in read-only mode (still reads from localStorage)
   */
  begin(namespace: string, readonly: boolean = false): void {
    this.namespace = namespace;
    this.readonly = readonly;

    // Load namespace data from localStorage
    const storageKey = this.getStorageKey();
    let nsData = storageMap.get(storageKey);

    if (nsData === undefined) {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          nsData = JSON.parse(raw);
        } catch (e) {
          // Corrupted preferences - warn but continue with empty namespace
          console.warn('[Preferences] Failed to parse preferences for namespace:', this.namespace, e);
          nsData = {};
        }
      } else {
        nsData = {};
      }
      storageMap.set(storageKey, nsData!);
    }

    this.data = nsData!;
  }

  /**
   * End the current namespace session.
   * In Arduino library, this writes changes to NVS. In our implementation,
   * changes are written immediately to localStorage on each put*() call.
   */
  end(): void {
    this.data = {};
    this.namespace = '';
    this.readonly = false;
  }

  /**
   * Get a string value.
   * @param key - The key name
   * @param defaultValue - Default value if key not found
   */
  getString(key: string, defaultValue: string = ''): string {
    if (this.data[key] !== undefined) {
      return this.data[key];
    }
    return defaultValue;
  }

  /**
   * Get an integer value (signed 32-bit).
   * @param key - The key name
   * @param defaultValue - Default value if key not found
   */
  getInt(key: string, defaultValue: number = 0): number {
    if (this.data[key] !== undefined) {
      const val = parseInt(this.data[key], 10);
      return isNaN(val) ? defaultValue : val;
    }
    return defaultValue;
  }

  /**
   * Get an unsigned integer value (32-bit).
   * @param key - The key name
   * @param defaultValue - Default value if key not found
   */
  getUInt(key: string, defaultValue: number = 0): number {
    if (this.data[key] !== undefined) {
      const val = parseInt(this.data[key], 10);
      // Interpret as unsigned (ideally we'd use >>> 0, but parseInt returns signed)
      return isNaN(val) ? defaultValue : Math.max(0, val);
    }
    return defaultValue;
  }

  /**
   * Get a boolean value.
   * @param key - The key name
   * @param defaultValue - Default value if key not found
   */
  getBool(key: string, defaultValue: boolean = false): boolean {
    if (this.data[key] !== undefined) {
      const val = this.data[key];
      // In Arduino, booleans are stored as 0/1 integers or "true"/"false" strings
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      // Fallback: try to parse
      const parsed = parseInt(val, 10);
      return !isNaN(parsed) ? parsed !== 0 : defaultValue;
    }
    return defaultValue;
  }

  /**
   * Put a string value.
   * @param key - The key name
   * @param value - The string value to store
   */
  putString(key: string, value: string): void {
    if (this.readonly) {
      throw new Error(`Preferences namespace '${this.namespace}' is read-only`);
    }
    this.data[key] = value;
    this.persist();
  }

  /**
   * Put a signed integer value.
   * @param key - The key name
   * @param value - The integer value to store
   */
  putInt(key: string, value: number): void {
    if (this.readonly) {
      throw new Error(`Preferences namespace '${this.namespace}' is read-only`);
    }
    this.data[key] = value.toString();
    this.persist();
  }

  /**
   * Put an unsigned integer value.
   * @param key - The key name
   * @param value - The unsigned integer value to store
   */
  putUInt(key: string, value: number): void {
    if (this.readonly) {
      throw new Error(`Preferences namespace '${this.namespace}' is read-only`);
    }
    // Ensure it's non-negative
    const unsignedVal = Math.max(0, Math.floor(value));
    this.data[key] = unsignedVal.toString();
    this.persist();
  }

  /**
   * Put a boolean value.
   * @param key - The key name
   * @param value - The boolean value to store
   */
  putBool(key: string, value: boolean): void {
    if (this.readonly) {
      throw new Error(`Preferences namespace '${this.namespace}' is read-only`);
    }
    this.data[key] = value ? 'true' : 'false';
    this.persist();
  }

  /**
   * Clear all keys in the current namespace.
   * This does NOT write through to localStorage (consistent with Arduino behavior?).
   * In Arduino, clear() removes all keys from NVS in the opened namespace.
   * We'll remove from both memory cache and localStorage.
   */
  clear(): void {
    if (this.readonly) {
      throw new Error(`Preferences namespace '${this.namespace}' is read-only`);
    }
    this.data = {};
    const storageKey = this.getStorageKey();
    localStorage.removeItem(storageKey);
    storageMap.delete(storageKey);
  }

  /**
   * Check if a key exists in the current namespace.
   * (Optional method not in Arduino API but useful)
   */
  hasKey(key: string): boolean {
    return this.data[key] !== undefined;
  }

  /**
   * Get all keys in the current namespace.
   * (Optional method not in Arduino API but useful)
   */
  getKeys(): string[] {
    return Object.keys(this.data);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get the localStorage key for the current namespace.
   * Uses prefix "aura-" to avoid conflicts: "aura-${namespace}"
   */
  private getStorageKey(): string {
    if (!this.namespace) {
      throw new Error('Preferences namespace not set. Call begin() first.');
    }
    return `aura-${this.namespace}`;
  }

  /**
   * Write current namespace data to localStorage.
   * Also updates the in-memory cache.
   */
  private persist(): void {
    const storageKey = this.getStorageKey();
    const raw = JSON.stringify(this.data);
    try {
      localStorage.setItem(storageKey, raw);
      storageMap.set(storageKey, this.data);
    } catch (e) {
      console.error(`Failed to save preferences for namespace '${this.namespace}':`, e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Clear storage or reduce data.');
      }
    }
  }
}

/**
 * Factory function to create and initialize a Preferences instance.
 * Provides a convenient way to get a ready-to-use Preferences object.
 * @param namespace - The namespace to open
 * @param readonly - Read-only mode flag
 * @returns A new Preferences instance
 */
export function createPreferences(namespace: string, readonly: boolean = false): Preferences {
  const prefs = new Preferences();
  prefs.begin(namespace, readonly);
  return prefs;
}

/**
 * Settings namespace key used by Aura
 */
export const SETTINGS_NAMESPACE = 'weather';
