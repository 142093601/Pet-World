// ============================================================
// imagegen.ts — 图像生成 API 封装（API2D / DALL-E）
// ============================================================
//
// 策略：
// - Base Pet 用 DALL-E 3（质量高，文生图）
// - 帧生成用 DALL-E 2 的 edit 接口（支持 img2img 参考图）
//
// DALL-E 2 edit 接口：传入 image + prompt，基于原图生成变体
// 虽然画质不如 DALL-E 3，但能锚定参考图保持角色一致性
// ============================================================

import { API_BASE, API_MODEL, API_MODEL_FRAME } from "./config";

export interface GenerateResult {
  imageUrl: string;
  revisedPrompt?: string;
}

/**
 * 文生图（DALL-E 3）
 */
async function callTextToImage(prompt: string): Promise<GenerateResult> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) throw new Error("缺少 IMAGE_API_KEY，请在 .env.local 中配置");

  const res = await fetch(`${API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: API_MODEL,
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const img = data.data?.[0];
  if (!img) throw new Error("API 未返回图片");

  return {
    imageUrl: img.url || `data:image/png;base64,${img.b64_json}`,
    revisedPrompt: data.revised_prompt || undefined,
  };
}

/**
 * 图生图（DALL-E 2 edit 接口）
 *
 * 传入参考图 URL + prompt，基于原图生成变体。
 * 这是保持角色一致性的关键——模型会参考原图的视觉特征。
 */
async function callImageToImage(
  prompt: string,
  referenceImageUrl: string
): Promise<GenerateResult> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) throw new Error("缺少 IMAGE_API_KEY，请在 .env.local 中配置");

  // DALL-E 2 edit 接口需要图片 URL 或 base64
  // API2D 兼容 OpenAI 格式
  const res = await fetch(`${API_BASE}/images/edits`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: API_MODEL_FRAME,
      prompt,
      image: referenceImageUrl,
      n: 1,
      size: "1024x1024",
    }),
  });

  // 如果 edit 接口不可用，回退到 generations（纯文生图，加强 prompt 描述）
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`DALL-E 2 edit 失败 (${res.status})，回退到 DALL-E 3 文生图: ${errText}`);

    return callTextToImage(prompt);
  }

  const data = await res.json();
  const img = data.data?.[0];
  if (!img) throw new Error("API 未返回图片");

  return {
    imageUrl: img.url || `data:image/png;base64,${img.b64_json}`,
  };
}

/**
 * 生成 base pet（基准角色图）
 *
 * Pipeline 第一步。使用 DALL-E 3 生成高质量基准图。
 * chromaKey 参数确保背景色与后续帧一致。
 */
export async function generateBasePet(
  description: string,
  _referenceImageUrl?: string,
  chromaKey: string = "#00FF00"
): Promise<GenerateResult> {
  const prompt = `A single cute chibi pixel art character for a virtual pet game, facing forward.
Character description: ${description}
Style: Cute chibi, thick black outlines, limited color palette (max 8 colors), flat cel shading, pixel art aesthetic, adorable proportions with big head and small body.
The character should be centered in the image, standing in a neutral idle pose.
Background: solid ${chromaKey} for easy removal.
Clean pixel art, no anti-aliasing, no gradients, crisp edges.
Only ONE character, centered, with clear space around it.`;

  return callTextToImage(prompt);
}

/**
 * 生成单帧动画
 *
 * 以 base pet 作为参考图（DALL-E 2 edit），确保角色一致性。
 * 如果 edit 接口不可用，回退到 DALL-E 3 文生图（用更详细的 prompt 描述角色）。
 */
export async function generateFrame(
  description: string,
  frameDescription: string,
  referenceImageUrl: string,
  chromaKey: string
): Promise<GenerateResult> {
  const prompt = `Cute chibi pixel art character, EXACT same design as reference image.
New pose: ${frameDescription}
Character: ${description}
Style: thick black outlines, limited color palette, flat cel shading, pixel art.
Background: solid ${chromaKey}.
Only ONE character, centered, same size as reference.
Keep character design identical — same species, colors, markings, proportions.`;

  return callImageToImage(prompt, referenceImageUrl);
}
