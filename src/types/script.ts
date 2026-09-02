// script.ts — script.json 完整 TypeScript 类型定义

export type TransitionType =
  | 'fade'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'zoom_in'
  | 'zoom_out'
  | 'wipe'
  | 'bounce'
  | 'none';

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'scatter'
  | 'radar'
  | 'spectrum'
  | 'custom';

export type TemplateType =
  | 'data_visual_style'
  | 'illustration_style'
  | 'cinematic_style'
  | 'minimal_style'
  | 'infographic_style';

export type SubtitleAnimation = 'bounce' | 'slide' | 'fade' | 'pop';

export interface OverlayComponent {
  type: 'label' | 'arrow' | 'highlight' | 'badge';
  text?: string;
  position: string;
  color?: string;
  from?: string;
  to?: string;
}

export interface MixedElement {
  type: 'text' | 'chart' | 'image' | 'animation';
  data: Record<string, any>;
  layout: { x: number; y: number; width: number; height: number };
}

type SceneVisual =
  | {
      type: 'text_card';
      title: string;
      subtitle?: string;
      bg_image?: string;
      animation: string;
      components?: OverlayComponent[];
    }
  | {
      type: 'chart';
      chart_type: ChartType;
      data: Record<string, any>;
      animation: string;
      components?: OverlayComponent[];
    }
  | {
      type: 'animation';
      animation_source: string;
      overlay_components?: OverlayComponent[];
    }
  | {
      type: 'image';
      image_source: string;
      effect: 'ken_burns' | 'parallax' | 'static';
      overlay_components?: OverlayComponent[];
    }
  | {
      type: 'mixed';
      elements: MixedElement[];
    }
  | {
      type: 'cta_card';
      text: string;
      animation: string;
      components?: OverlayComponent[];
    };

export interface Scene {
  scene_id: number;
  narration: string;
  duration: number;
  visual: SceneVisual;
  transition_in: TransitionType;
  transition_out: TransitionType;
}

export interface Outro {
  duration: number;
  narration: string;
  visual: {
    type: 'cta_card';
    text: string;
    animation: string;
  };
  transition_in: TransitionType;
}

export interface VoiceConfig {
  provider: 'edge-tts' | 'cosyvoice';
  voice_name: string;
  rate: string;
  pitch: string;
  volume: string;
}

export interface SubtitleStyle {
  font_size: number;
  font_family: string;
  color: string;
  highlight_color: string;
  stroke_color: string;
  stroke_width: number;
  animation: SubtitleAnimation;
  position: 'bottom' | 'center' | 'top';
  offset_y: number;
  max_width: number;
}

export interface GlobalStyle {
  font_family: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  text_color: string;
}

export interface BgmConfig {
  file: string;
  volume: number;
  fade_in: number;
  fade_out: number;
}

export interface ScriptData {
  video_id: string;
  title: string;
  resolution: { width: number; height: number };
  fps: number;
  template: TemplateType;
  global_style: GlobalStyle;
  voice: VoiceConfig;
  bgm?: BgmConfig;
  subtitle_style: SubtitleStyle;
  scenes: Scene[];
  outro: Outro;
}

// 运行时扩展字段（TTS 模块自动填充）
export interface WordBoundary {
  text: string;
  offset_ms: number;
  duration_ms: number;
}

export interface SceneRuntime extends Scene {
  audio_file?: string;
  audio_duration?: number;
  duration_in_frames?: number;
  word_boundaries?: WordBoundary[];
}

export interface ScriptRuntime extends ScriptData {
  scenes: SceneRuntime[];
}

export interface TTSResult {
  audio_file: string;
  audio_duration: number;
  word_boundaries: WordBoundary[];
}

export interface TemplateConfig {
  name: string;
  bg_color: string;
  text_color: string;
  primary_color: string;
  accent_color: string;
  chart_colors: string[];
  card_bg: string;
  card_border: string;
  title_font: string;
  body_font: string;
  bg_pattern?: string;
  corner_radius: number;
  shadow: string;
}
