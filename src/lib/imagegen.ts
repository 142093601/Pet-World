// ============================================================
// imagegen.ts — 图像生成 API 封装（OpenRouter）
// ============================================================
//
// 核心设计：每次只生成一个角色的一个姿态，不生成整张 sprite sheet。
// 通过 grounding image（base pet 参考图）保持角色一致性。
// ============================================================

import { OPENROUTER_API_BASE, OPENROUTER_MODEL } from "./config";

export interface GenerateResult {
  imageUrl: string;
  revisedPrompt?: string;
}

/**
 * 调用 OpenRouter Chat Completions API 生成单张图片
 */
async function callImageAPI(
  prompt: string,
  groundingImages: string[] = [],
  aspectRatio: string = "1:1"
): Promise<GenerateResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 OPENROUTER_API_KEY，请在 .env.local 中配置");
  }

  const content: Array<Record<string, unknown>> = [];

  // 加入 grounding images（base pet 参考图）
  for (const imgUrl of groundingImages) {
    content.push({
      type: "image_url",
      image_url: { url: imgUrl },
    });
  }

  // 加入文字提示
  content.push({ type: "text", text: prompt });

  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pet-world.vercel.app",
      "X-Title": "Pet World",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: aspectRatio,
        image_size: "1K",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error("API 未返回有效响应");
  }

  // 提取图片
  if (message.images && message.images.length > 0) {
    const imageData = message.images[0];
    const imgUrl = imageData.image_url?.url || imageData.imageUrl?.url;
    if (imgUrl) {
      return { imageUrl: imgUrl, revisedPrompt: message.content || undefined };
    }
  }

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === "image_url" && part.image_url?.url) {
        return { imageUrl: part.image_url.url };
      }
    }
  }

  const textContent = typeof message.content === "string" ? message.content : "";
  throw new Error(`API 未返回图片数据。响应内容: ${textContent.substring(0, 200)}`);
}

/**
 * 生成 base pet（基准角色图）
 *
 * Pipeline 第一步。产出的角色图将作为所有后续帧生成的锚点。
 */
export async function generateBasePet(
  description: string,
  referenceImageUrl?: string
): Promise<GenerateResult> {
  const prompt = `A single cute chibi pixel art character for a virtual pet game, facing forward.
Character description: ${description}
Style: Cute chibi, thick black outlines, limited color palette (max 8 colors), flat cel shading, pixel art aesthetic, adorable proportions with big head and small body.
The character should be centered in the image, standing in a neutral idle pose.
Background: solid chroma key green (#00FF00) for easy removal.
Clean pixel art, no anti-aliasing, no gradients, crisp edges.
Only ONE character, centered, with clear space around it.`;

  const groundingImages = referenceImageUrl ? [referenceImageUrl] : [];
  return callImageAPI(prompt, groundingImages, "1:1");
}

/**
 * 生成单帧动画
 *
 * 以 base pet 作为 grounding image，确保角色一致性。
 * 每次只生成一个姿态，prompt 更聚焦，质量更高。
 */
export async function generateFrame(
  description: string,
  frameDescription: string,
  groundingImages: string[],
  chromaKey: string
): Promise<GenerateResult> {
  const prompt = `Generate a SINGLE animation frame of this exact same character.
Pose: ${frameDescription}
Character description: ${description}
Style: MUST match the reference character exactly — same colors, same proportions, same outlines, same art style.
Cute chibi pixel art, thick black outlines, limited color palette, flat cel shading.
Background: solid ${chromaKey} (chroma key) for easy removal.
Clean pixel art, no anti-aliasing, no gradients, crisp edges.
Only ONE character, centered, same size as reference.
IMPORTANT: The character design must be IDENTICAL to the reference image. Do not change species, colors, markings, accessories, or proportions.`;

  return callImageAPI(prompt, groundingImages, "1:1");
}
