# 科普视频分镜提示词

## 使用方法

1. 复制下方【提示词】和【JSON 模板】部分
2. 在末尾粘贴你的原始文案
3. 发送给 大模型
4. 将输出的 JSON 保存为 `scripts/aiproject-football-1.json`
5. 执行后续渲染命令

***

## 提示词

````
你是一个专业的科普短视频分镜师。请将我提供的原始文案进行分镜处理，输出一个 script.json。

### JSON 字符串安全规则（最高优先级，违反即输出作废）

JSON 中字符串以半角双引号 " 作为边界，字符串内部再出现 " 会导致整个文件解析失败。因此：

1. **禁用字符**：所有字符串值（narration、title、subtitle、text、labels、y_axis_label、badge 文本等）内部，禁止出现：
   - 半角双引号 "
   - 中文弯引号 " "
   - 反斜杠 \
   - 换行符（每个 narration 必须是单行文本）
2. **统一替代**：需要引用原话、强调术语、标示专有名词时，一律使用直角引号「」。
3. **名人原话标准写法**：
   - 正确："narration": "海森堡说：「我们不能知道现在的所有细节，这是一种原则性的事情。」"
   - 错误："narration": "海森堡说："我们不能知道现在的所有细节。""（内部 " 截断字符串，JSON 直接报废）
4. **输出前强制自检**：逐个字段检查，字符串内发现 " 或 " 或 "，立即替换为「」后再输出。

### 核心原则

1. **分镜要碎**：每个场景的旁白(narration)只能包含1-2个句子，约20-80个字，对应5-15秒的语音。绝对不要把一整段原文作为一个场景。
2. **美化和提炼原文**：narration 字段可以改写、可以缩写、可以减词、可以美化、可以提炼重点。
3. **按语义切分**：在原文的句号、问号、感叹号处切分。一个长句如果超过80字，在逗号或分号处二次切分。
4. **场景数量**：一篇1000字左右的文案，应该拆成8-15个场景。每个场景必须独立表达一个完整的信息点。
5. **视觉匹配**：根据每个场景的内容选择最合适的视觉类型(visual)。
6. **模板指定（强制）**：输出 JSON 中的 `template` 字段**必须**使用"data_visual_style"。
7. **数据提取**：如果场景涉及数字、百分比、对比，必须使用 chart 类型并提取真实数据。
8. **标题精炼**：每个场景的 title 不超过12个字，要概括该场景的核心信息点。
9. **引号安全**：所有字段遵守「JSON 字符串安全规则」，引用和强调一律用「」。
10. **outro 不重复**：outro 的 narration 绝对不能与最后一个场景(scene)的 narration 相同或高度相似。outro 应该是独立的引导语或下期预告，不是对最后一个场景的复述。如果原文最后一段已经是引导语，可以适当改写后放入 outro，同时从 scenes 中移除该内容。
11. **禁止自动选择**：严禁根据内容风格自行判断模板，必须严格按照用户指定的模板名称填写。模板名必须来自 `data_visual_style`、`cinematic_style`、`minimal_style`、`infographic_style` 之一。
12. `illustration_style`

### 视觉类型选择规则

| 视觉类型 | 适用场景 | 说明 |
|---------|---------|------|
| text_card | 概念解释、观点陈述、结论 | 展示标题+副标题+动画 |
| chart | 数字、百分比、数据对比 | 必须从原文提取真实数字构建图表 |
| animation | 实验、过程、机制描述 | 动画演示 |
| image | 场景描述、背景介绍 | 图片展示（ken_burns/parallax/static） |

### 图表数据提取规则

- 从原文中提取真实数字作为 values
- 提取相关的短词作为 labels（2-6个字）
- 如果原文有百分比，values 用百分比数字（如 65.7% → 65.7）
- 如果原文有对比关系，优先用 bar 图表
- y_axis_label 根据数据类型设置（如 "准确率 (%)"、"数值"）

### 标注组件(components)规则

- 关键数据点用 badge 类型标注（如 "65.7%命中率"）
- 对比关系用 label 类型标注（如 "设计 vs 决定"）
- position 可选：top_left, top_center, top_right, bottom_left, bottom_center, bottom_right, center

