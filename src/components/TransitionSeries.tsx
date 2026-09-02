// TransitionSeries.tsx — 转场系统组件
// 基于 @remotion/transitions 实现场景间转场效果
import React from 'react';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import type { SceneRuntime, TemplateConfig, TransitionType } from '../types/script';
import { Scene } from './Scene';

interface TransitionSceneProps {
  scenes: SceneRuntime[];
  template: TemplateConfig;
  fps: number;
}

// Build transition presentation based on type
function getTransition(type: TransitionType): any {
  switch (type) {
    case 'fade':
      return fade();
    case 'slide_left':
      return slide({ direction: 'from-left' });
    case 'slide_right':
      return slide({ direction: 'from-right' });
    case 'slide_up':
      return slide({ direction: 'from-bottom' });
    case 'zoom_in':
      return fade();
    case 'zoom_out':
      return fade();
    case 'wipe':
      return wipe();
    case 'bounce':
      return fade();
    case 'none':
    default:
      return fade();
  }
}

export const TransitionSceneSeries: React.FC<TransitionSceneProps> = ({ scenes, template, fps }) => {
  return (
    <TransitionSeries>
      {scenes.map((scene, i) => {
        const duration = scene.duration_in_frames || Math.ceil(scene.duration * fps);
        const transitionDuration = Math.min(15, Math.floor(duration / 3));

        return (
          <React.Fragment key={scene.scene_id}>
            <TransitionSeries.Sequence durationInFrames={duration}>
              <Scene scene={scene} template={template} fps={fps} />
            </TransitionSeries.Sequence>
            {i < scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={getTransition(scene.transition_out || 'fade')}
                timing={linearTiming({ durationInFrames: transitionDuration })}
              />
            )}
          </React.Fragment>
        );
      })}
    </TransitionSeries>
  );
};
