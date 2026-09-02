// AnimationScene.tsx — 动画场景（集成 Lottie + 动画背景）
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { LottieComponent, FallbackAnimation } from '../LottieComponent';
import { AnimatedBackground, pickBgType } from '../AnimatedBackground';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface AnimationSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const AnimationScene: React.FC<AnimationSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalFrames = scene.duration_in_frames || fps * 5;
  const exitStart = totalFrames - 10;
  const exitOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const hasLottie = visual.animation_source && (visual.animation_source.endsWith('.json') || visual.animation_source.endsWith('.lottie'));
  const bgType = pickBgType('animation', scene.scene_id || 0);

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

      {/* 内容可读性渐变遮罩 */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, ${template.bg_color}aa 0%, ${template.bg_color}66 40%, transparent 70%)`,
      }} />

      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: opacity * exitOpacity,
      }}>
        {/* 动画内容 */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasLottie ? (
            <LottieComponent animationSource={visual.animation_source} template={template} width={450} height={450} />
          ) : (
            <FallbackAnimation template={template} />
          )}
        </div>

        {/* 标题/副标题（放大） */}
        {visual.title && (
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginTop: 20, padding: '0 100px' }}>
            <h2 style={{
              color: template.text_color, fontSize: 68, fontWeight: 800, lineHeight: 1.3,
              fontFamily: template.title_font, margin: 0,
              textShadow: '2px 2px 8px rgba(0,0,0,0.6)',
            }}>
              {visual.title}
            </h2>
            {visual.subtitle && (
              <p style={{
                color: template.primary_color, fontSize: 36, fontWeight: 400,
                fontFamily: template.body_font, margin: '12px 0 0', opacity: 0.9,
              }}>
                {visual.subtitle}
              </p>
            )}
          </div>
        )}

        {/* 标注组件（位置往中间靠 + 字号增大） */}
        {visual.overlay_components?.map((comp: any, i: number) => {
          const positionMap: Record<string, any> = {
            top_center: { position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center' },
            top_left: { position: 'absolute', top: 130, left: 100 },
            top_right: { position: 'absolute', top: 130, right: 100 },
            bottom_center: { position: 'absolute', bottom: 280, left: 0, right: 0, textAlign: 'center' },
            bottom_left: { position: 'absolute', bottom: 280, left: 100 },
            bottom_right: { position: 'absolute', bottom: 280, right: 100 },
            center: { position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)' },
          };
          const pos = positionMap[comp.position] || positionMap.top_center;

          if (comp.type === 'badge') {
            return (
              <div key={i} style={{
                ...pos, display: 'inline-block', padding: '6px 20px', borderRadius: 12,
                backgroundColor: comp.color || template.accent_color, color: '#fff',
                fontSize: 30, fontWeight: 600, fontFamily: template.body_font, zIndex: 3, width: 'fit-content',
                margin: comp.position?.includes('center') ? '0 auto' : undefined,
              }}>
                {comp.text}
              </div>
            );
          }
          return (
            <div key={i} style={{
              ...pos, color: comp.color || template.text_color,
              fontSize: 40, fontWeight: 700, fontFamily: template.title_font,
              textShadow: '2px 2px 8px rgba(0,0,0,0.6)', zIndex: 3,
            }}>
              {comp.text}
            </div>
          );
        })}

        {/* 也支持 components 字段（兼容 DeepSeek 格式） */}
        {visual.components?.map((comp: any, i: number) => {
          const positionMap: Record<string, any> = {
            top_center: { position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center' },
            top_left: { position: 'absolute', top: 130, left: 100 },
            top_right: { position: 'absolute', top: 130, right: 100 },
            bottom_center: { position: 'absolute', bottom: 280, left: 0, right: 0, textAlign: 'center' },
            center: { position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', transform: 'translateY(-50%)' },
          };
          const pos = positionMap[comp.position] || positionMap.top_center;

          if (comp.type === 'badge') {
            return (
              <div key={`c-${i}`} style={{
                ...pos, display: 'inline-block', padding: '6px 20px', borderRadius: 12,
                backgroundColor: comp.color || template.accent_color, color: '#fff',
                fontSize: 30, fontWeight: 600, fontFamily: template.body_font, zIndex: 3, width: 'fit-content',
                margin: comp.position?.includes('center') ? '0 auto' : undefined,
              }}>
                {comp.text}
              </div>
            );
          }
          return (
            <div key={`c-${i}`} style={{
              ...pos, color: comp.color || template.text_color,
              fontSize: 40, fontWeight: 700, fontFamily: template.title_font,
              textShadow: '2px 2px 8px rgba(0,0,0,0.6)', zIndex: 3,
            }}>
              {comp.text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
