// Root.tsx — 根 Composition 定义
import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition } from './VideoComposition';
import type { TTSResult, ScriptData } from './types/script';

export interface VideoCompositionProps {
  script: ScriptData | null;
  audioResults: Record<number, TTSResult>;
}

export const Root: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={VideoComposition as any}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        script: null,
        audioResults: {},
      }}
      calculateMetadata={async ({ props }) => {
        const p = props as VideoCompositionProps;
        if (!p?.script) {
          return {
            durationInFrames: 300,
            fps: 30,
            width: 1080,
            height: 1920,
          };
        }
        const fps = p.script.fps || 30;
        let total = 0;
        for (const [, result] of Object.entries(p.audioResults || {})) {
          total += Math.ceil((result as TTSResult).audio_duration * fps);
        }
        const sceneIds = p.script.scenes.map((s) => s.scene_id);
        for (const id of sceneIds) {
          if (!p.audioResults[id]) {
            const scene = p.script.scenes.find((s) => s.scene_id === id);
            if (scene) total += Math.ceil(scene.duration * fps);
          }
        }
        if (!p.audioResults[9999]) {
          total += Math.ceil(p.script.outro.duration * fps);
        }
        return {
          durationInFrames: Math.max(total, 30),
          fps,
          width: p.script.resolution.width,
          height: p.script.resolution.height,
        };
      }}
    />
  );
};
