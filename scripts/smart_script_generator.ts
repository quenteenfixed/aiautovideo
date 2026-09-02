// smart_script_generator.ts — 智能分镜生成器
// 增强版：识别文案结构、提取关键数据、自动匹配视觉类型
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScriptData, TemplateType, Scene, TransitionType, OverlayComponent } from '../src/types/script';

const TEMPLATES: TemplateType[] = [
  'data_visual_style',
  'illustration_style',
  'cinematic_style',
  'minimal_style',
  'infographic_style',
];

interface SmartOptions {
  textFile: string;
  template?: TemplateType;
  outputPath?: string;
  allTemplates?: boolean;
  outputDir?: string;
}

// 中文语速：约 4-5 字/秒（科普类偏快，考虑停顿）
const CHARS_PER_SEC = 4.5;

export async function smartGenerate(options: SmartOptions): Promise<void> {
  const text = await fs.readFile(options.textFile, 'utf-8');

  // 解析文案结构
  const parsed = parseScript(text);

  const template = options.template || 'data_visual_style';

  if (options.allTemplates) {
    const outputDir = options.outputDir || 'output/generated';
    await fs.mkdir(outputDir, { recursive: true });
    for (let i = 0; i < TEMPLATES.length; i++) {
      const t = TEMPLATES[i];
      const outputPath = path.join(outputDir, `script_${parsed.videoId}_${i + 1}_${t}.json`);
      const script = buildScript(parsed, t);
      await fs.writeFile(outputPath, JSON.stringify(script, null, 2));
      console.log(`  [${i + 1}/${TEMPLATES.length}] ${t} → ${outputPath}`);
    }
    console.log(`\n生成 ${TEMPLATES.length} 个模板版本 → ${outputDir}`);
  } else {
    const outputPath = options.outputPath || `scripts/${parsed.videoId}.json`;
    const script = buildScript(parsed, template);
    await fs.writeFile(outputPath, JSON.stringify(script, null, 2));
    console.log(`分镜生成: ${outputPath}`);
    console.log(`  标题: ${script.title}`);
    console.log(`  场景: ${script.scenes.length}`);
    console.log(`  模板: ${template}`);
    console.log(`  预计时长: ${parsed.totalDuration.toFixed(0)}s`);
  }
}

interface ParsedScript {
  title: string;
  videoId: string;
  sections: ParsedSection[];
  outroText: string;
  outroCTA: string;
  totalDuration: number;
}

interface ParsedSection {
  narration: string;
  title: string;
  subtitle?: string;
  duration: number;
  visualType: 'text_card' | 'chart' | 'animation' | 'image';
  chartData?: { title: string; labels: string[]; values: number[]; y_axis_label: string };
  components: OverlayComponent[];
}

