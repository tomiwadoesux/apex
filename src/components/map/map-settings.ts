export type BlendMode = "soft-light" | "overlay" | "multiply" | "screen" | "color";

export type CameraState = {
  pitch: number;
  bearing: number;
  zoom: number;
};

export type MapSettings = CameraState & {
  /** Hue rotation applied to satellite imagery, in degrees (0–360) */
  hue: number;
  /** Saturation of satellite imagery (-1 = grayscale, 0 = natural, 1 = oversaturated) */
  saturation: number;
  /** Brightness ceiling of satellite imagery (0 = black, 1 = natural) */
  brightness: number;
  /** Contrast of satellite imagery (-1 to 1, 0 = natural) */
  contrast: number;
  /** Color of the mood tint layered over the map */
  tintColor: string;
  /** Opacity of the tint overlay (0–1) */
  tintStrength: number;
  /** CSS blend mode used by the tint overlay */
  blendMode: BlendMode;
  /** Strength of the darkened edges (0–1) */
  vignette: number;
};

export const DEFAULT_SETTINGS: MapSettings = {
  pitch: 64,
  bearing: -28,
  zoom: 13.2,
  hue: 0,
  saturation: -0.55,
  brightness: 0.8,
  contrast: 0.12,
  tintColor: "#155e75",
  tintStrength: 0.45,
  blendMode: "soft-light",
  vignette: 0.55,
};

/** Lagos — Victoria Island & the lagoon. Swap for your own scene. */
export const SCENE_CENTER: [number, number] = [3.4219, 6.4433];
