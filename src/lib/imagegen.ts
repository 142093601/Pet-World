// ============================================================
// imagegen.ts — 图像生成 API 封装（API2D / OpenAI 兼容）
// ============================================================
//
// 使用 /images/generations 接口，支持真正的 img2img。
// 通过 `image` 参数传入参考图，模型会基于参考图生成新图。
// ============================================================

import { API_BASE, API_MODEL } from "./config";

export interface GenerateResult {
  imageUrl: string;
  revisedPrompt?: string;
}

/**
 * 调用 /images/generations API 生成图片
 *
 * 支持两种模式：
 * - 文生图：只传 prompt
 * - 图生图：传 prompt + referenceImageUrl（作为 image 参数）
 */
async function callImageAPI(
  prompt: string,
  referenceImageUrl?: string
): Promise<GenerateResult> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 IMAGE_API_KEY，请在 .env.local 中配置");
  }

  const body: Record<string, unknown> = {
    model: API_MODEL,
    prompt: prompt,
    n: 1,
    size: "1024x1024",
  };

  // 图生图：传入参考图
  if (referenceImageUrl) {
    body.image = referenceImageUrl;
  }

  const res = await fetch(`${API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();

  // OpenAI 标准响应格式
  const imageData = data.data?.[0];
  if (!imageData) {
    throw new Error("API 未返回图片数据");
  }

  // url 或 b64_json 都可能返回
  const imageUrl = imageData.url || `data:image/png;base64,${imageData.b64_json}`;

  return { imageUrl, revisedPrompt: data.revised_prompt || undefined };
}

/**
 * 生成 base pet（基准角色图）
 *
 * Pipeline 第一步。产出的角色图将作为所有后续帧生成的锚点。
 * chromaKey 参数确保 base pet 的背景色与后续帧一致。
 */
export async function generateBasePet(
  description: string,
  referenceImageUrl?: string,
  chromaKey: string = "#00FF00"
): Promise<GenerateResult> {
  const prompt = `A single cute chibi pixel art character for a virtual pet game, facing forward.
Character description: ${description}
Style: Cute chibi, thick black outlines, limited color palette (max 8 colors), flat cel shading, pixel art aesthetic, adorable proportions with big head and small body.
The character should be centered in the image, standing in a neutral idle pose.
Background: solid ${chromaKey} for easy removal.
Clean pixel art, no anti-aliasing, no gradients, crisp edges.
Only ONE character, centered, with clear space around it.`;

  return callImageAPI(prompt, referenceImageUrl);
}

/**
 * 生成单帧动画
 *
 * 以 base pet 作为参考图（img2img），确保角色一致性。
 * 每次只生成一个姿态，prompt 更聚焦，质量更高。
 */
export async function generateFrame(
  description: string,
  frameDescription: string,
  referenceImageUrl: string,
  chromaKey: string
): Promise<GenerateResult> {
  const prompt = `This is the EXACT same character from the reference image. Do not change anything about the character design.
Generate a SINGLE animation frame of this character in a new pose.
Pose: ${frameDescription}
Character description: ${description}
Style: MUST be identical to the reference — same colors, same proportions, same outlines, same art style, same size.
Cute chibi pixel art, thick black outlines, limited color palette, flat cel shading.
Background: solid ${chromaKey} for easy removal.
Clean pixel art, no anti-aliasing, no gradients, crisp edges.
Only ONE character, centered, same size as reference.
CRITICAL: Keep the character design 100% identical. Only change the pose.`;

  return callImageAPI(prompt, referenceImageUrl);
}
