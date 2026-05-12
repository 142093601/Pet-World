// ============================================================
// config.ts — Atlas 布局与动画配置
// ============================================================

import type { AnimationRow, AnimationState, Frame } from "./types";

// ─── Atlas 参数 ───────────────────────────────────────────
export const SPRITE_COLS = 3;
export const SPRITE_ROWS = 2;
export const FRAME_WIDTH = 256;
export const FRAME_HEIGHT = 256;
export const SPRITE_WIDTH = FRAME_WIDTH * SPRITE_COLS;   // 768
export const SPRITE_HEIGHT = FRAME_HEIGHT * SPRITE_ROWS; // 512

// ─── 动画行定义 ──────────────────────────────────────────
// Row 0: idle | walk-1 | walk-2
// Row 1: happy | sad   | action
export const ANIMATION_ROWS: AnimationRow[] = [
  {
    row: 0,
    state: "idle",
    description: "idle standing pose",
    frames: [
      { col: 0, row: 0, state: "idle", description: "idle standing pose, relaxed, facing forward" },
      { col: 1, row: 0, state: "walk", description: "walking frame 1, left foot forward, mid-stride" },
      { col: 2, row: 0, state: "walk", description: "walking frame 2, right foot forward, mid-stride" },
    ],
  },
  {
    row: 1,
    state: "happy",
    description: "happy celebration pose",
    frames: [
      { col: 0, row: 1, state: "happy", description: "happy celebration pose, arms raised, joyful expression" },
      { col: 1, row: 1, state: "sad", description: "sad droopy pose, head down, dejected expression" },
      { col: 2, row: 1, state: "action", description: "energetic action pose, dynamic movement" },
    ],
  },
];

// ─── 所有帧的扁平列表 ─────────────────────────────────────
export const ALL_FRAMES: Frame[] = ANIMATION_ROWS.flatMap((row) => row.frames);

// ─── Chroma Key 候选色 ────────────────────────────────────
export const CHROMA_KEY_CANDIDATES = [
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFFF00", // yellow
  "#FF6600", // orange
  "#00FF00", // green
  "#0066FF", // blue
];

// ─── 默认 Chroma Key ──────────────────────────────────────
export const DEFAULT_CHROMA_KEY = "#00FF00";

// ─── API 配置 ─────────────────────────────────────────────
export const API_BASE = "https://oa.api2d.net/v1";
export const API_MODEL = "dall-e-3";
// 帧生成用 dall-e-2（支持 img2img edit 接口）
export const API_MODEL_FRAME = "dall-e-2";

// ─── 动画状态映射（给 SpriteAnimation 组件用） ─────────────
export const ANIMATION_FRAMES: Record<AnimationState, { row: number; frames: number[] }> = {
  idle:   { row: 0, frames: [0] },
  walk:   { row: 0, frames: [1, 2] },
  happy:  { row: 1, frames: [0] },
  sad:    { row: 1, frames: [1] },
  action: { row: 1, frames: [2] },
};
