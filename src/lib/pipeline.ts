// ============================================================
// pipeline.ts — Sprite 生成 Pipeline 编排器
// ============================================================
//
// 核心设计（借鉴 Codex hatch-pet）：
//
//   Step 1: 生成 base pet（基准角色图）
//   Step 2: 采样主色调 → 选择最佳 chroma key
//   Step 3: 以 base pet 为 grounding image，逐帧生成 6 个姿态
//   Step 4: 从每张生成图中提取角色帧（去背景）
//   Step 5: 拼装成 sprite sheet atlas
//   Step 6: QA 验证
//
// 这种方式解决了"一次生成整张 sprite sheet"导致的角色不一致问题。
// 每帧都锚定在同一张 base pet 上，大幅提高一致性。
// ============================================================

import { generateBasePet, generateFrame } from "./imagegen";
import { selectChromaKey } from "./chroma-key";
import { extractFrame, sampleColors } from "./frame-extractor";
import { composeAtlas, validateAtlas } from "./atlas-composer";
import { runQA } from "./qa";
import { ALL_FRAMES, FRAME_WIDTH, FRAME_HEIGHT } from "./config";
import type { PipelineConfig, PipelineResult } from "./types";

type ProgressCallback = (step: string, current: number, total: number) => void;

/**
 * 下载图片 URL 为 Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1];
    return Buffer.from(base64, "base64");
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载图片失败 (${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 执行完整的 sprite 生成 pipeline
 */
export async function runPipeline(
  config: PipelineConfig,
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const { description, referenceImageUrl, frameWidth, frameHeight } = config;
  const totalSteps = 2 + ALL_FRAMES.length + 2; // base + chroma + N frames + compose + QA
  let currentStep = 0;

  const report = (step: string) => {
    currentStep++;
    onProgress?.(step, currentStep, totalSteps);
  };

  // ═══════════════════════════════════════════════════════
  // Step 1: 生成 Base Pet（基准角色）
  // ═══════════════════════════════════════════════════════
  report("正在生成基准角色...");
  const baseResult = await generateBasePet(description, referenceImageUrl);
  const baseBuffer = await downloadImage(baseResult.imageUrl);

  // ═══════════════════════════════════════════════════════
  // Step 2: 选择最佳 Chroma Key
  // ═══════════════════════════════════════════════════════
  report("正在分析颜色...");
  const dominantColors = await sampleColors(baseBuffer);
  const chromaKey = selectChromaKey(dominantColors);

  // ═══════════════════════════════════════════════════════
  // Step 3: 逐帧生成（以 base pet 为 grounding image）
  // ═══════════════════════════════════════════════════════
  const frameBuffers: Buffer[] = [];
  const framePreviews: string[] = [];

  for (const frame of ALL_FRAMES) {
    report(`正在生成: ${frame.state} [${frame.row},${frame.col}]...`);

    const frameResult = await generateFrame(
      description,
      frame.description,
      [baseResult.imageUrl], // 始终以 base pet 为 grounding
      chromaKey
    );

    const rawBuffer = await downloadImage(frameResult.imageUrl);
    const extracted = await extractFrame(rawBuffer, chromaKey, frameWidth, frameHeight);

    frameBuffers.push(extracted);
    framePreviews.push(`data:image/png;base64,${extracted.toString("base64")}`);
  }

  // ═══════════════════════════════════════════════════════
  // Step 4: 拼装 Atlas
  // ═══════════════════════════════════════════════════════
  report("正在拼装 sprite sheet...");
  const atlasBuffer = await composeAtlas(frameBuffers);

  const atlasValidation = await validateAtlas(atlasBuffer);
  if (!atlasValidation.valid) {
    console.warn("Atlas 验证警告:", atlasValidation.errors);
  }

  // ═══════════════════════════════════════════════════════
  // Step 5: QA 验证
  // ═══════════════════════════════════════════════════════
  report("正在执行 QA 验证...");
  const qa = await runQA(atlasBuffer);

  const spriteSheetUrl = `data:image/png;base64,${atlasBuffer.toString("base64")}`;

  return { spriteSheetUrl, qa, framePreviews };
}
