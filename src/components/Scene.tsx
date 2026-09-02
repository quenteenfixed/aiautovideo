// Scene.tsx — 场景分发器
import React from 'react';
import { TextCardScene } from './scenes/TextCardScene';
import { ChartScene } from './scenes/ChartScene';
import { AnimationScene } from './scenes/AnimationScene';
import { ImageScene } from './scenes/ImageScene';
import { MixedScene } from './scenes/MixedScene';
import { CtaCardScene } from './scenes/CtaCardScene';
import type { SceneRuntime, TemplateConfig } from '../types/script';

interface SceneProps {
  scene: SceneRuntime;
  template: TemplateConfig;
  fps: number;
}

export const Scene: React.FC<SceneProps> = ({ scene, template, fps }) => {
  const visual = scene.visual as any;
  const props = { scene, template, fps, visual };

  switch (visual.type) {
    case 'text_card':
      return <TextCardScene {...props} />;
    case 'chart':
      return <ChartScene {...props} />;
    case 'animation':
      return <AnimationScene {...props} />;
    case 'image':
      return <ImageScene {...props} />;
    case 'mixed':
      return <MixedScene {...props} />;
    case 'cta_card':
      return <CtaCardScene {...props} />;
    default:
      return <TextCardScene {...props} />;
  }
};
