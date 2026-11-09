import { fitWithin } from "./export-image";

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function makeImageThumbnail(file: File, maxDim = 320): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("thumbnail: image load failed"));
      i.src = url;
    });
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const base = file.name.replace(/\.[^.]+$/, "") || "thumb";
    const webp = await canvasToBlob(canvas, "image/webp", 0.82);
    if (webp) return new File([webp], `${base}-thumb.webp`, { type: "image/webp" });
    const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.82);
    if (!jpeg) throw new Error("thumbnail export failed");
    return new File([jpeg], `${base}-thumb.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
