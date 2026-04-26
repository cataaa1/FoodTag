const DEFAULT_COLOR = "#f97316";

function parseHexColor(value: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_COLOR;
  const hex = normalized.slice(1);

  return {
    normalized,
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function normalizeHexColor(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_COLOR;
  }

  return parseHexColor(value).normalized;
}

export function hexToRgba(value: string | null | undefined, alpha: number) {
  const { r, g, b } = parseHexColor(normalizeHexColor(value));
  const safeAlpha = Math.min(1, Math.max(0, alpha));

  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function getContrastColor(value: string | null | undefined) {
  const { r, g, b } = parseHexColor(normalizeHexColor(value));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.62 ? "#1c1009" : "#fffaf5";
}
