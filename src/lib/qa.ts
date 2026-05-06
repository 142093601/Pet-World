// ============================================================
// qa.ts — QA 验证：结构检查 + 视觉一致性
// ============================================================

import sharp from "sharp";
import { FRAME_WIDTH, FRAME_HEIGHT, SPRITE_COLS, SPRITE_ROWS, SPRITE_WIDTH, SPRITE_HEIGHT } from "./config";
import type { QAResult, QACheck } from "./types";

/**
 * 对最终 atlas 执行 QA 检查
 *
 * 两层验收：
 * 1. 结构正确性（确定性）：尺寸、格式、alpha、帧填充率
 * 2. 视觉一致性（启发式）：帧间颜色分布相似度
 */
export async function runQA(atlasBuffer: Buffer): Promise<QAResult> {
  const checks: QACheck[] = [];

  const metadata = await sharp(atlasBuffer).metadata();

  // 1. 尺寸检查
  checks.push({
    name: "atlas 尺寸",
    passed: metadata.width === SPRITE_WIDTH && metadata.height === SPRITE_HEIGHT,
    message: `期望 ${SPRITE_WIDTH}x${SPRITE_HEIGHT}，实际 ${metadata.width}x${metadata.height}`,
  });

  // 2. 格式检查
  checks.push({
    name: "图片格式",
    passed: metadata.format === "png" || metadata.format === "webp",
    message: `格式: ${metadata.format}`,
  });

  // 3. Alpha 通道检查
  checks.push({
    name: "Alpha 通道",
    passed: (metadata.channels ?? 0) >= 4,
    message: `通道数: ${metadata.channels}`,
  });

  // ── 帧填充率检查 ──────────────────────────────────────
  const { data, info } = await sharp(atlasBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const frameStats: { fillRatio: number; avgColor: [number, number, number] }[] = [];

  for (let row = 0; row < SPRITE_ROWS; row++) {
    for (let col = 0; col < SPRITE_COLS; col++) {
      const cellX = col * FRAME_WIDTH;
      const cellY = row * FRAME_HEIGHT;

      let nonTransparent = 0;
      let totalR = 0, totalG = 0, totalB = 0;
      let colorSamples = 0;
      let totalPixels = 0;

      for (let y = cellY; y < cellY + FRAME_HEIGHT; y += 4) {
        for (let x = cellX; x < cellX + FRAME_WIDTH; x += 4) {
          const idx = (y * info.width + x) * 4;
          totalPixels++;

          if (data[idx + 3] > 10) {
            nonTransparent++;
            totalR += data[idx];
            totalG += data[idx + 1];
            totalB += data[idx + 2];
            colorSamples++;
          }
        }
      }

      const fillRatio = nonTransparent / totalPixels;
      const avgColor: [number, number, number] = colorSamples > 0
        ? [totalR / colorSamples, totalG / colorSamples, totalB / colorSamples]
        : [0, 0, 0];

      frameStats.push({ fillRatio, avgColor });

      checks.push({
        name: `帧 [${row},${col}] 填充率`,
        passed: fillRatio > 0.05,
        message: `${(fillRatio * 100).toFixed(1)}%`,
      });
    }
  }

  // ── 颜色一致性检查 ────────────────────────────────────
  if (frameStats.length >= 2) {
    const baseColor = frameStats[0].avgColor;
    let maxColorDiff = 0;

    for (let i = 1; i < frameStats.length; i++) {
      const diff = Math.sqrt(
        (frameStats[i].avgColor[0] - baseColor[0]) ** 2 +
        (frameStats[i].avgColor[1] - baseColor[1]) ** 2 +
        (frameStats[i].avgColor[2] - baseColor[2]) ** 2
      );
      maxColorDiff = Math.max(maxColorDiff, diff);
    }

    const colorThreshold = 100;
    checks.push({
      name: "帧间颜色一致性",
      passed: maxColorDiff < colorThreshold,
      message: `最大颜色差异: ${maxColorDiff.toFixed(0)} (阈值: ${colorThreshold})`,
    });
  }

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}
