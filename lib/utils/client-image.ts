type OptimizeImageOptions = {
  maxBytes: number;
  maxDimension: number;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
};

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.width, height: image.height });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      reject(new Error("No pudimos leer la imagen"));
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
) {
  return canvas.toDataURL(mimeType, quality);
}

function estimateByteLength(dataUrl: string) {
  const [, base64 = ""] = dataUrl.split(",", 2);
  return Math.floor((base64.length * 3) / 4);
}

export async function optimizeImageFile(
  file: File,
  options: OptimizeImageOptions,
) {
  const { maxBytes, maxDimension, mimeType = "image/webp", quality = 0.86 } = options;
  const { width, height } = await readImageSize(file);
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("No pudimos procesar la imagen"));
      nextImage.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Tu navegador no permite procesar la imagen");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    let currentQuality = quality;
    let dataUrl = canvasToDataUrl(canvas, mimeType, currentQuality);

    while (estimateByteLength(dataUrl) > maxBytes && currentQuality > 0.45) {
      currentQuality -= 0.08;
      dataUrl = canvasToDataUrl(canvas, mimeType, currentQuality);
    }

    if (estimateByteLength(dataUrl) > maxBytes) {
      throw new Error("La imagen sigue siendo muy pesada incluso después de optimizarla");
    }

    return {
      dataUrl,
      byteLength: estimateByteLength(dataUrl),
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
