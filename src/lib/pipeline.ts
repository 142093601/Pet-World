// ============================================================
// pipeline.ts — Sprite 生成 Pipeline 编排器
// ============================================================
//
// 核心设计：
//
//   Step 1: 生成 base pet（基准角色图）
//   Step 2: 采样主色调 → 选择最佳 chroma key
//   Step 3: 用统一的 chroma key 重新生成 base pet
//   Step 4: 以 base pet 为参考，逐帧生成姿态（img2img）
//   Step 5: 从每张生成图中提取角色帧（去背景 + 居中对齐）
//   Step 6: 拼装成 sprite sheet atlas
//   Step 7: QA 验证
//
// 关键改进：
// - base pet 和所有帧使用同一个 chroma key
// - 使用真正的 img2img（非 multimodal 理解）
// - 帧提取时检测角色边界并居中对齐
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
  const totalSteps = 3 + ALL_FRAMES.length + 2; // base + chroma + re-base + N frames + compose + QA
  let currentStep = 0;

  const report = (step: string) => {
    currentStep++;
    onProgress?.(step, currentStep, totalSteps);
  };

  // ═══════════════════════════════════════════════════════
  // Step 1: 生成初始 Base Pet（用于颜色采样）
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
  // Step 3: 用统一的 chroma key 重新生成 base pet
  //         确保背景色与后续帧一致
  // ═══════════════════════════════════════════════════════
  report("正在生成统一背景的基准角色...");
  const baseFinal = await generateBasePet(description, referenceImageUrl, chromaKey);
  const baseFinalBuffer = await downloadImage(baseFinal.imageUrl);

  // ═══════════════════════════════════════════════════════
  // Step 4: 逐帧生成（以 base pet 为 img2img 参考）
  // ═══════════════════════════════════════════════════════
  const frameBuffers: Buffer[] = [];
  const framePreviews: string[] = [];

  for (const frame of ALL_FRAMES) {
    report(`正在生成: ${frame.state} [${frame.row},${frame.col}]...`);

    const frameResult = await generateFrame(
      description,
      frame.description,
      baseFinal.imageUrl, // 始终以最终 base pet 为 img2img 参考
      chromaKey
    );

    const rawBuffer = await downloadImage(frameResult.imageUrl);
    const extracted = await extractFrame(rawBuffer, chromaKey, frameWidth, frameHeight);

    frameBuffers.push(extracted);
    framePreviews.push(`data:image/png;base64,${extracted.toString("base64")}`);
  }

  // ═══════════════════════════════════════════════════════
  // Step 5: 拼装 Atlas
  // ═══════════════════════════════════════════════════════
  report("正在拼装 sprite sheet...");
  const atlasBuffer = await composeAtlas(frameBuffers);

  const atlasValidation = await validateAtlas(atlasBuffer);
  if (!atlasValidation.valid) {
    console.warn("Atlas 验证警告:", atlasValidation.errors);
  }

  // ═══════════════════════════════════════════════════════
  // Step 6: QA 验证
  // ═══════════════════════════════════════════════════════
  report("正在执行 QA 验证...");
  const qa = await runQA(atlasBuffer);

  const spriteSheetUrl = `data:image/png;base64,${atlasBuffer.toString("base64")}`;

  return { spriteSheetUrl, qa, framePreviews };
}
