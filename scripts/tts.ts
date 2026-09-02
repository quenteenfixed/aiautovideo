// tts.ts — TTS TypeScript 调用层
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { ScriptData, TTSResult, WordBoundary, VoiceConfig } from '../src/types/script';

const execAsync = promisify(exec);

const PYTHON_PATH = process.env.PYTHON_BIN || process.env.PYTHON_PATH || 'python3';
const TTS_SCRIPT = path.resolve(__dirname, 'tts.py');

function escapeShellArg(arg: string): string {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

async function getAudioDuration(filePath: string): Promise<number> {
  const ffprobeBin = process.env.FFMPEG_BIN
    ? process.env.FFMPEG_BIN.replace(/ffmpeg$/, 'ffprobe')
    : '/usr/local/bin/ffprobe';
  try {
    const { stdout } = await execAsync(
      `"${ffprobeBin}" -i "${filePath}" -show_entries format=duration -v quiet -of csv="p=0" 2>/dev/null || echo "0"`
    );
    const duration = parseFloat(stdout.trim());
    if (duration > 0) return duration;
  } catch {
    // ffprobe not available, try alternative
  }
  // Fallback: rough estimate from MP3 frame headers (approximate)
  const stats = await fs.stat(filePath);
  // 24kHz, 48kbps mono MP3: ~6000 bytes/sec
  return Math.max(1, stats.size / 6000);
}

export async function synthesizeScene(
  sceneId: number,
  narration: string,
  voice: VoiceConfig,
  outputDir: string
): Promise<TTSResult> {
  const outputFile = path.join(outputDir, `scene_${sceneId}.mp3`);

  const cmd = [
    PYTHON_PATH,
    TTS_SCRIPT,
    escapeShellArg(narration),
    escapeShellArg(voice.voice_name),
    escapeShellArg(voice.rate),
    escapeShellArg(voice.pitch),
    escapeShellArg(voice.volume),
    escapeShellArg(outputFile),
  ].join(' ');

  console.log(`  [Scene ${sceneId}] TTS synthesizing...`);

  try {
    // 保留原环境变量，确保 TRAE python 能正确加载模块
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });
    const result = JSON.parse(stdout.trim());

    if (result.error) {
      throw new Error(result.error);
    }

    const audio_duration = await getAudioDuration(outputFile);
    const word_boundaries: WordBoundary[] = result.word_boundaries || [];

    console.log(
      `  [Scene ${sceneId}] Done: ${audio_duration.toFixed(2)}s, ${word_boundaries.length} words`
    );

    return {
      audio_file: outputFile,
      audio_duration,
      word_boundaries,
    };
  } catch (err: any) {
    // If edge-tts fails, try with a simpler approach
    if (err.message?.includes('edge_tts') || err.message?.includes('module')) {
      console.error(`  [Scene ${sceneId}] edge-tts not available, trying pip install...`);
      await execAsync('pip3 install edge-tts');
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      const result = JSON.parse(stdout.trim());
      const audio_duration = await getAudioDuration(outputFile);
      return {
        audio_file: outputFile,
        audio_duration,
        word_boundaries: result.word_boundaries || [],
      };
    }
    throw err;
  }
}

export async function generateAllAudio(
  script: ScriptData,
  outputDir: string
): Promise<Map<number, TTSResult>> {
  const results = new Map<number, TTSResult>();
  await fs.mkdir(outputDir, { recursive: true });

  // Also handle outro
  const allScenes = [
    ...script.scenes,
    { scene_id: -1, narration: script.outro.narration, duration: script.outro.duration },
  ];

  for (const scene of allScenes) {
    const result = await synthesizeScene(
      scene.scene_id === -1 ? 9999 : scene.scene_id,
      scene.narration,
      script.voice,
      outputDir
    );
    results.set(scene.scene_id === -1 ? 9999 : scene.scene_id, result);
  }

  return results;
}
