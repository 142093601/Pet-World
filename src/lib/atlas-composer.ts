// ============================================================
// atlas-composer.ts — 将提取的帧拼装成最终 sprite sheet
// ============================================================

import sharp from "sharp";
import { FRAME_WIDTH, FRAME_HEIGHT, SPRITE_COLS, SPRITE_ROWS, SPRITE_WIDTH, SPRITE_HEIGHT } from "./config";

/**
 * 将多张帧图片拼装成 sprite sheet atlas
 */
export async function composeAtlas(frames: Buffer[]): Promise<Buffer> {
  if (frames.length !== SPRITE_COLS * SPRITE_ROWS) {
    throw new Error(
      `帧数量不匹配：期望 ${SPRITE_COLS * SPRITE_ROWS}，实际 ${frames.length}`
    );
  }

  // 创建透明背景的 atlas
  const atlas = sharp({
    create: {
      width: SPRITE_WIDTH,
      height: SPRITE_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composites: sharp.OverlayOptions[] = [];

  for (let row = 0; row < SPRITE_ROWS; row++) {
    for (let col = 0; col < SPRITE_COLS; col++) {
      const index = row * SPRITE_COLS + col;
      const frameBuffer = frames[index];

      const resized = await sharp(frameBuffer)
        .resize(FRAME_WIDTH, FRAME_HEIGHT, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      composites.push({
        input: resized,
        left: col * FRAME_WIDTH,
        top: row * FRAME_HEIGHT,
      });
    }
  }

  return atlas.composite(composites).png().toBuffer();
}

/**
 * 验证 atlas 的结构正确性
 */
export async function validateAtlas(atlasBuffer: Buffer): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const metadata = await sharp(atlasBuffer).metadata();

  if (metadata.width !== SPRITE_WIDTH || metadata.height !== SPRITE_HEIGHT) {
    errors.push(
      `atlas 尺寸不匹配：期望 ${SPRITE_WIDTH}x${SPRITE_HEIGHT}，实际 ${metadata.width}x${metadata.height}`
    );
  }

  if (metadata.channels && metadata.channels < 4) {
    errors.push("atlas 缺少 alpha 通道");
  }

  return { valid: errors.length === 0, errors };
}
