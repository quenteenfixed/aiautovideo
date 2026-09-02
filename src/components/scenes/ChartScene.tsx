// ChartScene.tsx — 图表场景（集成 ECharts + 动画背景）
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { EChartComponent } from '../EChartComponent';
import { AnimatedBackground, pickBgType } from '../AnimatedBackground';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface ChartSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const ChartScene: React.FC<ChartSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animDuration = Math.min(20, fps * 0.6);
  const opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 1 }, from: 0.8, to: 1 });

  const totalFrames = scene.duration_in_frames || fps * 5;
  const exitStart = totalFrames - 10;
  const exitOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color }}>
      {/* 动画背景 */}
      <AnimatedBackground
        type="grid_pulse"
        bgColor={template.bg_color}
        accentColor={template.accent_color}
        primaryColor={template.primary_color}
        seed={scene.scene_id || 1}
      />

      {/* 内容可读性渐变遮罩 */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, ${template.bg_color}aa 0%, ${template.bg_color}66 40%, transparent 70%)`,
      }} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: opacity * exitOpacity,
      }}>
        {/* 图表容器 */}
        <div style={{
          position: 'relative', zIndex: 2, transform: `scale(${scale})`,
          backgroundColor: template.card_bg, borderRadius: template.corner_radius,
          padding: 35, boxShadow: template.shadow !== 'none' ? template.shadow : 'none',
          border: `1px solid ${template.card_border}`,
        }}>
          <EChartComponent chartType={visual.chart_type} data={visual.data} template={template} width={820} height={520} />
        </div>

        {/* 标注组件（位置往中间靠 + 字号增大） */}
        {visual.components?.map((comp: any, i: number) => {
          const posStyle: React.CSSProperties = {};
          if (comp.position?.includes('bottom')) {
            posStyle.position = 'absolute'; posStyle.bottom = 280; posStyle.left = 0; posStyle.right = 0; posStyle.textAlign = 'center';
          }
          if (comp.position?.includes('top')) {
            posStyle.position = 'absolute'; posStyle.top = 130; posStyle.left = 0; posStyle.right = 0; posStyle.textAlign = 'center';
          }
          if (comp.position === 'center') {
            posStyle.position = 'absolute'; posStyle.top = '50%'; posStyle.left = 0; posStyle.right = 0; posStyle.textAlign = 'center'; posStyle.transform = 'translateY(-50%)';
          }

          if (comp.type === 'badge') {
            return (
              <div key={`comp-${i}`} style={{
                ...posStyle, display: 'inline-block', margin: '0 auto',
                padding: '8px 24px', borderRadius: 16, backgroundColor: comp.color || template.accent_color,
                color: '#fff', fontSize: 30, fontWeight: 700, fontFamily: template.body_font, zIndex: 3, width: 'fit-content',
              }}>
                {comp.text}
              </div>
            );
          }
          return (
            <div key={`comp-${i}`} style={{
              ...posStyle, color: comp.color || template.accent_color,
              fontSize: 36, fontWeight: 600, fontFamily: template.body_font, zIndex: 3,
            }}>
              {comp.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
