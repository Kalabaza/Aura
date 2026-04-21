// Quick Node.js test to verify the icon rendering logic
// Run with: node test-icon-fix.js

// Simulate the icon data structure from icon_sunny.c
const fs = require('fs');
const path = require('path');

// Read icon_sunny.c and extract bytes
const iconC = fs.readFileSync(path.join(__dirname, 'aura/src/icon_sunny.c'), 'utf8');
const match = iconC.match(/uint8_t\s+icon_sunny_map\s*=\s*\{([\s\S]*?)\};/);
if (!match) {
  console.error('Could not extract icon data');
  process.exit(1);
}

const hexVals = match[1].match(/0x[0-9a-fA-F]{1,2}/g);
const data = new Uint8Array(hexVals.map(h => parseInt(h, 16)));

console.log(`Loaded ${data.length} bytes from icon_sunny.c`);

// Icon parameters from header
const width = 20;
const height = 20;
const stride = 40;
const format = 'RGB565A8';

// Apply the fixed rendering logic
function renderIcon(data, width, height, stride, format) {
  const interleaved = data.length === height * (stride + width);
  const rowPitch = interleaved ? (stride + width) : stride;

  console.log(`Layout: ${interleaved ? 'interleaved' : 'separate planes'}`);
  console.log(`Row pitch: ${rowPitch} bytes`);
  console.log(`Expected total: ${rowPitch * height} bytes`);
  console.log(`Actual data: ${data.length} bytes`);

  // Create RGBA buffer
  const buf = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * rowPitch + x * 2;
      const lo = data[srcIdx];
      const hi = data[srcIdx + 1];
      const pixel = lo | (hi << 8);

      const r5 = (pixel >> 11) & 0x1F;
      const g6 = (pixel >> 5) & 0x3F;
      const b5 = pixel & 0x1F;

      const r8 = (r5 << 3) | (r5 >> 2);
      const g8 = (g6 << 2) | (g6 >> 4);
      const b8 = (b5 << 3) | (b5 >> 2);

      const dstIdx = (y * width + x) * 4;
      buf[dstIdx] = r8;
      buf[dstIdx + 1] = g8;
      buf[dstIdx + 2] = b8;

      let alpha = 255;
      if (format === 'RGB565A8') {
        const alphaIdx = interleaved ? (y * rowPitch + stride + x) : (height * stride + y * width + x);
        alpha = data[alphaIdx];
      }
      buf[dstIdx + 3] = alpha;
    }
  }

  // Write PNG file
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(buf);
  ctx.putImageData(imgData, 0, 0);

  const outPath = path.join(__dirname, 'aura-sim/test-output', 'icon_sunny_fixed.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const out = fs.createWriteStream(outPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => {
    console.log(`✓ Wrote ${outPath}`);
    console.log('Test completed successfully - icon should be properly formed PNG');
  });
}

try {
  renderIcon(data, width, height, stride, format);
} catch (err) {
  console.error('Render failed:', err);
  process.exit(1);
}
