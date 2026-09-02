# AI Auto Video 部署与启动指南

## 目录

1. [项目概述](#1-项目概述)
2. [环境要求](#2-环境要求)
3. [本地开发部署](#3-本地开发部署)
4. [Docker 部署](#4-docker-部署)
5. [配置说明](#5-配置说明)
6. [单视频生产流程](#6-单视频生产流程)
7. [批量生产](#7-批量生产)
8. [模板生成器](#8-模板生成器)
9. [素材管理](#9-素材管理)
10. [script.json 格式规范](#10-scriptjson-格式规范)
11. [故障排除](#11-故障排除)
12. [项目结构](#12-项目结构)

***

## 1. 项目概述

AI Auto Video 是一个基于 Remotion + edge-tts 的自动化科普视频生产流水线。它接受结构化的 `script.json` 作为输入，自动完成语音合成、字幕生成、场景渲染和视频合成，输出竖屏短视频（1080×1920）。

**核心特性：**

- 5 种视觉模板（数据可视化、插画、电影、极简、信息图）

- 5 种场景类型（文本卡片、图表、动画、图片、混合）

- TTS 语音合成 + 逐词字幕同步（变色+跳动效果）

- ECharts 图表集成 + Lottie 动画支持

- Ken Burns 图片效果 + 多种转场动画

- Docker 一键部署 + 批量生产

***

## 2. 环境要求

### 基础环境

| 组件      | 最低版本 | 推荐版本  |
| ------- | ---- | ----- |
| Node.js | 18.0 | 20.x+ |
| npm     | 9.0  | 10.x+ |
| Python  | 3.9  | 3.11+ |
| FFmpeg  | 4.0  | 5.0+  |
| Git     | 2.0  | 最新    |

### 操作系统要求

- **macOS**: 15.0 (Sequoia) 或更高（Remotion v4 渲染要求）

- **Linux**: Ubuntu 20.04+ / Debian 11+（推荐 Docker 部署）

- **Windows**: WSL2 + Docker Desktop

> **注意**: macOS 13 及以下版本可以运行 Remotion Studio 预览，但渲染时音频合并会失败。生产环境建议使用 Docker/Linux 或 macOS 15+。

### Python 依赖

```bash
pip install edge-tts
```

***

## 3. 本地开发部署

### 3.1 克隆项目

```bash
git clone <repository-url>
cd aiautovideo
```

### 3.2 安装 Node.js 依赖

```bash
npm install
```

### 3.3 安装 Python 依赖

```bash
pip install edge-tts
```

### 3.4 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入 API Key 等信息
```

### 3.5 验证安装

```bash
# TypeScript 编译检查
npm run build

# 启动 Remotion Studio（预览模式）
npm run dev
# 访问 http://localhost:3000

# 校验 script.json
npx tsx scripts/validate.ts scripts/football_script.json
```

### 3.6 完整流水线测试

```bash
# 单个视频生产（含 TTS + 渲染）
npx tsx scripts/pipeline.ts scripts/football_script.json

# 跳过 TTS（使用已有音频）
npx tsx scripts/pipeline.ts scripts/football_script.json --skip-tts
```

***

## 4. Docker 部署

### 4.1 构建镜像

```bash
docker build -t aiautovideo .
```

### 4.2 使用 Docker Compose

**启动 Remotion Studio 预览服务：**

```bash
docker-compose up video-renderer
# 访问 http://localhost:3000
```

**批量生产视频：**

```bash
docker-compose run --rm batch-producer
```

**仅运行 TTS 合成：**

```bash
docker-compose run --rm tts-only
```

### 4.3 直接使用 Docker 命令

**渲染单个视频：**

```bash
docker run --rm \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/scripts:/app/scripts \
  -v $(pwd)/.env:/app/.env:ro \
  aiautovideo \
  npx tsx scripts/pipeline.ts /app/scripts/football_script.json
```

**批量渲染：**

```bash
docker run --rm \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/scripts:/app/scripts \
  aiautovideo \
  npx tsx scripts/batch.ts /app/scripts --rotate-templates
```

### 4.4 Docker 环境变量

在 `.env` 文件中配置：

```env
EDGE_TTS_DEFAULT_VOICE=zh-CN-YunxiNeural
EDGE_TTS_DEFAULT_RATE=+10%
PEXELS_API_KEY=your_key_here
UNSPLASH_ACCESS_KEY=your_key_here
REMOTION_CONCURRENCY=2
OUTPUT_DIR=/app/output
RESOLUTION_WIDTH=1080
RESOLUTION_HEIGHT=1920
FPS=30
```

***

## 5. 配置说明

### 5.1 .env 配置项

| 变量                       | 说明              | 默认值               |
| ------------------------ | --------------- | ----------------- |
| `EDGE_TTS_DEFAULT_VOICE` | TTS 默认语音        | zh-CN-YunxiNeural |
| `EDGE_TTS_DEFAULT_RATE`  | TTS 默认语速        | +10%              |
| `PEXELS_API_KEY`         | Pexels API 密钥   | （空）               |
| `UNSPLASH_ACCESS_KEY`    | Unsplash API 密钥 | （空）               |
| `REMOTION_CONCURRENCY`   | 渲染并发数           | 2                 |
| `OUTPUT_DIR`             | 输出目录            | ./output          |
| `RESOLUTION_WIDTH`       | 视频宽度            | 1080              |
| `RESOLUTION_HEIGHT`      | 视频高度            | 1920              |
| `FPS`                    | 帧率              | 30                |

### 5.2 remotion.config.ts

```typescript
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(2);  // 可通过环境变量覆盖
```

### 5.3 tsconfig.json

项目使用 ES2020 目标，React JSX，严格模式。

***

## 6. 单视频生产流程

### 6.1 完整流水线（TTS + 渲染）

```bash
npx tsx scripts/pipeline.ts scripts/football_script.json
```

### 6.2 分步执行

**Step 1: 校验 script.json**

```bash
npx tsx scripts/validate.ts scripts/football_script.json
```

**Step 2: TTS 语音合成**

```bash
# 合成所有场景的语音（自动保存到 output/<video_id>/audio/）
# 通过 pipeline 或直接调用
npx tsx scripts/pipeline.ts scripts/football_script.json --skip-tts
```

**Step 3: 预取素材**

```bash
npx tsx scripts/assets.ts prefetch scripts/football_script.json
```

**Step 4: 渲染视频**

```bash
# 使用已有音频渲染
npx tsx scripts/pipeline.ts scripts/football_script.json --skip-tts

# 直接使用 Remotion CLI
npx remotion render src/index.ts MainVideo output/football_005.mp4 \
  --props="output/football_005/audio/render_props.json" \
  --concurrency=2
```

**Step 5: 指定音频目录**

```bash
npx tsx scripts/pipeline.ts scripts/football_script.json \
  --skip-tts \
  --audio-dir output/football_005/audio
```

### 6.3 输出文件结构

```
output/
├── football_005/
│   ├── audio/
│   │   ├── scene_1.mp3
│   │   ├── scene_2.mp3
│   │   ├── ...
│   │   ├── scene_9999.mp3     # outro 音频
│   │   ├── audio_meta.json    # 音频元数据
│   │   └── render_props.json  # 渲染属性
│   ├── football_005.mp4       # 最终视频
│   └── football_005_summary.json
├── assets_cache/
│   └── manifest.json
├── logs/
│   └── pipeline_*.log
└── batch_summary.json
```

***

## 7. 批量生产

### 7.1 批量渲染目录中的所有脚本

```bash
npx tsx scripts/batch.ts scripts/ --output output/batch
```

### 7.2 批量生产选项

| 选项                   | 说明            |
| -------------------- | ------------- |
| `--output <dir>`     | 输出目录          |
| `--tts-only`         | 仅运行 TTS，跳过渲染  |
| `--skip-tts`         | 跳过 TTS，使用已有音频 |
| `--rotate-templates` | 轮换使用 5 种视觉模板  |
| `--concurrency <n>`  | 渲染并发数（默认 2）   |

### 7.3 示例

**批量 TTS 合成（不渲染）：**

```bash
npx tsx scripts/batch.ts scripts/ --tts-only --output output/batch
```

**批量渲染（使用已有音频 + 模板轮换）：**

```bash
npx tsx scripts/batch.ts scripts/ --skip-tts --rotate-templates --output output/batch
```

**Docker 中批量生产：**

```bash
docker-compose run --rm batch-producer
```

### 7.4 批量生产日志

日志保存在 `output/logs/` 目录下，包含：

- `pipeline_<timestamp>.log` — 实时日志

- `batch_log.json` — 结构化日志摘要

- `batch_summary.json` — 批量结果总结

***

## 8. 模板生成器

### 8.1 从文案自动生成 script.json

```bash
# 从文本文件生成
npx tsx scripts/generate /path/to/narration.txt --output scripts/generated.json

# 指定模板
npx tsx scripts/generate /path/to/narration.txt --template cinematic_style

# 生成所有 5 种模板版本
npx tsx scripts/generate --all-templates /path/to/narration.txt --output-dir output/generated
```

### 8.2 可用模板

| 模板名                  | 风格          | 适用场景    |
| -------------------- | ----------- | ------- |
| `data_visual_style`  | 深色背景+网格+数据感 | 数据分析、科技 |
| `illustration_style` | 暖色+圆角+柔和    | 生活科普、教育 |
| `cinematic_style`    | 暗色+金色+衬线字体  | 叙事、历史   |
| `minimal_style`      | 白色+简洁+无装饰   | 极简、专业   |
| `infographic_style`  | 浅色+圆点+信息图   | 信息密集型   |

***

## 9. 素材管理

### 9.1 素材管理命令

```bash
# 查看 Pexels 图片
npx tsx scripts/assets.ts search "足球"

# 查看 Pexels 视频
npx tsx scripts/assets.ts search-video "宇宙"

# 下载单个素材
npx tsx scripts/assets.ts download "https://example.com/image.jpg" "football_bg.jpg"

# 预取脚本所需素材
npx tsx scripts/assets.ts prefetch scripts/football_script.json

# 自动获取缺失素材
npx tsx scripts/assets.ts auto-fetch scripts/football_script.json

# 查看缓存统计
npx tsx scripts/assets.ts stats

# 清空缓存
npx tsx scripts/assets.ts clear
```

### 9.2 Pexels API 配置

1. 访问 <https://www.pexels.com/api/> 注册获取 API Key
2. 在 `.env` 文件中设置：

   ```env
   PEXELS_API_KEY=your_api_key_here
   ```

***

## 10. script.json 格式规范

### 10.1 完整结构

```json
{
  "video_id": "unique_id",
  "title": "视频标题",
  "resolution": { "width": 1080, "height": 1920 },
  "fps": 30,
  "template": "data_visual_style",
  "global_style": {
    "font_family": "Noto Sans SC, sans-serif",
    "primary_color": "#4A90D9",
    "accent_color": "#F5A623",
    "bg_color": "#0F1923",
    "text_color": "#E0E7FF"
  },
  "voice": {
    "provider": "edge-tts",
    "voice_name": "zh-CN-YunxiNeural",
    "rate": "+10%",
    "pitch": "+0Hz",
    "volume": "+0%"
  },
  "subtitle_style": {
    "font_size": 42,
    "font_family": "Noto Sans SC, sans-serif",
    "color": "#FFFFFF",
    "highlight_color": "#F5A623",
    "stroke_color": "#000000",
    "stroke_width": 3,
    "animation": "bounce",
    "position": "bottom",
    "offset_y": 180,
    "max_width": 900
  },
  "scenes": [
    {
      "scene_id": 1,
      "narration": "旁白文字内容",
      "duration": 10,
      "visual": {
        "type": "text_card",
        "title": "标题",
        "subtitle": "副标题",
        "animation": "fade_in_zoom"
      },
      "transition_in": "fade",
      "transition_out": "slide_left"
    }
  ],
  "outro": {
    "duration": 8,
    "narration": "结尾旁白",
    "visual": {
      "type": "cta_card",
      "text": "关注我",
      "animation": "fade_in_zoom"
    },
    "transition_in": "fade"
  }
}
```

### 10.2 场景类型 (visual.type)

| 类型          | 必需字段                         | 可选字段                            |
| ----------- | ---------------------------- | ------------------------------- |
| `text_card` | title, animation             | subtitle, bg\_image, components |
| `chart`     | chart\_type, data, animation | components                      |
| `animation` | animation\_source            | overlay\_components             |
| `image`     | image\_source, effect        | overlay\_components             |
| `mixed`     | elements                     | —                               |

### 10.3 转场类型

`fade` | `slide_left` | `slide_right` | `slide_up` | `zoom_in` | `zoom_out` | `wipe` | `bounce` | `none`

### 10.4 字幕动画

`bounce` | `slide` | `fade` | `pop`

### 10.5 可用语音 (edge-tts)

| 语音名称                 | 风格      |
| -------------------- | ------- |
| zh-CN-YunxiNeural    | 男声，年轻活泼 |
| zh-CN-XiaoxiaoNeural | 女声，温和自然 |
| zh-CN-YunyangNeural  | 男声，新闻播报 |
| zh-CN-XiaoyiNeural   | 女声，温暖亲切 |
| zh-CN-YunjianNeural  | 男声，沉稳有力 |

***

## 11. 故障排除

### 11.1 常见问题

**Q: edge-tts 报 "NoAudioReceived" 错误**

- A: 检查网络连接，edge-tts 需要访问微软在线服务

- A: 尝试缩短文本，过长的文本可能被拒绝

- A: 检查 voice\_name 是否正确

**Q: Remotion 渲染时音频合并失败 (macOS)**

- A: macOS 13 及以下版本不兼容 Remotion v4 的音频处理

- A: 使用 Docker 部署，或升级到 macOS 15+

- A: 仍可渲染单帧（`npx remotion still`），仅音频合并失败

**Q: Pexels API 返回空结果**

- A: 检查 `.env` 中的 `PEXELS_API_KEY` 是否正确

- A: 尝试使用英文关键词搜索

**Q: TypeScript 编译错误**

- A: 运行 `npm install` 确保依赖完整

- A: 运行 `npx tsc --noEmit` 查看详细错误

**Q: 渲染速度慢**

- A: 增大并发数：`--concurrency=4`

- A: 降低分辨率：在 script.json 中设置 720x1280

- A: 使用 `--image-format=jpeg`（默认）

### 11.2 日志位置

- 流水线日志: `output/logs/pipeline_*.log`

- 批量日志: `output/logs/batch_log.json`

- 渲染摘要: `output/<video_id>/<video_id>_summary.json`

***

## 12. 项目结构

```
aiautovideo/
├── src/                           # 源代码
│   ├── index.ts                   # Remotion 入口
│   ├── Root.tsx                  # 根 Composition
│   ├── VideoComposition.tsx       # 主视频合成组件
│   ├── types/
│   │   └── script.ts              # TypeScript 类型定义
│   ├── templates/                  # 5 套视觉模板
│   │   ├── index.ts
│   │   ├── DataVisualStyle.ts
│   │   ├── IllustrationStyle.ts
│   │   ├── CinematicStyle.ts
│   │   ├── MinimalStyle.ts
│   │   └── InfographicStyle.ts
│   ├── components/                # React 组件
│   │   ├── Scene.tsx              # 场景分发器
│   │   ├── Subtitle.tsx           # 动画字幕
│   │   ├── EChartComponent.tsx    # ECharts 集成
│   │   ├── LottieComponent.tsx    # Lottie 动画集成
│   │   ├── TransitionSeries.tsx  # 转场系统
│   │   └── scenes/               # 场景组件
│   │       ├── TextCardScene.tsx
│   │       ├── ChartScene.tsx
│   │       ├── AnimationScene.tsx
│   │       ├── ImageScene.tsx
│   │       └── MixedScene.tsx
│   └── utils/                     # 工具函数
│       ├── animations.ts          # 动画工具
│       ├── helpers.ts             # 辅助函数
│       └── assetManager.ts        # 素材管理器
├── scripts/                       # 脚本
│   ├── pipeline.ts                # 核心流水线
│   ├── batch.ts                   # 批量生产
│   ├── tts.ts                     # TTS TypeScript 层
│   ├── tts.py                     # TTS Python 脚本
│   ├── validate.ts                # 脚本校验器
│   ├── assets.ts                  # 素材管理 CLI
│   ├── template_generator.ts      # 模板生成器
│   ├── logger.ts                  # 进度日志
│   ├── football_script.json       # 样例脚本
│   └── render_props.json          # 渲染属性
├── output/                        # 输出目录
│   ├── football_005/
│   │   ├── audio/
│   │   └── *.mp4
│   ├── assets_cache/
│   ├── logs/
│   └── generated/
├── Dockerfile                     # Docker 构建文件
├── docker-compose.yml             # Docker Compose 编排
├── package.json                   # Node.js 项目配置
├── tsconfig.json                 # TypeScript 配置
├── remotion.config.ts             # Remotion 配置
├── .env.example                   # 环境变量模板
├── .dockerignore
├── .gitignore
└── DEPLOYMENT.md                  # 本文档
```

***

## 快速开始

```bash
# 1. 安装依赖
npm install && pip install edge-tts

# 2. 配置环境
cp .env.example .env

# 3. 校验样例脚本
npx tsx scripts/validate.ts scripts/football_script.json

# 4. 生成语音
npx tsx scripts/batch.ts scripts/football_script.json --tts-only

# 5. 启动预览
npm run dev
# 访问 http://localhost:3000

# 6. 渲染视频
npx tsx scripts/pipeline.ts scripts/football_script.json --skip-tts

# 或使用 Docker
docker-compose up video-renderer  # 预览
docker-compose run --rm batch-producer  # 批量
```

