// ============================================================
// frame-extractor.ts — 从生成的图片中提取角色帧
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

/**
 * 从生成的图片中提取角色并去除 chroma key 背景
 *
 * 处理流程：
 * 1. 将图片缩放到目标帧尺寸
 * 2. 检测 chroma key 颜色区域
 * 3. 将 chroma key 区域设为透明
 * 4. 输出为 PNG buffer（带 alpha 通道）
 */
export async function extractFrame(
  imageBuffer: Buffer,
  chromaKey: string,
  targetWidth: number = FRAME_WIDTH,
  targetHeight: number = FRAME_HEIGHT
): Promise<Buffer> {
  const chromaRgb = hexToRgb(chromaKey);

  // 缩放到目标尺寸
  const resized = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, { fit: "contain", background: chromaKey })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const pixels = Buffer.alloc(data.length);

  // 遍历像素，将 chroma key 颜色替换为透明
  const tolerance = 60;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      (r - chromaRgb[0]) ** 2 +
      (g - chromaRgb[1]) ** 2 +
      (b - chromaRgb[2]) ** 2
    );

    if (distance < tolerance) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
    } else {
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = data[i + 3];
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
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
