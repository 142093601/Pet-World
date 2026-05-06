// ============================================================
// QADisplay.tsx — QA 结果展示组件
// ============================================================

"use client";

import type { QAResult } from "@/lib/types";

interface QADisplayProps {
  qa: QAResult;
}

export default function QADisplay({ qa }: QADisplayProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-gray-800">
        <span className={qa.passed ? "text-green-500" : "text-red-500"}>
          {qa.passed ? "✅" : "❌"}
        </span>
        <span>QA 验证 {qa.passed ? "通过" : "未通过"}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {qa.checks.map((check, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={check.passed ? "text-green-500" : "text-red-500"}>
              {check.passed ? "✓" : "✗"}
            </span>
            <span className="font-medium text-gray-700">{check.name}</span>
            <span className="text-gray-500">{check.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
