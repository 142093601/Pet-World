# Pet-World 修复方案

## 问题概述

当前项目的 Sprite Sheet 生成管线存在 4 个核心问题，导致**无法实现"所有帧锚定同一张 base pet 生成合适的动作帧"**这一设计目标。

---

## 问题清单

### 🔴 问题一：Grounding Image 不是真正的锚点（致命）

**文件**：`src/lib/imagegen.ts` → `callImageAPI()`

**现状**：base pet 图片作为普通 multimodal content 传给 Gemini Flash Image Preview 模型。

```typescript
// 当前代码
const content: Record<string, unknown>[] = [];
for (const imgUrl of groundingImages) {
  content.push({ type: "image_url", image_url: { url: imgUrl } });
}
content.push({ type: "text", text: prompt });
```

**问题**：Gemini Flash Image Preview 是**多模态理解模型**，不是 img2img 生成模型。它能"看懂"参考图，但不能"照着画"。Prompt 中的 "MUST match exactly" "IDENTICAL" 只是自然语言提示，模型可以自由忽略。

**影响**：每帧生成的角色外观、配色、比例可能与 base pet 完全不同。

---

### 🔴 问题二：Base Pet 和后续帧的背景色不一致（严重）

**文件**：`src/lib/imagegen.ts`

**现状**：

- `generateBasePet()` 硬编码背景为绿色 `#00FF00`
- `generateFrame()` 使用动态选择的 `chromaKey`

```typescript
// generateBasePet 中
Background: solid chroma key green (#00FF00) for easy removal.

// generateFrame 中
Background: solid ${chromaKey} (chroma key) for easy removal.
```

**问题**：chromaKey 是根据 base pet 主色调从候选列表中选择的"最不冲突的颜色"。如果宠物本身是绿色系，chromaKey 可能变成 `#FF00FF`（品红）或 `#00FFFF`（青色）。

**影响**：
- 模型看到参考图是绿底，却被要求画品红底 → 产生混乱
- 帧提取时用错误的颜色去抠图 → 角色边缘残留或被误删

---

### 🟡 问题三：帧间完全独立，无动画连贯性（中等）

**文件**：`src/lib/pipeline.ts`

**现状**：6 帧是完全独立的 API 调用，每次都只传 base pet 作为参考。

```typescript
for (const frame of ALL_FRAMES) {
  const frameResult = await generateFrame(
    description, frame.description,
    [baseResult.imageUrl],  // 每帧只看 base pet，帧间无关联
    chromaKey
  );
}
```

**问题**：walk-1 和 walk-2 应该是连贯的走路动画，但它们完全独立生成，无法确保左右脚交替的连贯性。

---

### 🟡 问题四：帧提取未对齐角色中心（中等）

**文件**：`src/lib/frame-extractor.ts`

**现状**：对每帧做了 `fit: "contain"` 的 resize。

```typescript
const resized = await sharp(imageBuffer)
  .resize(targetWidth, targetHeight, { fit: "contain", background: chromaKey })
```

**问题**：如果模型生成的角色在每张图里位置/大小不同（大概率），contain resize 会保持宽高比但角色在 256×256 里的相对位置可能飘忽不定。

**影响**：拼成 sprite sheet 后，角色看起来"跳来跳去"。

---

## 修复方案

### 方案一：更换图像生成 API（解决问题一）

**目标**：使用真正支持 img2img 的模型，让参考图成为真正的锚点。

**推荐**：硅基流动 (SiliconFlow) + Kolors 模型

| 项目 | 改动 |
|------|------|
| 文件 | `src/lib/config.ts` |
| 改动 | API 地址 + 模型名 |

```typescript
// config.ts — 修改前
export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODEL = "google/gemini-3.1-flash-image-preview";

// config.ts — 修改后
export const API_BASE = "https://api.siliconflow.cn/v1";
export const API_MODEL = "Kwai-Kolors/Kolors";
```

**备选方案**：API2D（`https://api2d.com`）+ GPT Image，效果最好但价格稍高。

---

### 方案二：重构 imagegen.ts 适配新 API（解决问题一）

**目标**：改用 `/images/generations` 接口 + `image` 参数传参考图。

```typescript
// imagegen.ts — 重写 callImageAPI()

async function callImageAPI(
  prompt: string,
  referenceImageUrl?: string,
  aspectRatio: string = "1:1"
): Promise<GenerateResult> {
  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) throw new Error("缺少 IMAGE_API_KEY");

  const body: Record<string, unknown> = {
    model: API_MODEL,
    prompt: prompt,
    image_size: "1024x1024",
    num_inference_steps: 25,
    guidance_scale: 7.5,
  };

  // 关键：传入 reference image 实现 img2img
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
    const err = await res.text();
    throw new Error(`API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error("API 未返回图片");

  return { imageUrl };
}
```

---

### 方案三：统一背景色（解决问题二）

**目标**：base pet 和所有后续帧使用同一个 chromaKey。

**文件**：`src/lib/pipeline.ts`

```typescript
// pipeline.ts — 修改流程

