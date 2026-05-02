const FRAME_COUNT = 4;
const FRAME_SIZE = 64;

export function progressToFrame(progress: number, frames: number = FRAME_COUNT): number {
  const clamped = Math.max(0, Math.min(1, progress));
  const idx = Math.floor(clamped * frames);
  return Math.min(frames - 1, idx);
}

export interface PixelMan {
  setSpriteUrl(url: string): Promise<void>;
  draw(progress: number): void;
}

export function createPixelMan(canvas: HTMLCanvasElement): PixelMan {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not get 2d context");
  ctx.imageSmoothingEnabled = false;
  let sprite: HTMLImageElement | null = null;

  return {
    async setSpriteUrl(url: string) {
      sprite = await loadImage(url);
    },
    draw(progress: number) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!sprite) return;
      const frame = progressToFrame(progress);
      const sx = frame * FRAME_SIZE;
      ctx.drawImage(sprite, sx, 0, FRAME_SIZE, FRAME_SIZE, 0, 0, w, h);
    },
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}
