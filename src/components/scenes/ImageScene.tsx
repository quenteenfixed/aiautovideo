// ImageScene.tsx — 图片场景（Ken Burns + 动画背景）
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { kenBurns } from '../../utils/animations';
import { AnimatedBackground, pickBgType } from '../AnimatedBackground';
import type { SceneRuntime, TemplateConfig } from '../../types/script';

interface ImageSceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
  visual: any;
}

export const ImageScene: React.FC<ImageSceneProps> = ({ scene, template, visual }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalFrames = scene.duration_in_frames || fps * 5;
  const exitStart = totalFrames - 15;
  const exitOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  const effect = visual.effect || 'static';
  const hasImage = visual.image_source && (visual.image_source.startsWith('http') || visual.image_source.startsWith('./') || visual.image_source.startsWith('/'));

  let imgTransform = 'none';
  if (effect === 'ken_burns') {
    const kb = kenBurns(frame, totalFrames, fps);
    imgTransform = `scale(${kb.scale}) translate(${kb.translateX}px, ${kb.translateY}px)`;
  } else if (effect === 'parallax') {
    const progress = frame / totalFrames;
    const parallaxX = interpolate(progress, [0, 1], [20, -20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    imgTransform = `translateX(${parallaxX}px) scale(1.05)`;
  }

  const bgType = pickBgType('image', scene.scene_id || 0);

  return (
    <AbsoluteFill style={{ backgroundColor: template.bg_color, opacity: opacity * exitOpacity, overflow: 'hidden' }}>
      {/* 动画背景 */}
      <AnimatedBackground type={bgType} bgColor={template.bg_color} accentColor={template.accent_color} primaryColor={template.primary_color} seed={scene.scene_id || 1} />

      {/* 图片 */}
      {hasImage ? (
        <AbsoluteFill>
          <img src={visual.image_source} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: imgTransform }} />
          <AbsoluteFill style={{ background: `linear-gradient(to bottom, ${template.bg_color}33 0%, ${template.bg_color}66 40%, ${template.bg_color}aa 75%, ${template.bg_color}ee 100%)` }} />
        </AbsoluteFill>
      ) : null}

      {/* 标注组件（位置往中间靠 + 字号增大） */}
      {visual.overlay_components?.map((comp: any, i: number) => {
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
            <div key={i} style={{ ...pos, display: 'inline-block', margin: '0 auto', padding: '8px 24px', borderRadius: 16, backgroundColor: comp.color || template.accent_color, color: '#fff', fontSize: 30, fontWeight: 700, fontFamily: template.body_font, width: 'fit-content', zIndex: 3 }}>
              {comp.text}
            </div>
          );
        }
        return (
          <div key={i} style={{ ...pos, color: comp.color || template.text_color, fontSize: 40, fontWeight: 700, fontFamily: template.title_font, textShadow: '2px 2px 8px rgba(0,0,0,0.8)', zIndex: 3 }}>
            {comp.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
