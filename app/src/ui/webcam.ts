import type { PoseLandmarks } from "../pose/types";

const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],          // arms
  [11, 23], [12, 24], [23, 24],                              // torso
  [23, 25], [25, 27], [24, 26], [26, 28],                    // legs
];

const VIDEO_DISPLAY_SIZE = 360;

export interface Webcam {
  video: HTMLVideoElement;
  start(): Promise<void>;
  drawSkeleton(landmarks: PoseLandmarks | null): void;
  stop(): void;
}

export function createWebcam(
  videoEl: HTMLVideoElement,
  overlayCanvas: HTMLCanvasElement,
): Webcam {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) throw new Error("could not get 2d context");
  let stream: MediaStream | null = null;

  return {
    video: videoEl,

    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();
    },

    drawSkeleton(landmarks: PoseLandmarks | null) {
      const w = overlayCanvas.width;
      const h = overlayCanvas.height;
      ctx.clearRect(0, 0, w, h);
      if (!landmarks) return;

      const offsetX = (w - VIDEO_DISPLAY_SIZE) / 2;
      const offsetY = (h - VIDEO_DISPLAY_SIZE) / 2;

      // Mirror the X axis to match the mirrored video.
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      ctx.strokeStyle = "#62e08a";
      ctx.lineWidth = 3;
      for (const [a, b] of SKELETON_EDGES) {
        const la = landmarks[a];
        const lb = landmarks[b];
        if (!la || !lb) continue;
        if (la.visibility < 0.3 || lb.visibility < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(offsetX + la.x * VIDEO_DISPLAY_SIZE, offsetY + la.y * VIDEO_DISPLAY_SIZE);
        ctx.lineTo(offsetX + lb.x * VIDEO_DISPLAY_SIZE, offsetY + lb.y * VIDEO_DISPLAY_SIZE);
        ctx.stroke();
      }

      ctx.fillStyle = "#62e08a";
      for (const lm of landmarks) {
        if (lm.visibility < 0.3) continue;
        ctx.beginPath();
        ctx.arc(offsetX + lm.x * VIDEO_DISPLAY_SIZE, offsetY + lm.y * VIDEO_DISPLAY_SIZE, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },

    stop() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      videoEl.srcObject = null;
    },
  };
}
