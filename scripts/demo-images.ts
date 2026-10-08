import { deflateSync } from "node:zlib";

/**
 * Logos y portadas de los trucks de demo, generados en codigo.
 *
 * Se guardan igual que los que sube un admin: data URI PNG en la DB. Tienen
 * que ser PNG/JPG/WEBP y no SVG, porque el validador de /api/admin/settings
 * rechaza cualquier otra cosa y el admin no podria volver a guardar la
 * configuracion del truck.
 */

type Rgb = readonly [number, number, number];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Codifica pixeles RGBA (4 bytes por pixel, fila por fila) como PNG. */
function encodePng(width: number, height: number, rgba: Uint8Array) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filtro "none"
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function toDataUri(png: Buffer) {
  return `data:image/png;base64,${png.toString("base64")}`;
}

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * Portada 960x400: degrade diagonal del color de marca con franjas suaves y
 * una grilla de puntos, para que el hero no quede plano.
 */
export function buildHeroImage(primaryHex: string, accentHex: string) {
  const width = 960;
  const height = 400;
  const primary = hexToRgb(primaryHex);
  const accent = hexToRgb(accentHex);
  const dark = mix(primary, BLACK, 0.45);
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = (x / width) * 0.7 + (y / height) * 0.3;
      let color = mix(accent, dark, t);

      // Franjas diagonales anchas y muy sutiles.
      if (Math.floor((x + y) / 60) % 2 === 0) {
        color = mix(color, WHITE, 0.06);
      }

      // Grilla de puntos en la mitad derecha, alineada para no cortar ninguno.
      const dx = (x % 32) - 16;
      const dy = (y % 32) - 16;
      if (Math.floor(x / 32) >= 17 && dx * dx + dy * dy < 9) {
        color = mix(color, WHITE, 0.22);
      }

      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }

  return toDataUri(encodePng(width, height, pixels));
}

/**
 * Logo 256x256: circulo del color de marca con un aro blanco y un centro mas
 * oscuro. El fondo es transparente.
 */
export function buildLogoImage(primaryHex: string) {
  const size = 256;
  const center = size / 2;
  const primary = hexToRgb(primaryHex);
  const dark = mix(primary, BLACK, 0.35);
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      let color: Rgb | null = null;

      if (distance <= 126) color = primary;
      if (distance <= 104) color = WHITE;
      if (distance <= 94) color = dark;
      if (distance <= 52) color = primary;

      if (!color) continue;

      // Borde exterior con un pixel de antialiasing.
      const alpha = distance > 125 ? Math.max(0, 126 - distance) : 1;
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return toDataUri(encodePng(size, size, pixels));
}
