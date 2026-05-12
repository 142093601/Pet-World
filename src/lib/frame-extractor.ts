// ============================================================
// frame-extractor.ts — 从生成的图片中提取角色帧
// ============================================================
//
// 处理流程：
// 1. 检测角色边界框（非 chroma key 像素）
// 2. 裁切到角色区域
// 3. 居中放到目标帧尺寸
// 4. 去除 chroma key 背景
// 5. 输出为 PNG buffer（带 alpha 通道）
//
// 这样即使模型生成的角色位置不同，提取后也能居中对齐。
// ============================================================

import sharp from "sharp";
import { FRAME_WIDTH, FRAME_HEIGHT } from "./config";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colorDistance(
  r: number, g: number, b: number,
  tr: number, tg: number, tb: number
): number {
  return Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
}

/**
 * 从生成的图片中提取角色并去除 chroma key 背景
 *
 * 关键改进：先检测角色边界框，居中对齐后再 resize。
 * 解决角色在不同帧中位置漂移的问题。
 */
export async function extractFrame(
  imageBuffer: Buffer,
  chromaKey: string,
  targetWidth: number = FRAME_WIDTH,
  targetHeight: number = FRAME_HEIGHT
): Promise<Buffer> {
  const [cr, cg, cb] = hexToRgb(chromaKey);
  const tolerance = 60;

  // 1. 获取原始图片数据
  const raw = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = raw;
  const { width: w, height: h } = info;

  // 2. 检测角色边界框（非背景像素）
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];

      if (colorDistance(r, g, b, cr, cg, cb) >= tolerance) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        hasContent = true;
      }
    }
  }

  // 如果没有检测到内容，回退到全图
  if (!hasContent) {
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }

  // 3. 扩展边界（留点边距）
  const pad = Math.max(10, Math.round(Math.min(w, h) * 0.05));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 4. 裁切 → 居中放到目标尺寸（背景用 chroma key 填充）
  let processed: Buffer;
  try {
    processed = await sharp(imageBuffer)
      .extract({ left: minX, top: minY, width: cropW, height: cropH })
      .resize(targetWidth, targetHeight, {
        fit: "contain",
        background: chromaKey,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    // 裁切失败时回退到直接 resize
    processed = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "contain",
        background: chromaKey,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }

  // 5. 去除 chroma key 背景
  const pixels = Buffer.alloc(processed.data.length);
  for (let i = 0; i < processed.data.length; i += 4) {
    const r = processed.data[i];
    const g = processed.data[i + 1];
    const b = processed.data[i + 2];

    if (colorDistance(r, g, b, cr, cg, cb) < tolerance) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    } else {
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = processed.data[i + 3];
    }
  }

  return sharp(pixels, {
    raw: { width: processed.info.width, height: processed.info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * 从图片中采样主要颜色（用于 chroma key 选择）
 */
export async function sampleColors(imageBuffer: Buffer): Promise<[number, number, number][]> {
  const { data } = await sharp(imageBuffer)
    .resize(32, 32, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const colorCounts = new Map<string, { color: [number, number, number]; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;

    const existing = colorCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorCounts.set(key, { color: [r, g, b], count: 1 });
    }
  }

  return Array.from(colorCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((c) => c.color);
}
