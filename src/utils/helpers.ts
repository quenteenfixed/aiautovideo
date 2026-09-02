// helpers.ts — 辅助函数
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ScriptData, SceneRuntime, ScriptRuntime, TTSResult } from '../types/script';

export async function loadScript(scriptPath: string): Promise<ScriptData> {
  const content = await fs.readFile(scriptPath, 'utf-8');
  return JSON.parse(content);
}

export function updateDurations(
  script: ScriptData,
  audioResults: Map<number, TTSResult>
): ScriptRuntime {
  const fps = script.fps;
  const scenes: SceneRuntime[] = script.scenes.map((scene) => {
    const audio = audioResults.get(scene.scene_id);
    if (audio) {
      return {
        ...scene,
        audio_file: audio.audio_file,
        audio_duration: audio.audio_duration,
        duration_in_frames: Math.ceil(audio.audio_duration * fps),
        word_boundaries: audio.word_boundaries,
      };
    }
    return {
      ...scene,
      duration_in_frames: Math.ceil(scene.duration * fps),
    };
  });

  return { ...script, scenes };
}

export function calculateTotalFrames(script: ScriptRuntime): number {
  const fps = script.fps;
  let total = 0;
  for (const scene of script.scenes) {
    total += scene.duration_in_frames || Math.ceil(scene.duration * fps);
  }
  // Add outro
  const outroAudio = script.scenes.find((s) => s.scene_id === 9999);
  if (outroAudio?.audio_duration) {
    total += Math.ceil(outroAudio.audio_duration * fps);
  } else {
    total += Math.ceil(script.outro.duration * fps);
  }
  return total;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export function resolveAssetPath(assetRef: string, baseDir: string): string {
  if (path.isAbsolute(assetRef)) return assetRef;
  return path.resolve(baseDir, assetRef);
}
