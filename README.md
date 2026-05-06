# 🐾 Pet World

AI 驱动的虚拟宠物生成器——输入描述，生成你的专属宠物 Sprite Sheet。

## 架构设计（v2 重构版）

### 核心变更：借鉴 Codex hatch-pet 的 Pipeline 设计

**旧方案**：一次 API 调用生成整张 sprite sheet（6帧），角色一致性差、布局不可控。

**新方案**：分步生成，逐帧拼装。

```
Step 1: 生成 Base Pet（基准角色图）
   ↓
Step 2: 采样主色调 → 选择最佳 Chroma Key
   ↓
Step 3: 以 Base Pet 为参考，逐帧生成 6 个姿态
   ↓
Step 4: 从每张图中提取角色帧（去背景）
   ↓
Step 5: 拼装成 Sprite Sheet Atlas
   ↓
Step 6: QA 验证（结构 + 视觉一致性）
```

### 为什么这样设计？

| 问题 | 旧方案 | 新方案 |
|------|--------|--------|
| 角色一致性 | ❌ 6帧可能完全不同 | ✅ 所有帧锚定同一张 base pet |
| 布局准确 | ❌ 模型经常画错网格 | ✅ 代码拼装，布局精确 |
| Prompt 复杂度 | ❌ 一个 prompt 塞 6 个姿态 | ✅ 每次只描述一个姿态 |
| 背景去除 | ❌ 未实现 | ✅ 智能 chroma key + 自动抠图 |
| QA 验证 | ❌ 无 | ✅ 结构检查 + 颜色一致性 |

### 一致性保障机制

1. **Canonical Reference**：base pet 作为唯一身份锚点
2. **Grounded Generation**：每帧生成都带 base pet 作为参考图
3. **智能 Chroma Key**：根据宠物颜色自动选择最不冲突的背景色
4. **帧提取**：自动去背景、缩放、对齐
5. **QA 双层验收**：结构正确性（脚本）+ 视觉一致性（颜色分析）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 + React + TypeScript + Tailwind CSS |
| 图像生成 | OpenRouter (GPT Image / Gemini) |
| 图像处理 | Sharp (Node.js) |
| 动画引擎 | Canvas 2D + requestAnimationFrame |

## Sprite Sheet 格式

```
布局: 3 列 × 2 行 = 6 帧
每帧: 256 × 256 px
总计: 768 × 512 px

Row 0: [idle 待机] [walk-1 走路左脚] [walk-2 走路右脚]
Row 1: [happy 开心] [sad 难过] [action 动作]
```

## 快速开始

```bash
git clone https://github.com/142093601/Pet-World.git
cd Pet-World
npm install

# 配置 API Key
cp .env.example .env.local
# 编辑 .env.local 填入你的 OpenRouter API Key

npm run dev
```

访问 http://localhost:3000，输入宠物描述，点击"生成宠物"。

## 项目结构

```
src/
├── lib/
│   ├── types.ts              # 共享类型定义
│   ├── config.ts             # Atlas 布局与动画配置
│   ├── imagegen.ts           # 图像生成 API 封装
│   ├── chroma-key.ts         # 智能 Chroma Key 选择
│   ├── frame-extractor.ts    # 帧提取与背景去除
│   ├── atlas-composer.ts     # Atlas 拼装
│   ├── qa.ts                 # QA 验证
│   └── pipeline.ts           # Pipeline 编排器
├── app/
│   ├── api/
│   │   └── generate-sprite/
│   │       └── route.ts      # API 路由
│   ├── page.tsx              # 主页面
│   ├── layout.tsx            # 根布局
│   └── globals.css           # 全局样式
└── components/
    ├── SpriteAnimation.tsx    # Sprite 动画播放
    └── QADisplay.tsx          # QA 结果展示
```

## 开发路线

- [x] Phase 1 - 美术管线（v2 重构）
  - [x] Base Pet 生成 + 逐帧生成
  - [x] 智能 Chroma Key 选择
  - [x] 帧提取与背景去除
  - [x] Atlas 拼装
  - [x] QA 验证
- [ ] Phase 2 - Agent 灵魂
  - [ ] 宠物性格系统
  - [ ] 记忆系统
  - [ ] 自主决策引擎
- [ ] Phase 3 - 小家系统
- [ ] Phase 4 - 大世界
- [ ] Phase 5 - 联机

## License

MIT
