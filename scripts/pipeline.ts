// pipeline.ts — 核心流水线编排脚本
// 执行流程: 加载script.json → 校验 → TTS合成 → 渲染视频 → 输出
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { loadScript, calculateTotalFrames } from '../src/utils/helpers';
import { generateAllAudio } from './tts';
import { validateScript, printValidationErrors } from './validate';

const execAsync = promisify(exec);

interface PipelineOptions {
  scriptPath: string;
  outputDir?: string;
  skipTts?: boolean;
  audioDir?: string;
}

export async function runPipeline(options: PipelineOptions): Promise<void> {
  const {
    scriptPath,
    outputDir = process.env.OUTPUT_DIR || './output',
    skipTts = false,
    audioDir,
  } = options;

  const startTime = Date.now();
  console.log('========================================');
  console.log('  AI Auto Video Pipeline');
  console.log('========================================\n');

  // Step 1: Load script.json
  console.log('[Step 1] Loading script.json...');
  const scriptPathResolved = path.resolve(scriptPath);
  const script = await loadScript(scriptPathResolved);
  console.log(`  Title: ${script.title}`);
  console.log(`  Scenes: ${script.scenes.length}`);
  console.log(`  Template: ${script.template}`);
  console.log(`  Resolution: ${script.resolution.width}x${script.resolution.height}`);
  console.log(`  FPS: ${script.fps}\n`);

  // Step 2: Validate script
  console.log('[Step 2] Validating script...');
  const errors = validateScript(script);
  if (errors.length > 0) {
    printValidationErrors(errors);
    console.error('Script validation failed. Aborting.\n');
    process.exit(1);
  }
  console.log('  Validation passed.\n');

  // Prepare directories
  const scriptBaseDir = path.dirname(scriptPathResolved);
  const projectRoot = path.resolve(__dirname, '..');
  const audioOutputDir = audioDir || path.join(projectRoot, 'output', script.video_id, 'audio');
  const videoOutputDir = path.resolve(outputDir);
  await fs.mkdir(audioOutputDir, { recursive: true });
  await fs.mkdir(videoOutputDir, { recursive: true });

  // Step 3: TTS synthesis
  let audioResults: Record<number, any> = {};

  if (skipTts) {
    console.log('[Step 3] Skipping TTS — loading existing audio...');
    // Try to load existing audio results
    const audioMetaPath = path.join(audioOutputDir, 'audio_meta.json');
    try {
      const metaContent = await fs.readFile(audioMetaPath, 'utf-8');
      audioResults = JSON.parse(metaContent);
      console.log(`  Loaded ${Object.keys(audioResults).length} audio files.\n`);
    } catch {
      console.warn('  No existing audio found. Will use default durations.\n');
    }
  } else {
    console.log('[Step 3] TTS synthesis...');
    try {
      const audioMap = await generateAllAudio(script, audioOutputDir);
      // Convert Map to Record
      audioMap.forEach((value, key) => {
        audioResults[key] = value;
      });

      // Save audio metadata for reuse
      const audioMetaPath = path.join(audioOutputDir, 'audio_meta.json');
      await fs.writeFile(audioMetaPath, JSON.stringify(audioResults, null, 2));
      console.log(`  Audio metadata saved to: ${audioMetaPath}`);
      console.log(`  ${Object.keys(audioResults).length} scenes synthesized.\n`);
    } catch (err: any) {
      console.error(`  TTS failed: ${err.message}`);
      console.error('  Continuing with default durations...\n');
    }
  }

  // Step 4: Render video
  console.log('[Step 4] Rendering video...');
  const entryPoint = path.resolve(projectRoot, 'src/index.ts');
  const outputFile = path.join(videoOutputDir, `${script.video_id}.mp4`);

  // Build the props JSON for Remotion
  const propsJson = JSON.stringify({
    script,
    audioResults,
  });

  const compositionId = 'MainVideo';
  const concurrency = process.env.REMOTION_CONCURRENCY || '2';
  const imageFormat = 'jpeg';

  const renderCmd = [
    'npx',
    'remotion',
    'render',
    entryPoint,
    compositionId,
    `"${outputFile}"`,
    `--props='${propsJson.replace(/'/g, "'\\''")}'`,
    `--concurrency=${concurrency}`,
    `--image-format=${imageFormat}`,
    '--log=verbose',
  ].join(' ');

  console.log(`  Rendering to: ${outputFile}`);
  console.log(`  Command: remotion render ${compositionId}\n`);

  try {
    const { stdout, stderr } = await execAsync(renderCmd, {
      maxBuffer: 50 * 1024 * 1024,
      cwd: projectRoot,
      timeout: 600000,
    });

    if (stdout) {
      // Extract key progress lines
      const lines = stdout.split('\n').filter(
        (l) => l.includes('Rendering') || l.includes('frames') || l.includes('Done') || l.includes('Encoding')
      );
      lines.forEach((l) => console.log(`  ${l.trim()}`));
    }

    if (stderr && !stderr.includes('Warning')) {
      console.warn(`  stderr: ${stderr.substring(0, 500)}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  Video rendered: ${outputFile}`);
    console.log(`  Total time: ${elapsed}s\n`);

  } catch (err: any) {
    console.error(`\n  Render failed: ${err.message}`);
    if (err.stderr) {
      console.error(`  stderr: ${err.stderr.substring(0, 1000)}`);
    }
    console.error('\n  Trying alternative render approach...\n');

    // Fallback: use remotion CLI directly
    try {
      await execAsync(
        `npx remotion render ${entryPoint} ${compositionId} "${outputFile}" --props='${propsJson}'`,
        { maxBuffer: 50 * 1024 * 1024, cwd: projectRoot, timeout: 600000 }
      );
      console.log(`  Video rendered (fallback): ${outputFile}\n`);
    } catch (err2: any) {
      console.error(`  Fallback also failed: ${err2.message}\n`);
      throw err2;
    }
  }

  // Step 5: Summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('========================================');
  console.log('  Pipeline Complete');
  console.log('========================================');
  console.log(`  Output: ${outputFile}`);
  console.log(`  Total time: ${totalElapsed}s`);
  console.log('');

  // Write a summary file
  const summaryPath = path.join(videoOutputDir, `${script.video_id}_summary.json`);
  await fs.writeFile(summaryPath, JSON.stringify({
    video_id: script.video_id,
    title: script.title,
    output_file: outputFile,
    total_time_seconds: parseFloat(totalElapsed),
    timestamp: new Date().toISOString(),
    scene_count: script.scenes.length,
    template: script.template,
  }, null, 2));
  console.log(`  Summary: ${summaryPath}`);
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const scriptPath = args[0];

  if (!scriptPath) {
    console.error('Usage: tsx scripts/pipeline.ts <script.json> [--skip-tts] [--audio-dir <dir>]');
    process.exit(1);
  }

  const skipTts = args.includes('--skip-tts');
  const audioDirIdx = args.indexOf('--audio-dir');
  const audioDir = audioDirIdx >= 0 ? args[audioDirIdx + 1] : undefined;

  runPipeline({ scriptPath, skipTts, audioDir }).catch((err) => {
    console.error('\nPipeline error:', err);
    process.exit(1);
  });
}
