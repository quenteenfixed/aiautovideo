// template_generator.ts — Script.json 模板生成器
// 根据文案内容自动生成 script.json，支持5种视觉模板切换
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScriptData, TemplateType } from '../src/types/script';

const TEMPLATES: TemplateType[] = [
  'data_visual_style',
  'illustration_style',
  'cinematic_style',
  'minimal_style',
  'infographic_style',
];

interface GeneratorOptions {
  title: string;
  narrationText: string;
  template?: TemplateType;
  outputPath?: string;
}

export async function generateScript(options: GeneratorOptions): Promise<ScriptData> {
  const {
    title,
    narrationText,
    template = 'data_visual_style',
    outputPath,
  } = options;

  // Split narration into scenes by paragraphs or sentences
  const paragraphs = narrationText
    .split(/\n\n+|\r\n\r\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const scenes = paragraphs.map((text, i) => {
    const isHook = i === 0;
    const isConclusion = i === paragraphs.length - 1;

    // Determine visual type based on content
    let visualType: 'text_card' | 'chart' | 'animation' | 'image' | 'mixed' = 'text_card';

    // If text contains numbers/percentages, use chart
    if (/\d+%|\d+%\b|\d+\s*(亿|万|千|百)|准确率|命中率|概率/.test(text)) {
      visualType = 'chart';
    }
    // If text describes a process or experiment, use animation
    if (/实验|过程|机制|原理|演示|模拟/.test(text)) {
      visualType = 'animation';
    }
    // Conclusion scene
    if (isConclusion) {
      visualType = 'text_card';
    }

    // Estimate duration (about 5 characters per second for Chinese)
    const estimatedDuration = Math.max(5, Math.ceil(text.length / 5));

    return {
      scene_id: i + 1,
      narration: text,
      duration: estimatedDuration,
      visual: buildVisualForType(visualType, text, i),
      transition_in: i === 0 ? 'fade' : 'slide_left',
      transition_out: i === paragraphs.length - 1 ? 'fade' : 'slide_left',
    };
  });

  const script: ScriptData = {
    video_id: `generated_${Date.now()}`,
    title,
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
    scenes: scenes as any,
    outro: {
      duration: 8,
      narration: '',
      visual: {
        type: 'cta_card',
        text: '关注我，了解更多科普知识',
        animation: 'fade_in_zoom',
      },
      transition_in: 'fade',
    },
  };

  if (outputPath) {
    await fs.writeFile(outputPath, JSON.stringify(script, null, 2));
    console.log(`Script generated: ${outputPath}`);
    console.log(`  Title: ${title}`);
    console.log(`  Scenes: ${scenes.length}`);
    console.log(`  Template: ${template}`);
  }

  return script;
}

function buildVisualForType(type: string, text: string, index: number) {
  // Extract a title from the text (first sentence or first 15 chars)
  const firstSentence = text.split(/[。！？.!?]/)[0];
  const title = firstSentence.length > 20 ? firstSentence.substring(0, 20) + '...' : firstSentence;

  switch (type) {
    case 'text_card':
      return {
        type: 'text_card',
        title,
        animation: index === 0 ? 'fade_in_zoom' : 'slide_up',
      };

    case 'chart':
      // Extract numbers from text for chart data
      const numbers = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
      const labels = (text.match(/[\u4e00-\u9fa5]{2,4}(?:率|度|比|分)/g) || ['数据A', '数据B', '数据C']);
      return {
        type: 'chart',
        chart_type: 'bar',
        data: {
          title,
          labels: labels.slice(0, 5),
          values: numbers.slice(0, 5).length > 0 ? numbers.slice(0, 5) : [30, 60, 45, 80],
        },
        animation: 'fade_in',
      };

    case 'animation':
      return {
        type: 'animation',
        animation_source: 'default',
        overlay_components: [
          {
            type: 'label',
            text: title,
            position: 'bottom_center',
          },
        ],
      };

    case 'image':
      return {
        type: 'image',
        image_source: '',
        effect: 'ken_burns',
        overlay_components: [
          {
            type: 'label',
            text: title,
            position: 'bottom_center',
          },
        ],
      };

    default:
      return {
        type: 'text_card',
        title,
        animation: 'fade_in',
      };
  }
}

// Template rotation: cycle through all 5 templates
export async function generateWithAllTemplates(
  title: string,
  narrationText: string,
  outputDir: string
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  for (let i = 0; i < TEMPLATES.length; i++) {
    const template = TEMPLATES[i];
    const outputPath = path.join(outputDir, `script_template_${i + 1}_${template}.json`);
    await generateScript({ title, narrationText, template, outputPath });
  }

  console.log(`\nGenerated ${TEMPLATES.length} scripts with different templates:`);
  TEMPLATES.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t}`);
  });
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('AI Auto Video - Script Template Generator');
    console.log('');
    console.log('Usage:');
    console.log('  tsx scripts/template_generator.ts <text_file> [--template <name>] [--output <path>]');
    console.log('  tsx scripts/template_generator.ts --all-templates <text_file> [--output-dir <dir>]');
    console.log('');
    console.log('Templates:');
    TEMPLATES.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));
    process.exit(0);
  }

  const textFile = args.find(a => !a.startsWith('--'));
  const templateFlag = args.indexOf('--template');
  const outputFlag = args.indexOf('--output');
  const allFlag = args.includes('--all-templates');
  const outputDirFlag = args.indexOf('--output-dir');

  if (!textFile) {
    console.error('Please provide a text file path');
    process.exit(1);
  }

  (async () => {
    const text = await fs.readFile(textFile, 'utf-8');
    const title = text.split('\n')[0].replace(/^#+\s*/, '').trim();

    if (allFlag) {
      const outputDir = outputDirFlag >= 0 ? args[outputDirFlag + 1] : 'output/generated';
      await generateWithAllTemplates(title, text, outputDir);
    } else {
      const template = templateFlag >= 0 ? args[templateFlag + 1] as TemplateType : 'data_visual_style';
      const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : 'output/generated_script.json';
      await generateScript({ title, narrationText: text, template, outputPath });
    }
  })().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