function parseScript(text: string): ParsedScript {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 提取标题（第一行，去掉 "第X篇：" 前缀）
  let title = lines[0] || '未命名视频';
  title = title.replace(/^第\d+篇[：:]\s*/, '').replace(/^#+\s*/, '').trim();

  const videoId = `auto_${Date.now().toString(36)}`;

  // 识别区块标记
  const sections: ParsedSection[] = [];
  let outroText = '';
  let outroCTA = '关注我，了解更多科普知识';

  // 按段落分割，同时识别区块标记
  // 规则：每行是一个独立段落（以句号/问号/感叹号结尾）
  const paragraphs: { text: string; marker?: string }[] = [];
  let currentPara = '';
  let currentMarker: string | undefined;

  for (const line of lines.slice(1)) {
    // 检测区块标记 【...】
    const markerMatch = line.match(/^【(.+)】$/);
    if (markerMatch) {
      if (currentPara.trim()) {
        paragraphs.push({ text: currentPara.trim(), marker: currentMarker });
        currentPara = '';
      }
      currentMarker = markerMatch[1];
      continue;
    }

    // 检测结尾引导（最后一段通常有问题引导）
    if (line.includes('那么问题来了') || line.includes('那么下一个问题')) {
      if (currentPara.trim()) {
        paragraphs.push({ text: currentPara.trim(), marker: currentMarker });
        currentPara = '';
      }
      outroText = line;
      currentMarker = 'outro';
      continue;
    }

    // 如果当前行为空，跳过
    if (!line.trim()) continue;

    // 如果当前已有段落且新行以句号结尾，说明是完整段落
    if (currentPara.trim() && /[。！？.!?]$/.test(currentPara.trim())) {
      // 保存当前段落，开始新段落
      paragraphs.push({ text: currentPara.trim(), marker: currentMarker });
      currentPara = line;
    } else {
      // 追加到当前段落
      currentPara += (currentPara ? '\n' : '') + line;
    }
  }
  if (currentPara.trim()) {
    if (currentMarker === 'outro' || paragraphs.find(p => p.marker === 'outro')) {
      if (!outroText) outroText = currentPara.trim();
      else paragraphs.push({ text: currentPara.trim(), marker: currentMarker });
    } else {
      paragraphs.push({ text: currentPara.trim(), marker: currentMarker });
    }
  }

  // 处理每个段落
  let totalDuration = 0;

  paragraphs.forEach((para, i) => {
    const isHook = para.marker === '开头三秒爆款' || (i === 0 && !para.marker);
    const isConclusion = i === paragraphs.length - 1;

    // 提取场景标题
    const sceneTitle = extractTitle(para.text, isHook);

    // 判断视觉类型
    const visualType = detectVisualType(para.text, isHook, isConclusion);

    // 提取图表数据
    const chartData = visualType === 'chart' ? extractChartData(para.text, sceneTitle) : undefined;

    // 提取标注组件
    const components = extractComponents(para.text);

    // 计算时长
    const duration = Math.max(5, Math.ceil(para.text.length / CHARS_PER_SEC) + 2);
    totalDuration += duration;

    sections.push({
      narration: para.text,
      title: sceneTitle,
      subtitle: isHook ? extractSubtitle(para.text) : undefined,
      duration,
      visualType,
      chartData,
      components,
    });
  });

  // 如果没有显式的 outro 文案，使用最后一段作为 outro
  if (!outroText && sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    outroText = lastSection.narration;
    outroCTA = lastSection.title;
    sections.pop();
  }

  totalDuration += 8; // outro duration

  return { title, videoId, sections, outroText, outroCTA, totalDuration };
}

function extractTitle(text: string, isHook: boolean): string {
  // 尝试从文本中提取一个简洁的标题
  // 1. 如果文本包含问号，取问号前的部分
  const questionMatch = text.match(/([^。！？?？]{5,20})[?？]/);
  if (questionMatch) {
    return questionMatch[1].trim().substring(0, 15);
  }

  // 2. 取第一个句号前的部分
  const firstSentence = text.split(/[。！？.!?]/)[0];
  if (firstSentence.length <= 20) {
    return firstSentence;
  }

  // 3. 取前15个字
  return text.substring(0, 15) + '...';
}

function extractSubtitle(text: string): string {
  // 从钩子段落中提取副标题
  const keywords = text.match(/['"](.+?)['"]/);
  if (keywords) return keywords[1];

  // 提取关键概念词
  const conceptMatch = text.match(/[：:](.+)$/m);
  if (conceptMatch) return conceptMatch[1].trim().substring(0, 30);

  return '';
}

function detectVisualType(
  text: string,
  isHook: boolean,
  isConclusion: boolean
): 'text_card' | 'chart' | 'animation' | 'image' {
  if (isHook || isConclusion) return 'text_card';

  // 图表：包含百分比、数据对比、准确率等
  if (/\d+[%％]|\d+\.\d+%|准确率|命中率|概率|vs|对比|比较/.test(text)) {
    return 'chart';
  }

  // 动画：包含实验、过程、机制描述
  if (/实验|过程|机制|原理|演示|模拟|动态|变化|演进/.test(text)) {
    return 'animation';
  }

  // 图片：包含场景描述
  if (/场景|画面|背景|环境|地方|城市|国家/.test(text)) {
    return 'image';
  }

  return 'text_card';
}

function extractChartData(text: string, title: string): {
  title: string; labels: string[]; values: number[]; y_axis_label: string;
} {
  // 提取所有百分比数字
  const percentages = text.match(/(\d+\.?\d*)\s*[%％]/g);
  // 提取所有普通数字
  const numbers = text.match(/(?<![\d.])\d+\.?\d*(?![\d%％])/g);

  // 提取标签词（率、度、比、分结尾的词）
  const labels = text.match(/[\u4e00-\u9fa5]{2,6}(?:率|度|比|分|数|量|期|段)/g) || [];

  let values: number[] = [];
  let yLabel = '占比 (%)';

  if (percentages && percentages.length >= 2) {
    values = percentages.map(p => parseFloat(p));
    yLabel = '百分比 (%)';
  } else if (numbers && numbers.length >= 2) {
    values = numbers.map(Number).filter(n => n > 0 && n < 10000).slice(0, 6);
    yLabel = '数值';
  }

  // 如果没有足够的数字，生成默认值
  if (values.length < 2) {
    values = [30, 60, 45, 80];
    labels.length = 0;
  }

  // 确保标签数量匹配
  const finalLabels = labels.length >= values.length
    ? labels.slice(0, values.length)
    : values.map((_, i) => `数据${i + 1}`);

  return {
    title,
    labels: finalLabels,
    values: values.slice(0, 6),
    y_axis_label: yLabel,
  };
}

function extractComponents(text: string): OverlayComponent[] {
  const components: OverlayComponent[] = [];

  // 提取关键数据标注（如 "65.7%命中率"）
  const keyDataMatch = text.match(/(\d+\.?\d*\s*[%％]\s*(?:命中率|准确率|概率|占比))/);
  if (keyDataMatch) {
    components.push({
      type: 'badge',
      text: keyDataMatch[1],
      position: 'top_center',
      color: '#F5A623',
    });
  }

  // 提取对比标注（如 "设计 vs 决定"）
  const vsMatch = text.match(/([\u4e00-\u9fa5]{2,6})\s*(?:vs|VS|versus|对比|相比于?)\s*([\u4e00-\u9fa5]{2,6})/);
  if (vsMatch) {
    components.push({
      type: 'label',
      text: `${vsMatch[1]} vs ${vsMatch[2]}`,
      position: 'top_center',
      color: '#4A90D9',
    });
  }

  return components;
}

function buildScript(parsed: ParsedScript, template: TemplateType): ScriptData {
  const scenes: Scene[] = parsed.sections.map((section, i) => {
    const isLast = i === parsed.sections.length - 1;
    const transitionIn: TransitionType = i === 0 ? 'fade' : 'slide_left';
    const transitionOut: TransitionType = isLast ? 'fade' : 'slide_left';

    let visual: any;

    if (section.visualType === 'chart' && section.chartData) {
      visual = {
        type: 'chart',
        chart_type: 'bar',
        data: section.chartData,
        animation: 'fade_in',
        components: section.components.length > 0 ? section.components : undefined,
      } as any;
    } else if (section.visualType === 'animation') {
      visual = {
        type: 'animation',
        animation_source: 'default',
        overlay_components: section.components.length > 0 ? section.components : undefined,
      } as any;
    } else if (section.visualType === 'image') {
      visual = {
        type: 'image',
        image_source: '',
        effect: 'ken_burns',
        overlay_components: section.components.length > 0 ? section.components : undefined,
      } as any;
    } else {
      visual = {
        type: 'text_card',
        title: section.title,
        subtitle: section.subtitle,
        animation: i === 0 ? 'fade_in_zoom' : 'slide_up',
        components: section.components.length > 0 ? section.components : undefined,
      } as any;
    }

    return {
      scene_id: i + 1,
      narration: section.narration,
      duration: section.duration,
      visual,
      transition_in: transitionIn,
      transition_out: transitionOut,
    };
  });

  return {
    video_id: parsed.videoId,
    title: parsed.title,
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    template,
    global_style: {
      font_family: 'Noto Sans SC, sans-serif',
      primary_color: '#4A90D9',
      accent_color: '#F5A623',
      bg_color: '#0F1923',
      text_color: '#E0E7FF',
    },
    voice: {
      provider: 'edge-tts',
      voice_name: 'zh-CN-YunxiNeural',
      rate: '+10%',
      pitch: '+0Hz',
      volume: '+0%',
    },
    subtitle_style: {
      font_size: 42,
      font_family: 'Noto Sans SC, sans-serif',
      color: '#FFFFFF',
      highlight_color: '#F5A623',
      stroke_color: '#000000',
      stroke_width: 3,
      animation: 'bounce',
      position: 'bottom',
      offset_y: 180,
      max_width: 900,
    },
    scenes,
    outro: {
      duration: 8,
      narration: parsed.outroText,
      visual: {
        type: 'cta_card',
        text: parsed.outroCTA,
        animation: 'fade_in_zoom',
      },
      transition_in: 'fade',
    },
  };
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('AI Auto Video - 智能分镜生成器');
    console.log('');
    console.log('用法:');
    console.log('  tsx scripts/smart_script_generator.ts <text_file> [--template <name>] [--output <path>]');
    console.log('  tsx scripts/smart_script_generator.ts --all-templates <text_file> [--output-dir <dir>]');
    console.log('');
    console.log('模板:');
    TEMPLATES.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));
    console.log('');
    console.log('示例:');
    console.log('  tsx scripts/smart_script_generator.ts football002.txt --output scripts/football_006.json');
    console.log('  tsx scripts/smart_script_generator.ts --all-templates football002.txt');
    process.exit(0);
  }

  const textFile = args.find(a => !a.startsWith('--'));
  const templateFlag = args.indexOf('--template');
  const outputFlag = args.indexOf('--output');
  const allFlag = args.includes('--all-templates');
  const outputDirFlag = args.indexOf('--output-dir');

  if (!textFile) {
    console.error('错误: 请提供文本文件路径');
    process.exit(1);
  }

  smartGenerate({
    textFile,
    template: templateFlag >= 0 ? args[templateFlag + 1] as TemplateType : 'data_visual_style',
    outputPath: outputFlag >= 0 ? args[outputFlag + 1] : undefined,
    allTemplates: allFlag,
    outputDir: outputDirFlag >= 0 ? args[outputDirFlag + 1] : undefined,
  }).catch(err => {
    console.error('错误:', err);
    process.exit(1);
  });
}
