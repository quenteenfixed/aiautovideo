// VideoComposition.tsx — 主视频合成组件
import React from 'react';
import { AbsoluteFill, Audio, Sequence, useVideoConfig, useCurrentFrame, interpolate } from 'remotion';
import { Scene } from './components/Scene';
import { AnimatedSubtitle } from './components/Subtitle';
import { AnimatedBackground } from './components/AnimatedBackground';
import { getTemplate } from './templates';
import type { ScriptData, TTSResult, SceneRuntime, WordBoundary } from './types/script';

export interface VideoCompositionProps {
  script: ScriptData | null;
  audioResults: Record<number, TTSResult>;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ script, audioResults }: VideoCompositionProps) => {
  const { fps } = useVideoConfig();

  if (!script) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }

  // 合并 script.global_style 与 template 配置（脚本颜色覆盖模板默认值）
  const baseTemplate = getTemplate(script.template);
  const bgColor = script.global_style?.bg_color || baseTemplate.bg_color;
  const isDarkBg = (() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255 < 0.5;
  })();
  const template = {
    ...baseTemplate,
    bg_color: bgColor,
    text_color: script.global_style?.text_color || baseTemplate.text_color,
    primary_color: script.global_style?.primary_color || baseTemplate.primary_color,
    accent_color: script.global_style?.accent_color || baseTemplate.accent_color,
    title_font: script.global_style?.font_family || baseTemplate.title_font,
    body_font: script.global_style?.font_family || baseTemplate.body_font,
    // 深色背景时适配卡片颜色（半透明让背景动画透出）
    card_bg: isDarkBg ? `${bgColor}cc` : baseTemplate.card_bg,
    card_border: isDarkBg ? `${script.global_style?.primary_color || baseTemplate.primary_color}44` : baseTemplate.card_border,
    shadow: isDarkBg ? '0 8px 32px rgba(0,0,0,0.4)' : baseTemplate.shadow,
  };

  // Build runtime scenes with audio data
  const scenes: SceneRuntime[] = script.scenes.map((scene) => {
    const audio = audioResults[scene.scene_id];
    return {
      ...scene,
      audio_file: audio?.audio_file,
      audio_duration: audio?.audio_duration,
      duration_in_frames: audio
        ? Math.ceil(audio.audio_duration * fps)
        : Math.ceil(scene.duration * fps),
      word_boundaries: audio?.word_boundaries || [],
    };
  });

  // Calculate scene offsets
  let cumulativeFrame = 0;
  const sceneOffsets: Record<number, number> = {};

  scenes.forEach((scene) => {
    sceneOffsets[scene.scene_id] = cumulativeFrame;
    cumulativeFrame += scene.duration_in_frames!;
  });

  // Outro
  const outroAudio = audioResults[9999];
  const outroDuration = outroAudio
    ? Math.ceil(outroAudio.audio_duration * fps)
    : Math.ceil(script.outro.duration * fps);
  const outroStartFrame = cumulativeFrame;

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color }}>
      {/* Render each scene with transitions via Sequence */}
      {scenes.map((scene, i) => {
        const startFrame = sceneOffsets[scene.scene_id];
        const duration = scene.duration_in_frames!;
        const audio = audioResults[scene.scene_id];
        const words = scene.word_boundaries || [];
        const isLast = i === scenes.length - 1;

        // Transition timing: ensure at least 1 frame to avoid interpolate [0,0] error
        const transitionDuration = isLast ? 0 : Math.max(1, Math.min(15, Math.floor(duration / 4)));

        return (
          <Sequence
            key={scene.scene_id}
            from={startFrame}
            durationInFrames={duration}
          >
            <SceneWithTransition
              scene={scene}
              template={template}
              fps={fps}
              frame={0}
              transitionIn={scene.transition_in}
              transitionOut={isLast ? 'none' : scene.transition_out}
              transitionDuration={transitionDuration}
            >
              {words.length > 0 && (
                <AnimatedSubtitle
                  words={words}
                  sceneStartFrame={startFrame}
                  style={script.subtitle_style}
                />
              )}
            </SceneWithTransition>
            {audio?.audio_file && <Audio src={audio.audio_file} />}
          </Sequence>
        );
      })}

      {/* Outro */}
      <Sequence from={outroStartFrame} durationInFrames={outroDuration}>
        <AbsoluteFill style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: template.bg_color,
        }}>
          <AnimatedBackground
            type="cosmic"
            bgColor={template.bg_color}
            accentColor={template.accent_color}
            primaryColor={template.primary_color}
            seed={9999}
          />
          <OutroCard
            text={script.outro.visual.text}
            animation={script.outro.visual.animation}
            template={template}
          />
        </AbsoluteFill>
        {script.outro.narration && outroAudio?.audio_file && (
          <Audio src={outroAudio.audio_file} />
        )}
        {outroAudio?.word_boundaries && outroAudio.word_boundaries.length > 0 && (
          <AnimatedSubtitle
            words={outroAudio.word_boundaries}
            sceneStartFrame={outroStartFrame}
            style={script.subtitle_style}
          />
        )}
      </Sequence>

      {/* Global BGM */}
      {script.bgm && script.bgm.file && (
        <Audio
          src={script.bgm.file}
          volume={script.bgm.volume}
        />
      )}
    </AbsoluteFill>
  );
};