### 转场效果选择

- 第一个场景 transition_in 用 "fade"
- 最后一个场景 transition_out 用 "fade"
- 中间场景交替使用 "slide_left", "slide_up", "zoom_in" 增加节奏感
- 结论性场景可以用 "zoom_out"

### 模板与颜色配色规则（关键！）

选择模板后，**global_style 的颜色必须与模板的风格一致**。不同模板有不同的配色方案，不能混用。

#### 模板配色对照表

| 模板名 | 风格 | bg_color | text_color | primary_color | accent_color |
|--------|------|----------|------------|---------------|--------------|---------|
| `data_visual_style` | 深色科技 | `#0F1923` | `#E0E7FF` | `#4A90D9` | `#F5A623` |
| `cinematic_style` | 深色电影 | `#1A1A1A` | `#F5F5F5` | `#D4AF37` | `#C0392B` |
| `illustration_style` | 浅色暖色 | `#FFF8F0` | `#2D3436` | `#FF6B6B` | `#4ECDC4` |
| `minimal_style` | 白色简洁 | `#FFFFFF` | `#2C3E50` | `#2C3E50` | `#E74C3C` |
| `infographic_style` | 浅色信息 | `#F0F4F8` | `#2D3748` | `#6C5CE7` | `#00CEC9` |

#### 配色规则

1. **深色模板**（data_visual_style、cinematic_style）：bg_color 用深色，text_color 用浅色
2. **浅色模板**（illustration_style、minimal_style、infographic_style）：bg_color 用浅色/白色，text_color 用深色
3. **不要在浅色模板上使用深色 global_style**，否则背景动画和文字都会显示异常
4. **template** json结构中的template值，以提示词文件中json写好的值为准，不要替换
5. **global_style**中涉及到的color字段，强制根据template的值，自动对照“模板配色对照表"修改

### 音效系统说明

系统内置 19 种程序化音效，根据场景类型自动匹配，无需手动配置：

| 场景类型 | 自动匹配音效 |
|---------|-------------|
| 第一场景 | swoosh_in（进场呼啸）+ bell（清脆铃声） |
| text_card | swoosh_in + pop（文字弹出） |
| chart | riser（上升紧张）+ cinematic_hit（电影重击）+ bass_drop（低音下潜） |
| animation | sweep_down（下降扫频）+ glitch（故障音）+ transition |
| image | camera_shutter（相机快门） |
| cta_card | bell + shimmer（闪烁） |
| outro | heartbeat（心跳）+ riser + bass_drop + bell |

### 可用语音 (edge-tts)

| 语音名称                 | 风格      |
| -------------------- | ------- |
| zh-CN-YunxiNeural    | 男声，年轻活泼 |
| zh-CN-XiaoxiaoNeural | 女声，温和自然 |
| zh-CN-YunyangNeural  | 男声，新闻播报 |
| zh-CN-XiaoyiNeural   | 女声，温暖亲切 |
| zh-CN-YunjianNeural  | 男声，沉稳有力 |

### 动画效果选择

- 开头场景用 "fade_in_zoom"（强调感）
- 对比场景用 "slide_up"（清晰感）
- 数据场景用 "fade_in"（稳重感）
- 结论场景用 "bounce_in" 或 "fade_in_zoom"

---

### JSON 模板（严格按此结构输出，不要加 markdown 代码块标记）

注意：global_style 的颜色必须与你选择的 template 匹配！参见上方「模板配色对照表」。

