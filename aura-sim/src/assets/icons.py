#!/usr/bin/env python3
import re, pathlib, sys

# From aura-sim/src/assets/icons.py -> go up 4 levels to repo root, then into aura/src
AURA_SRC = pathlib.Path(__file__).parent.parent.parent.parent / 'aura' / 'src'
OUTPUT_TS = pathlib.Path(__file__).parent / 'icons.ts'

FILES = [
'icon_blizzard','icon_blowing_snow','icon_clear_night','icon_cloudy','icon_drizzle','icon_flurries','icon_haze_fog_dust_smoke','icon_heavy_rain','icon_heavy_snow','icon_isolated_scattered_tstorms_day','icon_isolated_scattered_tstorms_night','icon_mostly_clear_night','icon_mostly_cloudy_day','icon_mostly_cloudy_night','icon_mostly_sunny','icon_partly_cloudy','icon_partly_cloudy_night','icon_scattered_showers_day','icon_scattered_showers_night','icon_showers_rain','icon_sleet_hail','icon_snow_showers_snow','icon_strong_tstorms','icon_sunny','icon_tornado','icon_wintry_mix_rain_snow',
'image_blizzard','image_blowing_snow','image_clear_night','image_cloudy','image_drizzle','image_flurries','image_haze_fog_dust_smoke','image_heavy_rain','image_heavy_snow','image_isolated_scattered_tstorms_day','image_isolated_scattered_tstorms_night','image_mostly_clear_night','image_mostly_cloudy_day','image_mostly_cloudy_night','image_mostly_sunny','image_partly_cloudy','image_partly_cloudy_night','image_scattered_showers_day','image_scattered_showers_night','image_showers_rain','image_sleet_hail','image_snow_showers_snow','image_strong_tstorms','image_sunny','image_tornado','image_wintry_mix_rain_snow'
]

def extract_info(content):
    w = int(re.search(r'\.header\.w\s*=\s*(\d+)', content).group(1))
    h = int(re.search(r'\.header\.h\s*=\s*(\d+)', content).group(1))
    stride = int(re.search(r'\.header\.stride\s*=\s*(\d+)', content).group(1))
    fmt = re.search(r'\.header\.cf\s*=\s*LV_COLOR_FORMAT_(\w+)', content).group(1)
    lines = content.split('\n')
    collecting = False
    hex_vals = []
    for line in lines:
        if collecting:
            if '};' in line:
                break
            hex_vals.extend(re.findall(r'0x[0-9a-fA-F]{1,2}', line))
        else:
            if '_map' in line and '= {' in line:
                collecting = True
                # Also capture any hex numbers on this line after the brace
                after = line.split('=',1)[1] if '=' in line else ''
                hex_vals.extend(re.findall(r'0x[0-9a-fA-F]{1,2}', after))
    if not hex_vals:
        map_match = re.search(r'_\w+_map\s*=\s*\{([\s\S]*?)\};', content)
        if map_match:
            hex_vals = re.findall(r'0x[0-9a-fA-F]{1,2}', map_match.group(1))
    if not hex_vals:
        raise ValueError('No array data')
    return {'width':w,'height':h,'stride':stride,'format':fmt,'data':bytes(int(x,16) for x in hex_vals)}

def gen_ts(entries):
    out = ["// Auto-generated", "", "/** Weather icons in LVGL format */", ""]
    for e in entries:
        name = e['name']
        data = e['data']
        data_str = ', '.join(f'0x{b:02x}' for b in data)
        out.append(f'export const {name} = {{')
        out.append(f'  width: {e["width"]},')
        out.append(f'  height: {e["height"]},')
        out.append(f'  stride: {e["stride"]},')
        out.append(f'  format: \'{e["format"]}\' as const,')
        out.append('  data: new Uint8Array([')
        for i in range(0, len(data_str), 72):
            out.append(f'    {data_str[i:i+72]},')
        out.append('  ]),')
        out.append('};')
        out.append('')
    out.append(f'// Total: {len(entries)}')
    return '\n'.join(out)

def main():
    entries = []
    for fn in FILES:
        path = AURA_SRC / f'{fn}.c'
        if not path.exists():
            continue
        with open(path) as f:
            content = f.read()
        try:
            info = extract_info(content)
            info['name'] = fn
            entries.append(info)
            print(f'✓ {fn}: {info["width"]}x{info["height"]} {len(info["data"])} bytes')
        except Exception as e:
            print(f'✗ {fn}: {e}')
    print(f'\\nExtracted {len(entries)}/{len(FILES)}')
    ts = gen_ts(entries)
    with open(OUTPUT_TS, 'w') as f:
        f.write(ts)
    print('✓ icons.ts generated')

if __name__ == '__main__':
    main()
