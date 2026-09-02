// MixedScene.tsx — 混合场景（支持复杂布局 + 动画背景）
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { EChartComponent } from '../EChartComponent';
import { AnimatedBackground, pickBgType } from '../AnimatedBackground';
import { kenBurns } from '../../utils/animations';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface MixedSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const MixedScene: React.FC<MixedSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalFrames = scene.duration_in_frames || fps * 5;
  const exitStart = totalFrames - 10;
  const exitOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const elements: any[] = visual.elements || [];
  const bgType = pickBgType('mixed', scene.scene_id || 0);

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color, opacity: opacity * exitOpacity, overflow: 'hidden' }}>
      {/* 动画背景 */}
      <AnimatedBackground type={bgType} bgColor={template.bg_color} accentColor={template.accent_color} primaryColor={template.primary_color} seed={scene.scene_id || 1} />

      {/* Render each element */}
      {elements.map((el, i) => {
        const layout = el.layout || { x: 0, y: 0, width: 100, height: 100 };
        const elementDelay = i * 5;
        const elScale = spring({ frame: frame - elementDelay, fps, config: { damping: 14, stiffness: 120, mass: 0.8 }, from: 0.7, to: 1 });
        const elOpacity = interpolate(frame - elementDelay, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        const containerStyle: React.CSSProperties = {
          position: 'absolute', left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.width}%`, height: `${layout.height}%`,
          opacity: elOpacity, transform: `scale(${elScale})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: template.corner_radius,
        };

        if (el.type === 'text') {
          return (
            <div key={i} style={{ ...containerStyle, padding: 20, backgroundColor: el.data.bg_color || 'transparent' }}>
              <span style={{ color: el.data.color || template.text_color, fontSize: (el.data.font_size || 32) + 8, fontWeight: el.data.font_weight || 600, fontFamily: el.data.font_family || template.body_font, textAlign: el.data.text_align || 'center', textShadow: el.data.shadow ? '2px 2px 4px rgba(0,0,0,0.6)' : 'none', lineHeight: 1.5 }}>
                {el.data.text}
              </span>
            </div>
          );
        }
        if (el.type === 'chart') {
          return (
            <div key={i} style={{ ...containerStyle, backgroundColor: template.card_bg, padding: 16, boxShadow: template.shadow !== 'none' ? template.shadow : 'none', border: `1px solid ${template.card_border}` }}>
              <EChartComponent chartType={el.data.chart_type || 'bar'} data={el.data} template={template} width={Math.floor((1080 * layout.width / 100) - 32)} height={Math.floor((1920 * layout.height / 100) - 32)} />
            </div>
          );
        }
        if (el.type === 'image') {
          const hasSrc = el.data.src && (el.data.src.startsWith('http') || el.data.src.startsWith('/') || el.data.src.startsWith('./'));
          return (
            <div key={i} style={containerStyle}>
              {hasSrc ? <img src={el.data.src} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: template.corner_radius }} /> : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${template.primary_color}33, ${template.accent_color}33)`, borderRadius: template.corner_radius }} />}
            </div>
          );
        }
        if (el.type === 'animation') {
          return (
            <div key={i} style={containerStyle}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: template.accent_color, opacity: 0.7, transform: `scale(${1 + Math.sin(frame / 10) * 0.2})` }} />
            </div>
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
