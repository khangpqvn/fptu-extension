import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'src', 'icons');
const MASTER_SIZE = 512;
const TARGETS = [16, 32, 48, 128, 512];

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function colorAt(top, bottom, y, height) {
  const amount = Math.max(0, Math.min(1, y / height));
  return [
    clamp(mix(top[0], bottom[0], amount)),
    clamp(mix(top[1], bottom[1], amount)),
    clamp(mix(top[2], bottom[2], amount)),
    255,
  ];
}

function createCanvas(size) {
  return { size, data: Buffer.alloc(size * size * 4) };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const offset = (y * canvas.size + x) * 4;
  canvas.data[offset] = color[0];
  canvas.data[offset + 1] = color[1];
  canvas.data[offset + 2] = color[2];
  canvas.data[offset + 3] = color[3];
}

function fillRect(canvas, x, y, width, height, color) {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function fillGradientRect(canvas, x, y, width, height, top, bottom) {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    const color = colorAt(top, bottom, py - y, height);
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      setPixel(canvas, px, py, color);
    }
  }
}

function fillCircle(canvas, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) {
    for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) setPixel(canvas, x, y, color);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  fillRect(canvas, x + radius, y, width - radius * 2, height, color);
  fillRect(canvas, x, y + radius, width, height - radius * 2, color);
  fillCircle(canvas, x + radius, y + radius, radius, color);
  fillCircle(canvas, x + width - radius, y + radius, radius, color);
  fillCircle(canvas, x + radius, y + height - radius, radius, color);
  fillCircle(canvas, x + width - radius, y + height - radius, radius, color);
}

function drawLine(canvas, x1, y1, x2, y2, width, color) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance * 2));
  for (let i = 0; i <= steps; i += 1) {
    const amount = i / steps;
    fillCircle(canvas, x1 + (x2 - x1) * amount, y1 + (y2 - y1) * amount, width / 2, color);
  }
}

function drawIcon(size) {
  const scale = size / 128;
  const canvas = createCanvas(size);
  const point = (value) => value * scale;
  const white = [248, 251, 255, 255];
  const navy = [13, 23, 88, 255];
  const cyan = [36, 214, 237, 255];
  const purple = [122, 66, 244, 255];

  fillGradientRect(canvas, 0, 0, size, size, [17, 29, 105], [24, 44, 146]);
  fillRoundedRect(canvas, point(22), point(25), point(84), point(78), point(14), navy);
  fillRoundedRect(canvas, point(22), point(25), point(84), point(78), point(14), [13, 23, 88, 255]);
  fillRect(canvas, point(22), point(39), point(84), point(7), white);

  [34, 45, 56].forEach((x) => fillCircle(canvas, point(x), point(34), point(3.5), navy));
  fillCircle(canvas, point(39), point(59), point(10), white);
  fillCircle(canvas, point(39), point(59), point(6), cyan);
  fillCircle(canvas, point(39), point(85), point(10), white);
  fillCircle(canvas, point(39), point(85), point(6), purple);

  drawLine(canvas, point(47), point(59), point(56), point(59), point(6), cyan);
  drawLine(canvas, point(56), point(59), point(64), point(72), point(6), cyan);
  drawLine(canvas, point(64), point(72), point(75), point(72), point(6), cyan);
  drawLine(canvas, point(47), point(85), point(56), point(85), point(6), purple);
  drawLine(canvas, point(56), point(85), point(64), point(72), point(6), purple);
  drawLine(canvas, point(64), point(72), point(75), point(72), point(6), purple);

  fillCircle(canvas, point(92), point(72), point(20), white);
  fillCircle(canvas, point(92), point(72), point(14), navy);
  drawLine(canvas, point(84), point(72), point(89), point(77), point(6), purple);
  drawLine(canvas, point(89), point(77), point(100), point(65), point(6), purple);

  return canvas;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  const output = Buffer.alloc(4);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return output;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    Buffer.alloc(4),
    typeBuffer,
    data,
    crc32(Buffer.concat([typeBuffer, data])),
  ]).fill(data.length, 0, 4);
}

function encodePng(canvas) {
  const scanlines = Buffer.alloc((canvas.size * 4 + 1) * canvas.size);
  for (let y = 0; y < canvas.size; y += 1) {
    const rowOffset = y * (canvas.size * 4 + 1);
    scanlines[rowOffset] = 0;
    canvas.data.copy(scanlines, rowOffset + 1, y * canvas.size * 4, (y + 1) * canvas.size * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.size, 0);
  header.writeUInt32BE(canvas.size, 4);
  header[8] = 8;
  header[9] = 6;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', header);
  const idat = pngChunk('IDAT', deflateSync(scanlines, { level: 9 }));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function resize(source, targetSize) {
  if (source.size === targetSize) return source;
  const target = createCanvas(targetSize);
  const ratio = source.size / targetSize;
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const startX = Math.floor(x * ratio);
      const endX = Math.min(source.size, Math.ceil((x + 1) * ratio));
      const startY = Math.floor(y * ratio);
      const endY = Math.min(source.size, Math.ceil((y + 1) * ratio));
      const sums = [0, 0, 0, 0];
      let count = 0;
      for (let sy = startY; sy < endY; sy += 1) {
        for (let sx = startX; sx < endX; sx += 1) {
          const offset = (sy * source.size + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += source.data[offset + channel];
          count += 1;
        }
      }
      setPixel(target, x, y, sums.map((sum) => Math.round(sum / count)));
    }
  }
  return target;
}

await mkdir(OUTPUT, { recursive: true });
const master = drawIcon(MASTER_SIZE);
for (const size of TARGETS) {
  const output = join(OUTPUT, `icon${size}.png`);
  await writeFile(output, encodePng(resize(master, size)));
  console.log(`Generated ${output}`);
}
