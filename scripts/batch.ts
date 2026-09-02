// batch.ts — 批量生产脚本
// 批量渲染多个 script.json，支持模板轮换、错误恢复和进度日志
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './logger';
import { loadScript } from '../src/utils/helpers';
import { validateScript } from './validate';
import { generateAllAudio } from './tts';
import { AssetManager } from '../src/utils/assetManager';
import type { TemplateType } from '../src/types/script';

const execAsync = promisify(exec);

const TEMPLATES: TemplateType[] = [
  'data_visual_style',
  'illustration_style',
  'cinematic_style',
  'minimal_style',
  'infographic_style',
];

interface BatchOptions {
  inputDir: string;
  outputDir?: string;
  ttsOnly?: boolean;
  skipTts?: boolean;
  rotateTemplates?: boolean;
  concurrency?: number;
}

interface BatchResult {
  scriptPath: string;
  videoId: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  duration?: number;
  output?: string;
}

async function processScript(
  scriptPath: string,
  options: BatchOptions,
  logger: Logger,
  templateIndex: number
): Promise<BatchResult> {
  const startTime = Date.now();
  const fileName = path.basename(scriptPath);

  try {
    logger.section(`Processing: ${fileName}`);

    // Load and validate script
    logger.info('Loading script...', fileName);
    const script = await loadScript(scriptPath);

    // Rotate template if enabled
    if (options.rotateTemplates) {
      const newTemplate = TEMPLATES[templateIndex % TEMPLATES.length];
      if (script.template !== newTemplate) {
        logger.info(`Rotating template: ${script.template} -> ${newTemplate}`, fileName);
        script.template = newTemplate;
      }
    }

    logger.info(`Title: ${script.title}`, fileName);
    logger.info(`Scenes: ${script.scenes.length}`, fileName);
    logger.info(`Template: ${script.template}`, fileName);

    // Validate
    const errors = validateScript(script);
    if (errors.some(e => e.severity === 'error')) {
      throw new Error(`Validation failed: ${errors.filter(e => e.severity === 'error').map(e => e.message).join(', ')}`);
    }
    logger.success('Validation passed', fileName);

    // Prepare directories
    const audioDir = path.join(options.outputDir!, script.video_id, 'audio');
    await fs.mkdir(audioDir, { recursive: true });

    // Pre-fetch assets
    logger.info('Checking assets...', fileName);
    const assetManager = new AssetManager();
    await assetManager.init();
    await assetManager.resolveScriptAssets(script);
    const stats = assetManager.getCacheStats();
    logger.info(`Assets: ${stats.count} cached, ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`, fileName);

    // TTS synthesis
    let audioResults: Record<number, any> = {};

    if (options.skipTts) {
      logger.info('Skipping TTS, loading existing audio...', fileName);
      try {
        const meta = await fs.readFile(path.join(audioDir, 'audio_meta.json'), 'utf-8');
        audioResults = JSON.parse(meta);
        logger.info(`Loaded ${Object.keys(audioResults).length} audio files`, fileName);
      } catch {
        logger.warn('No existing audio found, using default durations', fileName);
      }
    } else if (!options.ttsOnly) {
      logger.info('TTS synthesis...', fileName);
      const audioMap = await generateAllAudio(script, audioDir);
      audioMap.forEach((v, k) => { audioResults[k] = v; });
      await fs.writeFile(
        path.join(audioDir, 'audio_meta.json'),
        JSON.stringify(audioResults, null, 2)
      );
      logger.success(`TTS complete: ${Object.keys(audioResults).length} scenes`, fileName);
    }

    if (options.ttsOnly) {
      logger.info('TTS-only mode, skipping render', fileName);
      return {
        scriptPath,
        videoId: script.video_id,
        status: 'success',
        duration: (Date.now() - startTime) / 1000,
      };
    }

    // Build render props
    const propsJson = JSON.stringify({ script, audioResults });
    const propsFile = path.join(audioDir, 'render_props.json');
    await fs.writeFile(propsFile, propsJson);

    // Render video
    logger.info('Rendering video...', fileName);
    const outputFile = path.join(options.outputDir!, `${script.video_id}.mp4`);
    const entryPoint = path.resolve(__dirname, '..', 'src', 'index.ts');
    const concurrency = options.concurrency || 2;

    const renderCmd = [
      'npx', 'remotion', 'render',
      entryPoint,
      'MainVideo',
      `"${outputFile}"`,
      `--props="${propsFile}"`,
      `--concurrency=${concurrency}`,
      '--image-format=jpeg',
      '--log=info',
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(renderCmd, {
        maxBuffer: 100 * 1024 * 1024,
        timeout: 600000,
        cwd: path.resolve(__dirname, '..'),
      });

      // Log render progress
      if (stdout) {
        const lines = stdout.split('\n').filter(l => l.includes('Rendered'));
        if (lines.length > 0) {
          logger.info(`Rendered ${lines.length} frames`, fileName);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.success(`Video rendered: ${outputFile} (${elapsed}s)`, fileName);

      return {
        scriptPath,
        videoId: script.video_id,
        status: 'success',
        duration: parseFloat(elapsed),
        output: outputFile,
      };
    } catch (renderErr: any) {
      logger.error(`Render failed: ${renderErr.message}`, fileName);
      if (renderErr.stderr) {
        logger.debug(`stderr: ${renderErr.stderr.substring(0, 500)}`, fileName);
      }
      return {
        scriptPath,
        videoId: script.video_id,
        status: 'failed',
        error: renderErr.message,
        duration: (Date.now() - startTime) / 1000,
      };
    }
  } catch (err: any) {
    logger.error(`Failed: ${err.message}`, fileName);
    return {
      scriptPath,
      videoId: 'unknown',
      status: 'failed',
      error: err.message,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputDir = args.find(a => !a.startsWith('--'));

  if (!inputDir) {
    console.log('AI Auto Video - Batch Production');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx scripts/batch.ts <input_dir> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --output <dir>         Output directory (default: ./output)');
    console.log('  --tts-only             Only run TTS, skip rendering');
    console.log('  --skip-tts             Skip TTS, use existing audio');
    console.log('  --rotate-templates     Rotate through all 5 templates');
    console.log('  --concurrency <n>      Render concurrency (default: 2)');
    console.log('');
    process.exit(0);
  }

  const options: BatchOptions = {
    inputDir: path.resolve(inputDir),
    outputDir: args[args.indexOf('--output') + 1] || './output',
    ttsOnly: args.includes('--tts-only'),
    skipTts: args.includes('--skip-tts'),
    rotateTemplates: args.includes('--rotate-templates'),
    concurrency: parseInt(args[args.indexOf('--concurrency') + 1]) || 2,
  };

  // Setup logger
  const logDir = path.join(options.outputDir!, 'logs');
  const logger = new Logger(logDir, true);

  logger.section('AI Auto Video - Batch Production');
  logger.info(`Input: ${options.inputDir}`);
  logger.info(`Output: ${options.outputDir}`);
  logger.info(`TTS Only: ${options.ttsOnly}`);
  logger.info(`Skip TTS: ${options.skipTts}`);
  logger.info(`Rotate Templates: ${options.rotateTemplates}`);
  logger.info(`Concurrency: ${options.concurrency}`);

  // Find all script.json files
  let scriptFiles: string[] = [];
  try {
    const stat = await fs.stat(options.inputDir);
    if (stat.isFile()) {
      // Single file
      scriptFiles = [options.inputDir];
    } else {
      // Directory: find all .json files
      const files = await fs.readdir(options.inputDir);
      scriptFiles = files
        .filter(f => f.endsWith('_script.json') || f.endsWith('.json'))
        .filter(f => !f.includes('render_props') && !f.includes('audio_meta'))
        .map(f => path.join(options.inputDir, f));
    }
  } catch {
    logger.error(`Input not found: ${options.inputDir}`);
    process.exit(1);
  }

  if (scriptFiles.length === 0) {
    logger.warn('No script files found');
    process.exit(0);
  }

  logger.info(`Found ${scriptFiles.length} script files\n`);

  // Process each script
  const results: BatchResult[] = [];

  for (let i = 0; i < scriptFiles.length; i++) {
    logger.progress(i, scriptFiles.length, `Processing ${path.basename(scriptFiles[i])}`);
    const result = await processScript(scriptFiles[i], options, logger, i);
    results.push(result);
    logger.progress(i + 1, scriptFiles.length, 'Done');
  }

  // Summary
  logger.section('Batch Summary');
  const succeeded = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  logger.info(`Total: ${results.length}`);
  logger.success(`Succeeded: ${succeeded.length}`);
  if (failed.length > 0) {
    logger.error(`Failed: ${failed.length}`);
    failed.forEach(r => {
      logger.error(`  ${path.basename(r.scriptPath)}: ${r.error}`, 'FAILED');
    });
  }

  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  logger.info(`Total time: ${totalTime.toFixed(1)}s`);

  if (succeeded.length > 0) {
    logger.info('\nOutput files:');
    succeeded.forEach(r => {
      if (r.output) {
        logger.info(`  ${r.videoId}: ${r.output}`);
      }
    });
  }

  // Save batch summary
  const summaryPath = path.join(options.outputDir!, 'batch_summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
    total_time: totalTime,
    results,
  }, null, 2));

  await logger.saveSummary(path.join(logDir, 'batch_log.json'));
  logger.info(`Summary saved: ${summaryPath}`);
}

main().catch(err => {
  console.error('Batch error:', err);
  process.exit(1);
});
