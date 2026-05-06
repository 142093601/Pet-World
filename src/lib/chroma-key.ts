// ============================================================
// chroma-key.ts — 智能 Chroma Key 选择
// ============================================================

import { CHROMA_KEY_CANDIDATES, DEFAULT_CHROMA_KEY } from "./config";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
  return Math.sqrt(
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );
}

/**
 * 选择最佳 chroma key 颜色
 *
 * 从候选色中选择与宠物主色调距离最远的颜色，
 * 避免"宠物本体颜色被背景抠掉"的问题。
 */
export function selectChromaKey(
  dominantColors: [number, number, number][]
): string {
  if (dominantColors.length === 0) {
    return DEFAULT_CHROMA_KEY;
  }

  let bestColor = DEFAULT_CHROMA_KEY;
  let bestMinDistance = 0;

  for (const candidate of CHROMA_KEY_CANDIDATES) {
    const candidateRgb = hexToRgb(candidate);
    const minDistance = Math.min(
      ...dominantColors.map((petColor) => colorDistance(candidateRgb, petColor))
    );

    if (minDistance > bestMinDistance) {
      bestMinDistance = minDistance;
      bestColor = candidate;
    }
  }

  return bestColor;
}
