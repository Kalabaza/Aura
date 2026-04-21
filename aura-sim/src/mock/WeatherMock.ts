/**
 * Weather Mock Service for Aura Simulator
 *
 * Provides realistic weather data without making real HTTP calls.
 * Generates synthetic weather based on latitude, longitude, and location name.
 *
 * Features:
 * - Deterministic per location (same location gives consistent weather)
 * - Varies by time of day (day/night icons)
 * - Simulates network latency (500-1500ms)
 * - Supports preset city profiles with distinct weather patterns
 */

import {
  WeatherData,
  CurrentWeather,
  DailyForecast,
  HourlyForecast,
} from '../state/AppState';

/**
 * Climate profile adjustments for specific cities.
 * Offsets are applied on top of the latitude-based climate model.
 */
const CITY_PROFILES: Record<string, { tempOffset: number; rainBias: number }> = {
  london: { tempOffset: -3, rainBias: 0.2 },
  new_york: { tempOffset: 0, rainBias: 0.1 },
  newyork: { tempOffset: 0, rainBias: 0.1 },
  nyc: { tempOffset: 0, rainBias: 0.1 },
  tokyo: { tempOffset: 2, rainBias: 0.1 },
  dubai: { tempOffset: 15, rainBias: -0.3 },
  singapore: { tempOffset: 5, rainBias: 0.2 },
  sydney: { tempOffset: 5, rainBias: 0 },
  paris: { tempOffset: -2, rainBias: 0.1 },
  berlin: { tempOffset: -2, rainBias: 0.1 },
  madrid: { tempOffset: 2, rainBias: -0.1 },
  rome: { tempOffset: 4, rainBias: -0.1 },
  moscow: { tempOffset: -5, rainBias: 0.1 },
};

/**
 * Base weights for WMO weather codes (sum to 1). These are typical global frequencies.
 * Codes: 0=clear, 1-3=cloudy, 45/48=fog, 51-57=drizzle/sleet, 61-67=rain, 71-86=snow, 95-99=thunderstorm
 */
const BASE_WEIGHTS: [number, number][] = [
  [0, 0.2],
  [1, 0.1],
  [2, 0.1],
  [3, 0.1],
  [45, 0.02],
  [48, 0.02],
  [51, 0.05],
  [53, 0.05],
  [55, 0.03],
  [56, 0.01],
  [57, 0.01],
  [61, 0.08],
  [63, 0.06],
  [65, 0.04],
  [66, 0.02],
  [67, 0.01],
  [71, 0.03],
  [73, 0.03],
  [75, 0.02],
  [77, 0.02],
  [80, 0.04],
  [81, 0.03],
  [82, 0.02],
  [85, 0.02],
  [86, 0.01],
  [95, 0.02],
  [96, 0.01],
  [99, 0.01],
];

export class WeatherMock {
  /**
   * Simulates a network request to fetch weather data.
   * Resolves after a random delay (500-1500ms) with mock weather.
   */
  static async updateWeather(
    latitude: number,
    longitude: number,
    locationName: string
  ): Promise<WeatherData> {
    const delayMs = 500 + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return this.generateMockWeather(latitude, longitude, locationName);
  }

  /**
   * Generates a complete WeatherData object for given coordinates and location.
   * Deterministic based on location name and current date.
   */
  static generateMockWeather(
    latitude: number,
    longitude: number,
    locationName: string
  ): WeatherData {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const currentHour = now.getHours();

    // Climate model: base annual mean temperature from latitude
    const absLat = Math.abs(latitude);
    let baseTemp = 45 - absLat * 0.5;  // increased from 30 to 45 for realistic positive temps

    // Seasonal offset (northern/southern hemisphere)
    const isNorthern = latitude >= 0;
    let seasonalOffset: number;
    if (isNorthern) {
      seasonalOffset = Math.sin((month - 3) * Math.PI / 6) * 15;
    } else {
      seasonalOffset = Math.sin((month + 3) * Math.PI / 6) * 15;
    }
    baseTemp += seasonalOffset;

    // Location-specific profile (lookup by normalized name)
    const normalizedName = locationName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const profile = CITY_PROFILES[normalizedName] || { tempOffset: 0, rainBias: 0 };

    // Additional unique offset for this location based on its name (so different cities at similar latitude differ)
    const locationSeed = this.hashStringToRange(locationName.toLowerCase());
    baseTemp += profile.tempOffset + (locationSeed - 0.5) * 5;

    // Diurnal temperature range (difference between daily high and low)
    const tempRange = 8 + locationSeed * 6;

    // Generate 7-day daily forecast
    const daily: DailyForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(year, month, day + i);
      const dateStr = date.toISOString().split('T')[0];
      const daySeed = this.hashStringToRange(locationName + dateStr);
      // Use daytime (1) for future days; for today we'll use current is_day separately
      const code = this.selectWeatherCode(daySeed, 1, profile.rainBias);

      const dailyVariation = (daySeed - 0.5) * 10;
      const high = baseTemp + tempRange / 2 + dailyVariation;
      const low = baseTemp - tempRange / 2 + dailyVariation * 0.5;

      daily.push({
        day: i,
        date: dateStr,
        high,
        low,
        code,
      });
    }

