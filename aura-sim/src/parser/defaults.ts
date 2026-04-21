import { ParsedDefaults } from './AuraInoParser';

export function extractDefaults(content: string, lines: string[]): ParsedDefaults {
  const lineRefs: Record<string, number> = {};
  const latMatch = content.match(/#define\s+LATITUDE_DEFAULT\s+"([^"]+)"/);
  lineRefs.latitude = latMatch ? content.substring(0, content.indexOf(latMatch[0])).split('\n').length : 0;
  const lonMatch = content.match(/#define\s+LONGITUDE_DEFAULT\s+"([^"]+)"/);
  lineRefs.longitude = lonMatch ? content.substring(0, content.indexOf(lonMatch[0])).split('\n').length : 0;
  const locMatch = content.match(/#define\s+LOCATION_DEFAULT\s+"([^"]+)"/);
  lineRefs.location = locMatch ? content.substring(0, content.indexOf(locMatch[0])).split('\n').length : 0;
  const brightMatch = content.match(/defaultValue:\s*(\d+)/);
  lineRefs.dayBrightness = brightMatch ? content.substring(0, content.indexOf(brightMatch[0])).split('\n').length : 0;
  const nightMatch = content.match(/defaultValue:\s*(\d+).*Night brightness/);
  lineRefs.nightBrightness = nightMatch ? content.substring(0, content.indexOf(nightMatch[0])).split('\n').length : 0;
  const timeoutMatch = content.match(/screenOffTimeoutIndex:\s*(\d+)/);
  const screenOffTimeoutIndex = timeoutMatch ? parseInt(timeoutMatch[1], 10) : 2;
  return {
    latitude: latMatch ? latMatch[1] : '51.5074',
    longitude: lonMatch ? lonMatch[1] : '-0.1278',
    location: locMatch ? locMatch[1] : 'London',
    dayBrightness: brightMatch ? parseInt(brightMatch[1], 10) : 128,
    nightBrightness: nightMatch ? parseInt(nightMatch[1], 10) : 64,
    currentLanguage: 0,
    screenOffTimeoutIndex,
    lineReferences: lineRefs,
  };
}