// Scene with transition wrapper
const SceneWithTransition: React.FC<{
  scene: SceneRuntime;
  template: any;
  fps: number;
  frame: number;
  transitionIn: string;
  transitionOut: string;
  transitionDuration: number;
  children?: React.ReactNode;
}> = ({ scene, template, fps, transitionIn, transitionOut, transitionDuration, children }) => {
  const currentFrame = useCurrentFrame();
  const totalFrames = scene.duration_in_frames || fps * 5;

  // No transition if duration is 0
  const hasTransition = transitionDuration > 0;

  // Entrance transition (first N frames)
  let enterStyle: React.CSSProperties = { opacity: 1, transform: 'none' };
  if (hasTransition) {
    if (transitionIn === 'fade') {
      enterStyle.opacity = interpolate(currentFrame, [0, transitionDuration], [0, 1], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
    } else if (transitionIn === 'slide_left') {
      enterStyle = {
        opacity: interpolate(currentFrame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(currentFrame, [0, transitionDuration], [300, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      };
    } else if (transitionIn === 'slide_up') {
      enterStyle = {
        opacity: interpolate(currentFrame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateY(${interpolate(currentFrame, [0, transitionDuration], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      };
    } else if (transitionIn === 'zoom_in') {
      enterStyle = {
        opacity: interpolate(currentFrame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(currentFrame, [0, transitionDuration], [0.7, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      };
    } else if (transitionIn === 'zoom_out') {
      enterStyle = {
        opacity: interpolate(currentFrame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(currentFrame, [0, transitionDuration], [1.3, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      };
    }
  }

  // Exit transition (last N frames)
  const exitStart = totalFrames - transitionDuration;
  let exitStyle: React.CSSProperties = { opacity: 1, transform: 'none' };
  if (hasTransition && transitionOut !== 'none' && currentFrame > exitStart) {
    if (transitionOut === 'fade') {
      exitStyle.opacity = interpolate(currentFrame, [exitStart, totalFrames], [1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
    } else if (transitionOut === 'slide_left') {
      exitStyle = {
        opacity: interpolate(currentFrame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(currentFrame, [exitStart, totalFrames], [0, -300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      };
    } else if (transitionOut === 'slide_right') {
      exitStyle = {
        opacity: interpolate(currentFrame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `translateX(${interpolate(currentFrame, [exitStart, totalFrames], [0, 300], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)`,
      };
    } else if (transitionOut === 'zoom_out') {
      exitStyle = {
        opacity: interpolate(currentFrame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: `scale(${interpolate(currentFrame, [exitStart, totalFrames], [1, 1.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
      };
    }
  }

  return (
    <AbsoluteFill style={{
      ...enterStyle,
      ...(currentFrame > exitStart ? exitStyle : {}),
      backgroundColor: template.bg_color,
    }}>
      <Scene scene={scene} template={template} fps={fps} />
      {children}
    </AbsoluteFill>
  );
};

// Outro card with animation
const OutroCard: React.FC<{
  text: string;
  animation: string;
  template: any;
}> = ({ text, animation, template }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateY = 0;

  const animDuration = Math.min(30, fps);

  if (animation === 'fade_in_zoom') {
    opacity = interpolate(frame, [0, animDuration], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    scale = interpolate(frame, [0, animDuration], [0.8, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
  } else if (animation === 'slide_up') {
    opacity = interpolate(frame, [0, 10], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    translateY = interpolate(frame, [0, animDuration], [50, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
  } else {
    opacity = interpolate(frame, [0, 15], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
  }

  return (
    <div style={{
      opacity,
      transform: `scale(${scale}) translateY(${translateY}px)`,
      padding: '0 100px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 2,
    }}>
      <div style={{
        color: template.accent_color,
        fontSize: 38,
        fontWeight: 600,
        fontFamily: template.body_font,
        marginBottom: 28,
      }}>
        下一个问题
      </div>
      <h1 style={{
        color: template.primary_color,
        fontSize: 68,
        fontWeight: 800,
        fontFamily: template.title_font,
        lineHeight: 1.4,
        margin: 0,
        textShadow: template.shadow !== 'none' ? template.shadow : 'none',
      }}>
        {text}
      </h1>
      <div style={{
        width: 100,
        height: 5,
        backgroundColor: template.accent_color,
        borderRadius: 3,
        margin: '36px auto 0',
        opacity,
      }} />
    </div>
  );
};
