// CtaCardScene.tsx — CTA 引导卡片场景
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { AnimatedBackground } from '../AnimatedBackground';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface CtaCardSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const CtaCardScene: React.FC<CtaCardSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateY = 0;
  const animDuration = Math.min(30, fps);

  switch (visual.animation) {
    case 'fade_in_zoom':
      opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      scale = interpolate(frame, [0, animDuration], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
      break;
    case 'slide_up':
      opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      translateY = interpolate(frame, [0, animDuration], [50, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
      break;
    case 'bounce_in':
      scale = spring({ frame, fps, config: { damping: 12, stiffness: 200, mass: 0.8 } });
      opacity = interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      break;
    default:
      opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }

  const totalFrames = scene.duration_in_frames || fps * 5;
  const exitStart = totalFrames - 10;
  if (frame > exitStart) {
    opacity = interpolate(frame, [exitStart, totalFrames], [opacity, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color }}>
      {/* 宇宙动画背景 */}
      <AnimatedBackground
        type="cosmic"
        bgColor={template.bg_color}
        accentColor={template.accent_color}
        primaryColor={template.primary_color}
        seed={scene.scene_id || 999}
      />

      {/* 内容可读性渐变遮罩 */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, ${template.bg_color}aa 0%, ${template.bg_color}66 40%, transparent 70%)`,
      }} />

      {/* CTA 内容 */}
      <AbsoluteFill style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity, transform: `scale(${scale}) translateY(${translateY}px)`,
      }}>
        <div style={{ position: 'relative', zIndex: 2, padding: '0 100px', textAlign: 'center', maxWidth: '92%' }}>
          {/* 引导标签（放大） */}
          <div style={{
            color: template.accent_color, fontSize: 38, fontWeight: 600,
            fontFamily: template.body_font, marginBottom: 28, opacity: 0.9,
          }}>
            {visual.components?.[0]?.text || '下期预告'}
          </div>

          {/* 主 CTA 文字（放大） */}
          <h1 style={{
            color: template.primary_color, fontSize: 68, fontWeight: 800,
            fontFamily: template.title_font, lineHeight: 1.4, margin: 0,
            textShadow: template.shadow !== 'none' ? template.shadow : 'none',
          }}>
            {visual.text}
          </h1>

          {/* 装饰线 */}
          <div style={{
            width: 100, height: 5, backgroundColor: template.accent_color,
            borderRadius: 3, margin: '36px auto 0', opacity,
          }} />
        </div>

        {/* 额外标注组件（位置往中间靠） */}
        {(visual.components || []).slice(visual.components?.[0] ? 1 : 0).map((comp: any, i: number) => {
          const positionMap: Record<string, any> = {
            top_center: { top: 130, left: 0, right: 0, textAlign: 'center' },
            top_left: { top: 130, left: 100 },
            top_right: { top: 130, right: 100 },
            bottom_center: { bottom: 280, left: 0, right: 0, textAlign: 'center' },
            center: { top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)' },
          };
          const pos = positionMap[comp.position] || positionMap.top_center;
          const color = comp.color || template.accent_color;

          if (comp.type === 'badge') {
            return (
              <div key={i} style={{
                position: 'absolute', ...pos, display: 'inline-block',
                padding: '6px 20px', borderRadius: 12, backgroundColor: color, color: '#fff',
                fontSize: 30, fontWeight: 600, fontFamily: template.body_font, zIndex: 3, width: 'fit-content',
                margin: comp.position?.includes('center') ? '0 auto' : undefined,
              }}>
                {comp.text}
              </div>
            );
          }
          return (
            <div key={i} style={{
              position: 'absolute', ...pos, color,
              fontSize: 32, fontWeight: 600, fontFamily: template.body_font, zIndex: 3,
            }}>
              {comp.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
