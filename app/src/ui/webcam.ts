import type { PoseLandmarks } from "../pose/types";

const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],          // arms
  [11, 23], [12, 24], [23, 24],                              // torso
  [23, 25], [25, 27], [24, 26], [26, 28],                    // legs
];

const VIDEO_DISPLAY_SIZE = 360;

// Per-device timeouts (ms). Tuned for typical Windows + Phone Link behavior:
// the virtual camera "connects" near-instantly with a black stream, so we need
// to validate FRAMES not just connection.
const GET_USER_MEDIA_TIMEOUT_MS = 5000;
const PLAYING_TIMEOUT_MS = 3000;
const FRAME_SETTLE_MS = 300;

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
      let allDevices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = allDevices.filter((d) => d.kind === "videoinput");

      // enumerateDevices() returns devices with EMPTY labels (and sometimes
      // empty deviceIds) until the page has been granted camera permission.
      // In production builds the webview origin (tauri://...) is fresh so the
      // dev-mode permission never carries over. Probe getUserMedia first to
      // trigger the OS permission prompt, then re-enumerate.
      const allLabelsEmpty = videoInputs.length > 0 && videoInputs.every((d) => !d.label);
      if (allLabelsEmpty) {
        status("Requesting camera permission…");
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          probe.getTracks().forEach((t) => t.stop());
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`camera permission denied or unavailable: ${msg}`);
        }
        allDevices = await navigator.mediaDevices.enumerateDevices();
        videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      }

      status(`Found ${videoInputs.length} camera(s)`);
      videoInputs.forEach((d, i) => {
        console.log(`[fitcoding]   [${i}] label=${JSON.stringify(d.label)} id=${d.deviceId.slice(0, 16)}…`);
      });

      // Deprioritize obvious virtual/phone-link cameras. Real hardware labels
      // usually include a USB vendor:product ID (e.g. "(30c9:00c9)") or vendor name;
      // virtual cameras advertise "Virtual Camera" / "OBS" / "Phone" / "Companion".
      // Heuristic only — frame-content validation below is the real safety net.
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
        let candidate: MediaStream | null = null;
        try {
          candidate = await Promise.race([
            navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: device.deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
              audio: false,
            }),
            new Promise<MediaStream>((_, reject) =>
              setTimeout(() => reject(new Error(`getUserMedia timeout ${GET_USER_MEDIA_TIMEOUT_MS}ms`)), GET_USER_MEDIA_TIMEOUT_MS),
            ),
          ]);
          videoEl.srcObject = candidate;
          await waitForPlaying(videoEl, PLAYING_TIMEOUT_MS);
          status(`Validating frames from ${label.slice(0, 30)}…`);
          await new Promise<void>((r) => setTimeout(r, FRAME_SETTLE_MS));
          const liveness = sampleFrameLiveness(videoEl);
          console.log(`[fitcoding]   liveness check: range=${liveness.range} mean=${liveness.mean} alive=${liveness.alive}`);
          if (!liveness.alive) {
            status(`Camera ${i + 1} produces dead frames (range=${liveness.range}), trying next…`);
            candidate.getTracks().forEach((t) => t.stop());
            videoEl.srcObject = null;
            candidate = null;
            continue;
          }
          stream = candidate;
          status(`✓ ${label.slice(0, 30)}`);
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn(`[fitcoding] camera ${label} failed:`, e);
          status(`Camera ${i + 1} failed: ${msg.slice(0, 60)}`);
          lastError = e;
          candidate?.getTracks().forEach((t) => t.stop());
          videoEl.srcObject = null;
        }
      }
      if (!stream) {
        throw new Error(`no usable camera (last: ${lastError})`);
      }
      console.log("[fitcoding] using tracks:", stream.getVideoTracks().map((t) => t.label).join(", "));
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

function waitForPlaying(videoEl: HTMLVideoElement, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      videoEl.removeEventListener("playing", onPlaying);
      videoEl.removeEventListener("error", onError);
    };
    const onPlaying = () => {
      cleanup();
      console.log("[fitcoding] video 'playing' event, readyState=", videoEl.readyState, "size=", videoEl.videoWidth, "x", videoEl.videoHeight);
      resolve();
    };
    const onError = (e: Event) => {
      cleanup();
      reject(new Error("video element error: " + (e as ErrorEvent).message));
    };
    videoEl.addEventListener("playing", onPlaying);
    videoEl.addEventListener("error", onError);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error(`playing event timeout ${timeoutMs}ms`));
    }, timeoutMs);
    videoEl.play().catch((e) => {
      cleanup();
      console.error("[fitcoding] videoEl.play() rejected:", e);
      reject(e);
    });
  });
}

interface Liveness {
  alive: boolean;
  range: number;
  mean: number;
}

/**
 * Sample a 4×4 grid from a downscaled snapshot of the video. Real cameras emit
 * sensor noise even in a dark room, so a non-trivial brightness range is the
 * cheapest tell that the stream is real. Phone-Link's sleeping-phone stream
 * produces computationally uniform output that this catches.
 */
function sampleFrameLiveness(videoEl: HTMLVideoElement): Liveness {
  const off = document.createElement("canvas");
  off.width = 64;
  off.height = 48;
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  if (!offCtx) return { alive: false, range: 0, mean: 0 };
  if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    return { alive: false, range: 0, mean: 0 };
  }
  offCtx.drawImage(videoEl, 0, 0, off.width, off.height);
  const data = offCtx.getImageData(0, 0, off.width, off.height).data;
  let min = 255, max = 0, sum = 0, count = 0;
  for (let y = 6; y < off.height - 4; y += 12) {
    for (let x = 8; x < off.width - 4; x += 12) {
      const i = (y * off.width + x) * 4;
      const a = data[i] ?? 0;
      const b = data[i + 1] ?? 0;
      const c = data[i + 2] ?? 0;
      const brightness = (a + b + c) / 3;
      if (brightness < min) min = brightness;
      if (brightness > max) max = brightness;
      sum += brightness;
      count++;
    }
  }
  const range = max - min;
  const mean = count > 0 ? sum / count : 0;
  // Real cameras produce ≥3 brightness range from sensor noise alone, even with
  // the lens covered; computationally uniform streams (Phone Link with sleeping
  // phone) sit at exactly 0. Accept anything ≥3.
  return { alive: range >= 3, range, mean };
}
