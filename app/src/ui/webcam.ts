import type { PoseLandmarks } from "../pose/types";

const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],          // arms
  [11, 23], [12, 24], [23, 24],                              // torso
  [23, 25], [25, 27], [24, 26], [26, 28],                    // legs
];

const VIDEO_DISPLAY_SIZE = 360;

export interface Webcam {
  video: HTMLVideoElement;
  start(onStatus?: (msg: string) => void): Promise<void>;
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

    async start(onStatus?: (msg: string) => void) {
      const status = (msg: string) => {
        console.log("[fitcoding] " + msg);
        onStatus?.(msg);
      };

      status("Listing cameras…");
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      status(`Found ${videoInputs.length} camera(s)`);
      videoInputs.forEach((d, i) => {
        console.log(`[fitcoding]   [${i}] label=${JSON.stringify(d.label)} id=${d.deviceId.slice(0, 16)}…`);
      });

      // Deprioritize obvious virtual/phone-link cameras. Real hardware labels
      // usually include a USB vendor:product ID (e.g. "(30c9:00c9)") or vendor name;
      // virtual cameras advertise "Virtual Camera" / "OBS" / "Phone" / "Companion".
      const looksVirtual = (label: string) =>
        /phone|connected camera|companion|virtual camera|obs/i.test(label);
      videoInputs = [
        ...videoInputs.filter((d) => !looksVirtual(d.label)),
        ...videoInputs.filter((d) => looksVirtual(d.label)),
      ];

      if (videoInputs.length === 0) {
        throw new Error("no video input devices found");
      }

      let lastError: unknown = null;
      for (let i = 0; i < videoInputs.length; i++) {
        const device = videoInputs[i]!;
        const label = device.label || `cam${i}`;
        status(`Trying ${i + 1}/${videoInputs.length}: ${label.slice(0, 30)}`);
        try {
          stream = await Promise.race([
            navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: device.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            }),
            new Promise<MediaStream>((_, reject) =>
              setTimeout(() => reject(new Error(`timeout 5s`)), 5000),
            ),
          ]);
          status(`Connected: ${label.slice(0, 30)}`);
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[fitcoding] camera ${label} failed:`, e);
          status(`Camera ${i + 1} failed: ${msg.slice(0, 60)}`);
          lastError = e;
          stream = null;
        }
      }
      if (!stream) {
        throw new Error(`no camera worked (last: ${lastError})`);
      }
      status(`Tracks: ${stream.getVideoTracks().map(t => t.label).join(", ").slice(0, 60)}`);
      videoEl.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        const onPlaying = () => {
          videoEl.removeEventListener("playing", onPlaying);
          videoEl.removeEventListener("error", onError);
          console.log("[fitcoding] video 'playing' event, readyState=", videoEl.readyState, "size=", videoEl.videoWidth, "x", videoEl.videoHeight);
          resolve();
        };
        const onError = (e: Event) => {
          videoEl.removeEventListener("playing", onPlaying);
          videoEl.removeEventListener("error", onError);
          reject(new Error("video element error: " + (e as ErrorEvent).message));
        };
        videoEl.addEventListener("playing", onPlaying);
        videoEl.addEventListener("error", onError);
        videoEl.play().catch((e) => {
          console.error("[fitcoding] videoEl.play() rejected:", e);
          reject(e);
        });
      });
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
