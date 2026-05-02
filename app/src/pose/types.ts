export interface Landmark {
  x: number;          // normalized [0, 1] in image-space
  y: number;          // normalized [0, 1]
  z: number;
  visibility: number; // [0, 1] — confidence the joint is visible
}

export type PoseLandmarks = Landmark[];

// MediaPipe Pose Landmarker landmark indices (subset we use).
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;