    // Current weather
    const isDayCurrent = currentHour >= 6 && currentHour < 20 ? 1 : 0;
    const today = daily[0];
    let currentTemp: number;
    if (isDayCurrent) {
      const riseFactor = Math.min(1, (currentHour - 6) / 8);
      currentTemp = today.low + (today.high - today.low) * riseFactor;
    } else {
      if (currentHour >= 20) {
        const fallFactor = 1 - Math.min(1, (currentHour - 20) / 8);
        currentTemp = today.low + (today.high - today.low) * 0.3 * fallFactor;
      } else {
        // 0-5am: gradual cooling, approximate
        currentTemp = (today.low + today.high) / 2;
      }
    }
    const feels_like = currentTemp + (locationSeed - 0.5) * 4;

    const current: CurrentWeather = {
      temp: currentTemp,
      feels_like,
      code: today.code,
      is_day: isDayCurrent,
    };

    // Hourly forecast: next 7 hours
    const hourly: HourlyForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const h = (currentHour + i) % 24;
      const hourIsDay = h >= 6 && h < 20;
      const hourSeed = this.hashStringToRange(
        locationName + daily[0].date + h.toString()
      );
      let code: number;
      if (i === 0) {
        code = today.code;
      } else {
        code = this.selectWeatherCode(hourSeed, hourIsDay ? 1 : 0, profile.rainBias);
      }

      // Temperature interpolation
      let hourTemp: number;
      if (hourIsDay) {
        const riseFactor = Math.min(1, (h - 6) / 8);
        hourTemp = today.low + (today.high - today.low) * riseFactor;
      } else {
        if (h >= 20) {
          const fallFactor = 1 - Math.min(1, (h - 20) / 8);
          hourTemp = today.low + (today.high - today.low) * 0.3 * fallFactor;
        } else {
          hourTemp = (today.low + today.high) / 2;
        }
      }

      // Precipitation probability based on code
      let precipitation = 0;
      if (code >= 51 && code < 56) precipitation = 30 + hourSeed * 20;
      else if (code >= 61 && code < 66) precipitation = 60 + hourSeed * 30;
      else if (code >= 80 && code < 83) precipitation = 50 + hourSeed * 30;
      else precipitation = hourSeed * 15;

      hourly.push({
        hour: h,
        temp: hourTemp,
        code,
        precipitation,
        is_day: hourIsDay ? 1 : 0,
      });
    }

    return { current, daily, hourly };
  }

  /**
   * FNV-1a 32-bit hash converted to a float in [0,1).
   * Used to generate deterministic pseudo-random values from a string.
   */
  private static hashStringToRange(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  /**
   * Selects a weather code based on weighted probabilities.
   * Adjusts weights by rainBias to favor or disfavor precipitation.
   */
  private static selectWeatherCode(
    seed: number,
    isDay: number,
    rainBias: number = 0
  ): number {
    // Copy base weights
    let weights = BASE_WEIGHTS.map((pair) => [pair[0], pair[1]] as [number, number]);

    // Apply city-specific rain bias
    if (rainBias !== 0) {
      for (let i = 0; i < weights.length; i++) {
        const [code, w] = weights[i];
        if (code >= 61 && code < 66) {
          weights[i][1] = Math.max(0.005, w * (1 + rainBias));
        } else if (code >= 80 && code < 83) {
          weights[i][1] = Math.max(0.005, w * (1 + rainBias));
        } else if (code === 0) {
          weights[i][1] = Math.max(0.005, w * (1 - rainBias));
        } else if (code >= 1 && code <= 3) {
          weights[i][1] = Math.max(0.005, w * (1 - rainBias * 0.5));
        }
      }
    }

    // Normalize
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    weights = weights.map(([code, w]) => [code, w / total] as [number, number]);

    // Select by cumulative probability
    let r = seed;
    for (const [code, weight] of weights) {
      if (r < weight) return code;
      r -= weight;
    }
    return 0; // fallback to clear
  }
}