// Step 1: 生成 base pet
const baseResult = await generateBasePet(description, referenceImageUrl);
const baseBuffer = await downloadImage(baseResult.imageUrl);

// Step 2: 选择 chroma key
const dominantColors = await sampleColors(baseBuffer);
const chromaKey = selectChromaKey(dominantColors);

// Step 3: 用同一个 chromaKey 重新生成带正确背景的 base pet
//         （或者修改 generateBasePet 让它接受 chromaKey 参数）
const baseResultFinal = await generateBasePet(description, referenceImageUrl, chromaKey);
```

**具体改动**：

```typescript
// imagegen.ts — generateBasePet 增加 chromaKey 参数
export async function generateBasePet(
  description: string,
  referenceImageUrl?: string,
  chromaKey: string = "#00FF00"   // ← 新增
): Promise<GenerateResult> {
  const prompt = `A single cute chibi pixel art character ...
Background: solid ${chromaKey} for easy removal.
...`;
  return callImageAPI(prompt, referenceImageUrl);
}
```

---

### 方案四：帧提取对齐角色中心（解决问题四）

**目标**：检测角色边界框，居中对齐后再 resize。

**文件**：`src/lib/frame-extractor.ts`

```typescript
export async function extractFrame(
  imageBuffer: Buffer,
  chromaKey: string,
  targetWidth: number = FRAME_WIDTH,
  targetHeight: number = FRAME_HEIGHT
): Promise<Buffer> {
  const chromaRgb = hexToRgb(chromaKey);
  const tolerance = 60;

  // 1. 先做原始尺寸的抠图
  const raw = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = raw;
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;

  // 2. 检测角色边界框（非背景像素）
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const dist = Math.sqrt(
        (r - chromaRgb[0])**2 + (g - chromaRgb[1])**2 + (b - chromaRgb[2])**2
      );
      if (dist >= tolerance) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 3. 扩展边界并居中裁切
  const padding = 10;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(info.width - 1, maxX + padding);
  maxY = Math.min(info.height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // 4. 裁切 → 居中放到目标尺寸 → 抠图
  const cropped = await sharp(imageBuffer)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .resize(targetWidth, targetHeight, {
      fit: "contain",
      background: chromaKey,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 5. 最终抠图
  const pixels = Buffer.alloc(cropped.data.length);
  for (let i = 0; i < cropped.data.length; i += 4) {
    const r = cropped.data[i], g = cropped.data[i+1], b = cropped.data[i+2];
    const dist = Math.sqrt(
      (r - chromaRgb[0])**2 + (g - chromaRgb[1])**2 + (b - chromaRgb[2])**2
    );
    if (dist < tolerance) {
      pixels[i] = pixels[i+1] = pixels[i+2] = pixels[i+3] = 0;
    } else {
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = cropped.data[i+3];
    }
  }

  return sharp(pixels, {
    raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 },
  }).png().toBuffer();
}
```

---

### 方案五（进阶）：提升帧间连贯性（解决问题三）

**目标**：让连续帧之间有关联，而非完全独立。

**策略 A — 前帧参考法**：每帧生成时，不仅传 base pet，还传上一帧的结果。

```typescript
// pipeline.ts
let prevFrameUrl = baseResult.imageUrl;

for (const frame of ALL_FRAMES) {
  const frameResult = await generateFrame(
    description, frame.description,
    [baseResult.imageUrl, prevFrameUrl],  // base + 上一帧
    chromaKey
  );
  prevFrameUrl = frameResult.imageUrl;  // 链式传递
}
```

**策略 B — 同类帧分组**：walk-1 和 walk-2 一起生成描述，增强关联性。

```typescript
// 在 prompt 中加入前后帧关系
const walkPrompt = `This is walking frame 2 of 2. 
Frame 1 was left foot forward. This frame should be right foot forward.
The character must be identical to the reference, same position and size.`;
```

---

## 改动文件汇总

| 文件 | 改动内容 | 优先级 |
|------|---------|--------|
| `src/lib/config.ts` | 换 API 地址和模型名 | P0 |
| `src/lib/imagegen.ts` | 重写为 img2img 接口 + 统一 chromaKey | P0 |
| `src/lib/pipeline.ts` | 统一背景色 + 帧间参考传递 | P1 |
| `src/lib/frame-extractor.ts` | 角色边界检测 + 居中对齐 | P1 |
| `.env.example` | 更新环境变量名 | P2 |

## 环境变量变更

```bash
# .env.example — 修改前
OPENROUTER_API_KEY=your_key_here

# .env.example — 修改后
IMAGE_API_KEY=your_siliconflow_or_api2d_key_here
```

---

## 验证方式

修复后，按以下标准验收：

1. **视觉一致性**：6 帧角色的物种、配色、比例应明显一致
2. **背景抠图**：所有帧的背景应被干净去除，无彩色残留
3. **位置对齐**：角色在各帧中应居中，无明显跳动
4. **动画连贯**：walk-1/walk-2 应呈现明显的走路交替姿态
5. **QA 通过**：颜色一致性检查的最大差异值应显著降低（目标 < 60）
