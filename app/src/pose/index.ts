import {
  PoseLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { PoseLandmarks } from "./types";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export interface Pose {
  detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarks | null;
  close(): void;
}

export async function initPose(): Promise<Pose> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return {
    detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarks | null {
      if (video.readyState < 2) return null;
      const result = landmarker.detectForVideo(video, timestampMs);
      const first = result.landmarks[0];
      if (!first) return null;
      return first.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
      }));
    },
    close() {
      landmarker.close();
    },
  };
}