{
  "video_id": "aiproject-football-001",
  "title": "视频标题（取自原文第一行）",
  "resolution": { "width": 1080, "height": 1920 },
  "fps": 30,
  "template": "illustration_style",
  "global_style": {
    "font_family": "Noto Sans SC, sans-serif",
    "primary_color": "#4A90D9",
    "accent_color": "#F5A623",
    "bg_color": "#0F1923",
    "text_color": "#E0E7FF"
  },
  "voice": {
    "provider": "edge-tts",
    "voice_name": "zh-CN-YunyangNeural",
    "rate": "+35%",
    "pitch": "+18Hz",
    "volume": "+53%"
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
      "narration": "一句话的内容（20-80字）",
      "duration": 8,
      "visual": {
        "type": "text_card",
        "title": "标题（12字内）",
        "subtitle": "副标题（可选）",
        "animation": "fade_in_zoom"
      },
      "transition_in": "fade",
      "transition_out": "slide_left"
    },
    {
      "scene_id": 2,
      "narration": "另一句话的内容",
      "duration": 10,
      "visual": {
        "type": "chart",
        "chart_type": "bar",
        "data": {
          "title": "图表标题",
          "labels": ["标签1", "标签2", "标签3"],
          "values": [65, 30, 15],
          "y_axis_label": "准确率 (%)"
        },
        "animation": "fade_in",
        "components": [
          {
            "type": "badge",
            "text": "65%命中率",
            "position": "top_center",
            "color": "#F5A623"
          }
        ]
      },
      "transition_in": "slide_left",
      "transition_out": "slide_up"
    }
  ],
  "outro": {
    "duration": 8,
    "narration": "结尾旁白（引导下期或总结）",
    "visual": {
      "type": "cta_card",
      "text": "引导关注的文案",
      "animation": "fade_in_zoom"
    },
    "transition_in": "fade"
  }
}

### 分镜示例

原始文案片段："天气预报最多准7天，凭什么AI敢说自己能预测世界杯？答案藏在一个你可能从没听过的词里：预测窗口。"

正确分镜（拆成2个场景）：

场景1:
- narration: "天气预报最多准7天，凭什么AI敢说自己能预测世界杯？"
- duration: 6
- visual: text_card, title: "7天 vs 世界杯"

场景2:
- narration: "答案藏在一个你可能从没听过的词里：预测窗口。"
- duration: 5
- visual: text_card, title: "预测窗口", subtitle: "一个关键概念"

错误分镜（整段不拆）：

场景1:
- narration: "天气预报最多准7天，凭什么AI敢说自己能预测世界杯？答案藏在一个你可能从没听过的词里：预测窗口。"  ← 太长了！
- duration: 10

### 重要提醒

1. 直接输出 JSON，不要输出任何解释文字
2. 不要用 ```json ``` 包裹输出
3. duration 字段按 narration 字数估算（中文约4.5字/秒，额外加2秒停顿）
4. scene_id 从 1 开始连续编号
5. outro 的 narration 可以适当改写为引导语
6. 原文中的【开头三秒爆款】【正文口播稿】等标记不要出现在 narration 中
7. **global_style 的颜色必须与 template 匹配**（深色模板用深色配色，浅色模板用浅色配色）

---

以下是原始文案：

【在此粘贴你的原始文案】
````

***

## 后续执行命令

获得 DeepSeek 输出的 JSON 后，保存为 `scripts/aiproject-football-001.json`，然后执行：

```bash
# 步骤1: 生成音效文件（首次运行或更新音效时执行）
/usr/local/bin/node node_modules/.bin/tsx scripts/generate-sfx.ts

# 步骤2: 校验脚本格式
/usr/local/bin/node node_modules/.bin/tsx scripts/validate.ts scripts/aiproject-football-001.json

# 步骤3: 渲染视频（自动 TTS + 视频渲染 + 音频合并 + 自动音效）
bash scripts/start-local.sh render scripts/aiproject-football-001.json
```

输出文件位于：`output/aiproject-football-001/aiproject-football-001.mp4`

### 完整工作流

```
原始文案 (.txt)
    │
    ▼
DeepSeek + 分镜提示词 → script.json
    │
    ├── 步骤1: 生成音效（首次）
    │   /usr/local/bin/node node_modules/.bin/tsx scripts/generate-sfx.ts
    │
    ├── 步骤2: 校验
    │   /usr/local/bin/node node_modules/.bin/tsx scripts/validate.ts scripts/xxx.json
    │
    ├── 步骤3: 渲染
    │   bash scripts/start-local.sh render scripts/xxx.json
    │   （自动执行: TTS合成 → 视频渲染 → 音效匹配 → 音频合并）
    │
    └── 输出: output/xxx/xxx.mp4
```
