const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(6, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrType = Buffer.from('IHDR');
  const ihdrCrc = crc32(Buffer.concat([ihdrType, ihdrData]));
  const ihdr = Buffer.alloc(12 + 13);
  ihdr.writeUInt32BE(13, 0);
  ihdrType.copy(ihdr, 4);
  ihdrData.copy(ihdr, 8);
  ihdr.writeUInt32BE(ihdrCrc, 21);

  const rawData = Buffer.alloc(size * (1 + size * 4));

  const r = 99, g = 102, b = 241;
  const padding = Math.floor(size * 0.05);
  const iconSize = size - padding;
  const dotRadius = Math.max(2, Math.floor(iconSize * 0.14));
  const arcThickness = Math.max(2, Math.floor(iconSize * 0.14));

  const centerX = padding + dotRadius;
  const centerY = size - padding - dotRadius;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    rawData[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;

      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let draw = false;

      if (dist <= dotRadius) {
        draw = true;
      }

      const arc1Inner = iconSize * 0.32;
      const arc1Outer = arc1Inner + arcThickness;
      if (dist >= arc1Inner && dist <= arc1Outer && dx >= 0 && dy <= 0) {
        draw = true;
      }

      const arc2Inner = iconSize * 0.58;
      const arc2Outer = arc2Inner + arcThickness;
      if (dist >= arc2Inner && dist <= arc2Outer && dx >= 0 && dy <= 0) {
        draw = true;
      }

      const arc3Inner = iconSize * 0.84;
      const arc3Outer = arc3Inner + arcThickness;
      if (dist >= arc3Inner && dist <= arc3Outer && dx >= 0 && dy <= 0) {
        draw = true;
      }

      if (draw) {
        rawData[idx] = r;
        rawData[idx + 1] = g;
        rawData[idx + 2] = b;
        rawData[idx + 3] = 255;
      } else {
        rawData[idx] = 0;
        rawData[idx + 1] = 0;
        rawData[idx + 2] = 0;
        rawData[idx + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatType = Buffer.from('IDAT');
  const idatCrc = crc32(Buffer.concat([idatType, compressed]));
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idatType.copy(idat, 4);
  compressed.copy(idat, 8);
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

for (const size of sizes) {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
}

console.log('Icons generated successfully');
