// TextCardScene.tsx — 标题卡片场景
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import { AnimatedBackground, pickBgType } from '../AnimatedBackground';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface TextCardSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const TextCardScene: React.FC<TextCardSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateY = 0;

  const animDuration = Math.min(20, fps * 0.6);

  switch (visual.animation) {
    case 'fade_in':
      opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      break;
    case 'fade_in_zoom':
      opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      scale = interpolate(frame, [0, animDuration], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
      break;
    case 'slide_up':
      opacity = interpolate(frame, [0, animDuration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      translateY = interpolate(frame, [0, animDuration], [60, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
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

  const hasBgImage = visual.bg_image && visual.bg_image.startsWith('http');
  const bgType = pickBgType('text_card', scene.scene_id || 0);

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color }}>
      {/* 动画背景 */}
      <AnimatedBackground
        type={bgType}
        bgColor={template.bg_color}
        accentColor={template.accent_color}
        primaryColor={template.primary_color}
        seed={scene.scene_id || 1}
      />

      {/* 背景图片（可选） */}
      {hasBgImage && (
        <AbsoluteFill>
          <img src={visual.bg_image} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
          <AbsoluteFill style={{ background: `linear-gradient(to bottom, ${template.bg_color}cc, ${template.bg_color}99, ${template.bg_color}cc)` }} />
        </AbsoluteFill>
      )}

      {/* 内容可读性渐变遮罩（中心稍暗，边缘透明，让背景动画可见） */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, ${template.bg_color}aa 0%, ${template.bg_color}66 40%, transparent 70%)`,
      }} />

      {/* 主内容 */}
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity, transform: `scale(${scale}) translateY(${translateY}px)`,
      }}>
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 100px', maxWidth: '92%' }}>
          {/* 场景编号 */}
          {scene.scene_id > 0 && scene.scene_id < 100 && (
            <div style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 20,
              backgroundColor: template.accent_color, color: '#fff',
              fontSize: 22, fontWeight: 600, marginBottom: 28, fontFamily: template.body_font,
            }}>
              {String(scene.scene_id).padStart(2, '0')}
            </div>
          )}

          {/* 主标题（放大） */}
          <h1 style={{
            color: template.text_color, fontSize: 76, fontWeight: 800, lineHeight: 1.3,
            fontFamily: template.title_font, margin: 0,
            marginBottom: visual.subtitle ? 24 : 0,
            textShadow: template.shadow !== 'none' ? template.shadow : 'none',
          }}>
            {visual.title}
          </h1>

          {/* 副标题（放大） */}
          {visual.subtitle && (
            <p style={{
              color: template.primary_color, fontSize: 40, fontWeight: 400,
              fontFamily: template.body_font, margin: 0, opacity: 0.9,
            }}>
              {visual.subtitle}
            </p>
          )}
        </div>

        {/* 标注组件（位置往中间靠） */}
        {visual.components?.map((comp: any, i: number) => {
          const positionMap: Record<string, any> = {
            top_center: { top: 130, left: 0, right: 0, textAlign: 'center' },
            top_left: { top: 130, left: 100 },
            top_right: { top: 130, right: 100 },
            bottom_center: { bottom: 280, left: 0, right: 0, textAlign: 'center' },
            bottom_left: { bottom: 280, left: 100 },
            bottom_right: { bottom: 280, right: 100 },
            center: { top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)' },
          };
          const pos = positionMap[comp.position] || positionMap.top_center;
          const color = comp.color || template.accent_color;

          if (comp.type === 'label') {
            return (
              <div key={i} style={{
                position: 'absolute', ...pos, color,
                fontSize: 32, fontWeight: 600, fontFamily: template.body_font, zIndex: 3,
              }}>
                {comp.text}
              </div>
            );
          }
          if (comp.type === 'badge') {
            return (
              <div key={i} style={{
                position: 'absolute', ...pos, display: 'inline-block',
                padding: '6px 20px', borderRadius: 12, backgroundColor: color, color: '#fff',
                fontSize: 28, fontWeight: 600, fontFamily: template.body_font, zIndex: 3, width: 'fit-content',
                margin: comp.position?.includes('center') ? '0 auto' : undefined,
              }}>
                {comp.text}
              </div>
            );
          }
          return null;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
