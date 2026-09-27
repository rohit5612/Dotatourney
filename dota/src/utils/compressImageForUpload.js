/** Downscale and JPEG-wrap images so JSON POST stays under typical reverse-proxy limits. */
export async function compressImageFileForDataUrl(file, maxEdge = 1680, jpegQuality = 0.88) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", jpegQuality);
  } finally {
    bitmap.close();
  }
}

export async function readPaymentScreenshotFile(file) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image (screenshot or photo).");
  }
  try {
    return await compressImageFileForDataUrl(file);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
