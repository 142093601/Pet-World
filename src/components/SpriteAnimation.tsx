// ============================================================
// SpriteAnimation.tsx — Sprite 动画播放组件
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { ANIMATION_FRAMES, FRAME_WIDTH, FRAME_HEIGHT } from "@/lib/config";
import type { AnimationState } from "@/lib/types";

interface SpriteAnimationProps {
  spriteUrl: string;
  frameWidth?: number;
  frameHeight?: number;
  frameRate?: number;
  state?: AnimationState;
  scale?: number;
  onClick?: () => void;
}

export default function SpriteAnimation({
  spriteUrl,
  frameWidth = FRAME_WIDTH,
  frameHeight = FRAME_HEIGHT,
  frameRate = 300,
  state = "idle",
  scale = 1,
  onClick,
}: SpriteAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error("Failed to load sprite sheet:", spriteUrl);
    };
    img.src = spriteUrl;
  }, [spriteUrl]);

  useEffect(() => {
    if (!imageLoaded) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const animConfig = ANIMATION_FRAMES[state];
    if (!animConfig) return;

    const drawFrame = (row: number, col: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = frameWidth;
      canvas.height = frameHeight;
      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(
        img,
        col * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight,
        0,
        0,
        frameWidth,
        frameHeight
      );
    };

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    frameIndexRef.current = 0;
    drawFrame(animConfig.row, animConfig.frames[0]);

    if (animConfig.frames.length <= 1) return;

    timerRef.current = setInterval(() => {
      frameIndexRef.current =
        (frameIndexRef.current + 1) % animConfig.frames.length;
      drawFrame(animConfig.row, animConfig.frames[frameIndexRef.current]);
    }, frameRate);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [imageLoaded, state, frameRate, frameWidth, frameHeight]);

  const displayWidth = frameWidth * scale;
  const displayHeight = frameHeight * scale;

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{
        width: displayWidth,
        height: displayHeight,
        imageRendering: "pixelated",
        cursor: onClick ? "pointer" : "default",
      }}
    />
  );
}
