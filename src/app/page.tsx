// ============================================================
// page.tsx — 主页面（重构版）
// ============================================================

"use client";

import { useState } from "react";
import SpriteAnimation from "@/components/SpriteAnimation";
import QADisplay from "@/components/QADisplay";
import type { AnimationState, QAResult } from "@/lib/types";

const STATES: { key: AnimationState; label: string; emoji: string }[] = [
  { key: "idle",   label: "待机", emoji: "🧍" },
  { key: "walk",   label: "走路", emoji: "🚶" },
  { key: "happy",  label: "开心", emoji: "🎉" },
  { key: "sad",    label: "难过", emoji: "😢" },
  { key: "action", label: "动作", emoji: "⚡" },
];

export default function Home() {
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [spriteSheet, setSpriteSheet] = useState("");
  const [framePreviews, setFramePreviews] = useState<string[]>([]);
  const [qa, setQa] = useState<QAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<AnimationState>("idle");
  const [scale, setScale] = useState(1);

  const handleGenerate = async () => {
    if (!description.trim() && !imageUrl.trim()) return;

    setLoading(true);
    setError("");
    setSpriteSheet("");
    setFramePreviews([]);
    setQa(null);

    try {
      const res = await fetch("/api/generate-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          imageUrl: imageUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "生成失败");
      }

      setSpriteSheet(data.spriteSheet);
      setFramePreviews(data.framePreviews || []);
      setQa(data.qa || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "生成失败，请重试";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            🐾 Pet World
          </h1>
          <p className="text-gray-500 text-lg">输入描述，生成你的专属宠物</p>
          <p className="text-xs text-gray-400 mt-2">
            Pipeline: Base Pet → 逐帧生成 → 去背景 → 拼装 Atlas → QA 验证
          </p>
        </div>

        {/* Input Area */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🎨 宠物描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：一只蓝色的小猫咪，戴着一顶红色的帽子，性格活泼可爱"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-800"
              rows={3}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📷 参考图片 URL（可选，图生图模式）
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="粘贴图片链接，基于图片风格生成宠物"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-800"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || (!description.trim() && !imageUrl.trim())}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                正在生成宠物（逐帧生成中，请耐心等待）...
              </span>
            ) : (
              "✨ 生成宠物"
            )}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Result Area */}
        {spriteSheet && (
          <div className="space-y-6">
            {/* Animation Preview */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">🎮 你的宠物</h2>

              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 inline-block">
                    <SpriteAnimation
                      spriteUrl={spriteSheet}
                      state={state}
                      scale={scale}
                      frameRate={300}
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
                    {STATES.find((s) => s.key === state)?.emoji}{" "}
                    {STATES.find((s) => s.key === state)?.label}
                  </div>
                </div>

                {/* State Controls */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {STATES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setState(s.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        state === s.key
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>

                {/* Scale Control */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">缩放</span>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.25"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-40"
                  />
                  <span className="text-sm font-mono text-gray-600">{scale}x</span>
                </div>

                {/* Raw Sprite Sheet */}
                <details className="w-full">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    🔍 查看原始 Sprite Sheet
                  </summary>
                  <div className="mt-3 bg-gray-50 rounded-xl p-4 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spriteSheet}
                      alt="Sprite Sheet"
                      className="max-w-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                </details>
              </div>
            </div>

            {/* Frame Previews */}
            {framePreviews.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🖼️ 逐帧预览</h2>
                <div className="grid grid-cols-3 gap-4">
                  {framePreviews.map((preview, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-2 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Frame ${i}`}
                        className="mx-auto"
                        style={{ imageRendering: "pixelated", width: 128, height: 128 }}
                      />
                      <p className="text-xs text-gray-500 mt-1">帧 {i + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QA Result */}
            {qa && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🔍 QA 验证</h2>
                <QADisplay qa={qa} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
