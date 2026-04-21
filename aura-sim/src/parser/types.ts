export interface ParsedColor {
    name: string;
    value: string;
    line?: number;
    comment?: string;
}

export interface ParsedDimension {
    name: string;
    width: number;
    height: number;
    line: number;
}

export interface ParsedPosition {
    name: string;
    x: number;
    y: number;
    line: number;
}

export interface ParsedFont {
    name: string;
    size: number;
    line: number;
}

export interface ParsedDefaults {
    latitude: string;
    longitude: string;
    location: string;
    dayBrightness: number;
    nightBrightness: number;
    currentLanguage: number;
    screenOffTimeoutIndex: number;
    lineReferences: Record<string, number>;
}

export interface ParsedResult {
    colors: ParsedColor[];
    screen: { width: number; height: number };
    fonts: ParsedFont[];
    positions: ParsedPosition[];
    dimensions: ParsedDimension[];
    defaults: ParsedDefaults;
    timestamp: number;
}