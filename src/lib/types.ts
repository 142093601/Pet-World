// ============================================================
// types.ts — 共享类型定义
// ============================================================

/** 动画状态 */
export type AnimationState = "idle" | "walk" | "happy" | "sad" | "action";

/** 单帧定义 */
export interface Frame {
  col: number;
  row: number;
  state: AnimationState;
  description: string;
}

/** 动画行定义 */
export interface AnimationRow {
  row: number;
  state: AnimationState;
  frames: Frame[];
  description: string;
}

/** 生成任务类型 */
export type JobKind = "base" | "frame";

/** 生成任务状态 */
export type JobStatus = "pending" | "generating" | "complete" | "failed";

/** Pipeline 运行配置 */
export interface PipelineConfig {
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  chromaKey: string;
  description: string;
  referenceImageUrl?: string;
}

/** Pipeline 运行结果 */
export interface PipelineResult {
  spriteSheetUrl: string;
  qa: QAResult;
  framePreviews: string[];
}

/** QA 结果 */
export interface QAResult {
  passed: boolean;
  checks: QACheck[];
}

/** 单项 QA 检查 */
export interface QACheck {
  name: string;
  passed: boolean;
  message: string;
}
