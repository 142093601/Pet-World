// ============================================================
// route.ts — Sprite 生成 API 路由（重构版）
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { FRAME_WIDTH, FRAME_HEIGHT, SPRITE_COLS, SPRITE_ROWS } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, imageUrl } = body;

    if (!description && !imageUrl) {
      return NextResponse.json(
        { error: "请提供宠物描述或参考图片" },
        { status: 400 }
      );
    }

    const result = await runPipeline({
      description: description || "a cute pet character",
      referenceImageUrl: imageUrl,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
      cols: SPRITE_COLS,
      rows: SPRITE_ROWS,
      chromaKey: "", // pipeline 会自动选择
    });

    return NextResponse.json({
      success: true,
      spriteSheet: result.spriteSheetUrl,
      framePreviews: result.framePreviews,
      qa: result.qa,
    });
  } catch (error: unknown) {
    console.error("Sprite generation error:", error);
    const message = error instanceof Error ? error.message : "生成失败，请重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
