#!/usr/bin/env python3
"""
Robust extractor for LVGL icon/image data from C files.
Generates aura-sim/src/assets/icons.ts with correct TypeScript exports.
"""

import re
from pathlib import Path

# Base paths
AURA_SRC = Path(__file__).parent.parent.parent / 'aura' / 'src'
OUTPUT_TS = Path(__file__).parent.parent / 'src' / 'assets' / 'icons.ts'

# All icon/image files to process (without .c extension)
FILES = [
    'icon_blizzard', 'icon_blowing_snow', 'icon_clear_night', 'icon_cloudy',
    'icon_drizzle', 'icon_flurries', 'icon_haze_fog_dust_smoke', 'icon_heavy_rain',
    'icon_heavy_snow', 'icon_isolated_scattered_tstorms_day', 'icon_isolated_scattered_tstorms_night',
    'icon_mostly_clear_night', 'icon_mostly_cloudy_day', 'icon_mostly_cloudy_night',
    'icon_mostly_sunny', 'icon_partly_cloudy', 'icon_partly_cloudy_night',
    'icon_scattered_showers_day', 'icon_scattered_showers_night', 'icon_showers_rain',
    'icon_sleet_hail', 'icon_snow_showers_snow', 'icon_strong_tstorms',
    'icon_sunny', 'icon_tornado', 'icon_wintry_mix_rain_snow',
    'image_blizzard', 'image_blowing_snow', 'image_clear_night', 'image_cloudy',
    'image_drizzle', 'image_flurries', 'image_haze_fog_dust_smoke', 'image_heavy_rain',
    'image_heavy_snow', 'image_isolated_scattered_tstorms_day', 'image_isolated_scattered_tstorms_night',
    'image_mostly_clear_night', 'image_mostly_cloudy_day', 'image_mostly_cloudy_night',
    'image_mostly_sunny', 'image_partly_cloudy', 'image_partly_cloudy_night',
    'image_scattered_showers_day', 'image_scattered_showers_night', 'image_showers_rain',
    'image_sleet_hail', 'image_snow_showers_snow', 'image_strong_tstorms',
    'image_sunny', 'image_tornado', 'image_wintry_mix_rain_snow'
]

def extract_data_array(content: str, name: str):
    """Extract raw bytes from the *_map[] array initializer."""
    # Find the start of the array: look for '{name}_map[] = {'
    start_marker = f'{name}_map[] = {{'
    start_idx = content.find(start_marker)
    if start_idx == -1:
        raise ValueError(f'Array marker not found: {start_marker}')
    # Find the opening brace after the equals
    open_brace = content.find('{', start_idx)
    if open_brace == -1:
        raise ValueError('Opening brace not found')
    # Find the closing brace of this initializer (the first '};' after open_brace)
    closebrace = content.find('};', open_brace)
    if closebrace == -1:
        raise ValueError('Closing brace not found')
    # Extract the text between braces (exclude the braces)
    inner = content[open_brace+1 : closebrace]
    # Extract all hex numbers (0x00, 0xA0, etc.)
    hex_strs = re.findall(r'0x[0-9a-fA-F]{1,2}', inner)
    bytes_list = [int(h, 16) for h in hex_strs]
    return bytes_list

def extract_header_info(content: str, name: str):
    """Extract width, height, stride, and format from the lv_image_dsc_t struct."""
    # Find the struct: it may be declared as 'const lv_image_dsc_t name = {'
    struct_marker = f'lv_image_dsc_t {name}'
    idx = content.find(struct_marker)
    if idx == -1:
        # Try with 'const' preceding
        struct_marker = f'const lv_image_dsc_t {name}'
        idx = content.find(struct_marker)
        if idx == -1:
            raise ValueError(f'Struct not found: {name}')
    # Find the opening brace after the equals
    open_brace = content.find('{', idx)
    if open_brace == -1:
        raise ValueError('Struct opening brace not found')
    closebrace = content.find('};', open_brace)
    if closebrace == -1:
        raise ValueError('Struct closing brace not found')
    struct_body = content[open_brace+1 : closebrace]
    # Parse fields
    w_match = re.search(r'\.header\.w\s*=\s*(\d+)', struct_body)
    h_match = re.search(r'\.header\.h\s*=\s*(\d+)', struct_body)
    stride_match = re.search(r'\.header\.stride\s*=\s*(\d+)', struct_body)
    cf_match = re.search(r'\.header\.cf\s*=\s*LV_COLOR_FORMAT_(\w+)', struct_body)
    if not (w_match and h_match and stride_match and cf_match):
        raise ValueError(f'Header fields not found for {name}')
    width = int(w_match.group(1))
    height = int(h_match.group(1))
    stride = int(stride_match.group(1))
    format_name = cf_match.group(1)  # e.g., 'RGB565A8'
    return width, height, stride, format_name

def parse_c_file(base_name: str):
    """Parse a single C file and return icon metadata and data."""
    c_file = AURA_SRC / f'{base_name}.c'
    if not c_file.exists():
        print(f'⚠ Missing: {c_file}')
        return None
    content = c_file.read_text()
    try:
        # Extract data bytes
        data = extract_data_array(content, base_name)
        # Extract header info
        width, height, stride, fmt = extract_header_info(content, base_name)
        # Validate data length
        expected = stride * height + width * height
        if len(data) != expected:
            print(f'⚠ {base_name}: data length {len(data)} != expected {expected}')
        return {
            'name': base_name,
            'width': width,
            'height': height,
            'stride': stride,
            'format': fmt,
            'data': data
        }
    except Exception as e:
        print(f'✗ {base_name}: {e}')
        return None

def format_hex_bytes(data: list, bytes_per_line: int = 20) -> list:
    """Format data bytes as hex strings for output."""
    return [f'0x{b:02x}' for b in data]

def generate_typescript(icons: list) -> str:
    lines = [
        '// Auto-generated by scripts/extract_icons.py',
        '// DO NOT EDIT - run the extraction script instead',
        '',
        '// Weather icon images for Aura simulator',
        '// Each constant is an LVGL RGB565A8 image with metadata',
        ''
    ]
    for icon in icons:
        if icon is None:
            continue
        lines.append(f'export const {icon["name"]} = {{')
        lines.append(f'  width: {icon["width"]},')
        lines.append(f'  height: {icon["height"]},')
        lines.append(f'  stride: {icon["stride"]},')
        lines.append(f"  format: '{icon["format"]}' as const,")
        lines.append('  data: new Uint8Array([')
        hex_vals = format_hex_bytes(icon['data'])
        # Write in chunks of 20 per line
        for i in range(0, len(hex_vals), 20):
            chunk = hex_vals[i:i+20]
            line = '    ' + ', '.join(chunk) + ','
            lines.append(line)
        lines.append('  ]),')
        lines.append('};')
        lines.append('')
    lines.append(f'// Total icons: {len([i for i in icons if i])}')
    return '\n'.join(lines)

def main():
    print('Extracting LVGL icons from C files...\n')
    icons = []
    for file in FILES:
        icon = parse_c_file(file)
        icons.append(icon)
    success_count = sum(1 for i in icons if i is not None)
    print(f'\nParsed {success_count}/{len(FILES)} files successfully')
    # Generate TypeScript
    ts_content = generate_typescript(icons)
    OUTPUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_TS.write_text(ts_content)
    print(f'✓ icons.ts written ({success_count} exports)')

if __name__ == '__main__':
    main()
