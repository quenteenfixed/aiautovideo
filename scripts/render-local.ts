// render-local.ts — 本地渲染脚本（绕过 Remotion v4 音频兼容问题）
// 方案: 1) @remotion/renderer API 渲染纯视频（muted=true）→ 2) 系统 ffmpeg 合并音频 → 3) 输出最终 MP4
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { loadScript } from '../src/utils/helpers';
import { generateAllAudio } from './tts';
import { validateScript, printValidationErrors } from './validate';
import { Logger } from './logger';

const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 显式路径配置 — 避免 TRAE 环境的二进制兼容问题
const BIN = {
  node: process.env.NODE_BIN || '/usr/local/bin/node',
  ffmpeg: process.env.FFMPEG_BIN || '/usr/local/bin/ffmpeg',
  ffprobe: process.env.FFMPEG_BIN ? process.env.FFMPEG_BIN.replace(/ffmpeg$/, 'ffprobe') : '/usr/local/bin/ffprobe',
  python3: process.env.PYTHON_BIN || 'python3',
};

interface RenderOptions {
  scriptPath: string;
  outputDir?: string;
  skipTts?: boolean;
  audioDir?: string;
  fps?: number;
  concurrency?: number;
}

export async function renderLocal(options: RenderOptions): Promise<string> {
  const logger = new Logger(path.join(options.outputDir || 'output', 'logs'), true);
  const startTime = Date.now();

  logger.section('AI Auto Video - 本地渲染');
  logger.info(`Node: ${BIN.node}`);
  logger.info(`FFmpeg: ${BIN.ffmpeg}`);
  logger.info(`Python: ${BIN.python3}`);

  // Step 1: 加载 script.json
  logger.info('加载 script.json...');
  const scriptPathResolved = path.resolve(options.scriptPath);
  const script = await loadScript(scriptPathResolved);
  logger.info(`标题: ${script.title}`);
  logger.info(`场景: ${script.scenes.length}`);
  logger.info(`模板: ${script.template}`);
  logger.info(`分辨率: ${script.resolution.width}x${script.resolution.height}`);
  logger.info(`帧率: ${script.fps}`);

  // Step 2: 校验
  logger.info('校验脚本...');
  const errors = validateScript(script);
  if (errors.some(e => e.severity === 'error')) {
    printValidationErrors(errors);
    throw new Error('脚本校验失败');
  }
  logger.success('校验通过');

  // 准备目录
  const videoId = script.video_id;
  const audioOutputDir = options.audioDir ||
    path.join(PROJECT_ROOT, 'output', videoId, 'audio');
  const videoOutputDir = path.resolve(options.outputDir || path.join(PROJECT_ROOT, 'output', videoId));
  await fs.mkdir(audioOutputDir, { recursive: true });
  await fs.mkdir(videoOutputDir, { recursive: true });

  // Step 3: TTS 合成
  let audioResults: Record<number, any> = {};

  if (options.skipTts) {
    logger.info('跳过 TTS，加载已有音频...');
    try {
      const meta = JSON.parse(await fs.readFile(
        path.join(audioOutputDir, 'audio_meta.json'), 'utf-8'));
      audioResults = meta;
      logger.info(`已加载 ${Object.keys(audioResults).length} 个音频文件`);
    } catch {
      logger.warn('未找到已有音频，将使用默认时长');
    }
  } else {
    logger.info('TTS 语音合成...');
    try {
      const audioMap = await generateAllAudio(script, audioOutputDir);
      audioMap.forEach((v, k) => { audioResults[k] = v; });
      await fs.writeFile(
        path.join(audioOutputDir, 'audio_meta.json'),
        JSON.stringify(audioResults, null, 2)
      );
      logger.success(`TTS 完成: ${Object.keys(audioResults).length} 个场景`);
    } catch (err: any) {
      logger.error(`TTS 失败: ${err.message}`);
      throw err;
    }
  }

  // Step 4: 计算总帧数
  const fps = options.fps || script.fps || 30;
  let totalFrames = 0;
  for (const scene of script.scenes) {
    const audio = audioResults[scene.scene_id];
    if (audio) {
      totalFrames += Math.ceil(audio.audio_duration * fps);
    } else {
      totalFrames += Math.ceil(scene.duration * fps);
    }
  }
  const outroAudio = audioResults[9999];
  if (outroAudio) {
    totalFrames += Math.ceil(outroAudio.audio_duration * fps);
  } else {
    totalFrames += Math.ceil(script.outro.duration * fps);
  }
  totalFrames = Math.max(totalFrames, 30);

  // Step 5: 构建渲染属性（纯视频，带音频时长但不带音频文件）
  // 传递 audio_duration 让 Remotion 计算正确的总帧数，但不传 audio_file 避免渲染 Audio 组件
  logger.info('构建渲染属性（纯视频模式）...');
  const videoOnlyAudioResults: Record<number, any> = {};
  for (const [id, result] of Object.entries(audioResults)) {
    videoOnlyAudioResults[Number(id)] = {
      audio_duration: (result as any).audio_duration,
      word_boundaries: (result as any).word_boundaries || [],
      // 不包含 audio_file，确保 <Audio> 组件不渲染
    };
  }
  const videoOnlyProps = {
    script,
    audioResults: videoOnlyAudioResults,
  };
  const propsFile = path.join(videoOutputDir, 'render_props_videoonly.json');
  await fs.writeFile(propsFile, JSON.stringify(videoOnlyProps));

  // Step 6: 使用 @remotion/renderer API 渲染纯视频（muted=true 绕过音频处理）
  const tempVideoPath = path.join(videoOutputDir, `${videoId}_video_only.mp4`);
  const entryPoint = path.resolve(PROJECT_ROOT, 'src', 'index.ts');
  const concurrency = options.concurrency || 2;

  logger.info(`渲染纯视频 (共 ${totalFrames} 帧, ${fps} fps, 并发 ${concurrency})...`);

  try {
    // 6a: 打包 Remotion 项目
    logger.info('打包 Remotion 项目...');
    const bundleLocation = await bundle({
      entryPoint,
      onProgress: (progress: number) => {
        if (progress === 1) logger.info('打包完成');
      },
    });

    // 6b: 选择 Composition（传入 props 以获取正确的 durationInFrames）
    logger.info('选择 Composition...');
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'MainVideo',
      inputProps: videoOnlyProps,
    });

    logger.info(`Composition: ${composition.id}, ${composition.durationInFrames} 帧, ${composition.fps} fps, ${composition.width}x${composition.height}`);

    // 6c: 渲染视频（muted=true 跳过所有音频处理，避免 libfdk_aac 兼容问题）
    logger.info('开始渲染帧...');
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: tempVideoPath,
      imageFormat: 'jpeg',
      concurrency,
      muted: true,
      inputProps: videoOnlyProps,
      onProgress: (() => {
        let lastReported = -1;
        return ({ progress }: { progress: number }) => {
          const pct = Math.round(progress * 100);
          // Only log at 5% intervals, and skip duplicate reports
          const bucket = Math.floor(pct / 5) * 5;
          if (bucket > lastReported && bucket > 0) {
            lastReported = bucket;
            logger.info(`渲染进度: ${pct}%`);
          }
        };
      })(),
    });

    // 验证视频文件存在
    const stats = await fs.stat(tempVideoPath);
    if (stats.size === 0) {
      throw new Error('渲染输出文件为空');
    }
    logger.success(`纯视频渲染完成: ${tempVideoPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err: any) {
    logger.error(`纯视频渲染失败: ${err.message}`);
    if (err.stack) {
      logger.debug(`stack: ${err.stack.substring(0, 1000)}`);
    }
    throw err;
  }

  // Step 7: 使用系统 ffmpeg 合并音频
  logger.info('使用系统 ffmpeg 合并音频...');

  // 构建音频列表（按场景顺序）
  const audioFiles: { file: string; delay: number; duration: number; volume?: number }[] = [];
  let cumulativeDelay = 0;

  const sfxDir = path.join(process.cwd(), 'public', 'sfx');
  const hasSfx = await fs.stat(sfxDir).then(() => true).catch(() => false);

  const sortedScenes = [...script.scenes].sort((a, b) => a.scene_id - b.scene_id);
  for (let idx = 0; idx < sortedScenes.length; idx++) {
    const scene = sortedScenes[idx];
    const audio = audioResults[scene.scene_id];

    // 剪映风格多层音效系统
    if (hasSfx) {
      const visualType = (scene.visual as any)?.type;
      const sceneDelay = cumulativeDelay;

      // === 第一场景：进场音效（盛大入场） ===
      if (idx === 0) {
        audioFiles.push({ file: path.join(sfxDir, 'swoosh_in.wav'), delay: 0, duration: 0.25, volume: 0.25 });
        audioFiles.push({ file: path.join(sfxDir, 'bell.wav'), delay: 0.1, duration: 1.0, volume: 0.15 });
      }

      // === 后续场景：转场音效 ===
      if (idx > 0 && cumulativeDelay > 0) {
        // 前驱音效（提前出现，营造期待感）
        const riserDelay = Math.max(0, sceneDelay - 0.8);
        if (visualType === 'chart' || visualType === 'cta_card') {
          audioFiles.push({ file: path.join(sfxDir, 'riser.wav'), delay: riserDelay, duration: 1.1, volume: 0.12 });
        } else if (visualType === 'animation') {
          audioFiles.push({ file: path.join(sfxDir, 'sweep_down.wav'), delay: riserDelay, duration: 0.4, volume: 0.1 });
        }

        // 主转场音效（根据视觉类型匹配）
        if (visualType === 'chart') {
          // 数据场景：电影重击 + 低音下潜（戏剧性数据揭示）
          audioFiles.push({ file: path.join(sfxDir, 'cinematic_hit.wav'), delay: sceneDelay, duration: 1.2, volume: 0.25 });
          audioFiles.push({ file: path.join(sfxDir, 'bass_drop.wav'), delay: sceneDelay + 0.05, duration: 1.0, volume: 0.15 });
        } else if (visualType === 'cta_card') {
          // CTA 场景：清脆铃声 + 闪烁（引导关注）
          audioFiles.push({ file: path.join(sfxDir, 'bell.wav'), delay: sceneDelay, duration: 1.0, volume: 0.2 });
          audioFiles.push({ file: path.join(sfxDir, 'shimmer.wav'), delay: sceneDelay + 0.1, duration: 0.6, volume: 0.18 });
        } else if (visualType === 'animation') {
          // 动画场景：故障音 + 转场扫频（科技感）
          audioFiles.push({ file: path.join(sfxDir, 'glitch.wav'), delay: sceneDelay, duration: 0.3, volume: 0.15 });
          audioFiles.push({ file: path.join(sfxDir, 'transition.wav'), delay: sceneDelay, duration: 0.3, volume: 0.18 });
        } else if (visualType === 'image') {
          // 图片场景：相机快门声
          audioFiles.push({ file: path.join(sfxDir, 'camera_shutter.wav'), delay: sceneDelay, duration: 0.15, volume: 0.22 });
        } else {
          // 文字场景：快速进场呼啸 + 弹出（节奏感）
          audioFiles.push({ file: path.join(sfxDir, 'swoosh_in.wav'), delay: sceneDelay, duration: 0.25, volume: 0.2 });
          audioFiles.push({ file: path.join(sfxDir, 'pop.wav'), delay: sceneDelay + 0.05, duration: 0.08, volume: 0.12 });
        }

        // 节奏辅助音效：tick（每场景切换添加细微脆响）
        audioFiles.push({ file: path.join(sfxDir, 'tick.wav'), delay: sceneDelay, duration: 0.03, volume: 0.06 });
      }
    }

    if (audio && audio.audio_file) {
      audioFiles.push({
        file: path.resolve(audio.audio_file),
        delay: cumulativeDelay,
        duration: audio.audio_duration,
        volume: 1.0,
      });
    }
    cumulativeDelay += audio
      ? audio.audio_duration
      : scene.duration;
  }

  // Outro 音频
  if (outroAudio && outroAudio.audio_file) {
    // Outro: 心跳 + 低音下潜 + 铃声（戏剧性结尾）
    if (hasSfx) {
      const outroDelay = cumulativeDelay;
      audioFiles.push({ file: path.join(sfxDir, 'heartbeat.wav'), delay: Math.max(0, outroDelay - 1.5), duration: 0.8, volume: 0.12 });
      audioFiles.push({ file: path.join(sfxDir, 'riser.wav'), delay: Math.max(0, outroDelay - 0.8), duration: 1.1, volume: 0.13 });
      audioFiles.push({ file: path.join(sfxDir, 'bass_drop.wav'), delay: outroDelay, duration: 1.0, volume: 0.18 });
      audioFiles.push({ file: path.join(sfxDir, 'bell.wav'), delay: outroDelay + 0.1, duration: 1.0, volume: 0.2 });
    }
    audioFiles.push({
      file: path.resolve(outroAudio.audio_file),
      delay: cumulativeDelay,
      duration: outroAudio.audio_duration,
      volume: 1.0,
    });
  }

  const outputFile = path.join(videoOutputDir, `${videoId}.mp4`);

  if (audioFiles.length === 0) {
    // 无音频，直接复制
    await fs.copyFile(tempVideoPath, outputFile);
    logger.success(`无音频，直接输出: ${outputFile}`);
  } else {
    logger.info(`共 ${audioFiles.length} 个音频文件需要合并`);

    // 方法1: 一次性合并所有音频（filter_complex + adelay + amix）
    const mergeSuccess = await tryMergeAllAudio(tempVideoPath, audioFiles, outputFile, logger);

    if (!mergeSuccess) {
      // 方法2: concat 方式合并音频
      logger.info('尝试 concat 方式合并...');
      const concatSuccess = await tryConcatAudio(tempVideoPath, audioFiles, outputFile, logger);

      if (!concatSuccess) {
        // 方法3: 逐个添加音频
        logger.info('尝试逐个添加音频...');
        await addAudioOneByOne(tempVideoPath, audioFiles, outputFile, logger);
      }
    }
  }

  // 清理临时文件
  try {
    await fs.unlink(tempVideoPath);
  } catch {
    // 忽略清理失败
  }

  // Step 8: 输出摘要
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.section('渲染完成');
  logger.info(`输出文件: ${outputFile}`);

  // 验证最终输出
  try {
    const finalStats = await fs.stat(outputFile);
    logger.info(`文件大小: ${(finalStats.size / 1024 / 1024).toFixed(1)} MB`);
  } catch {
    logger.warn('无法获取输出文件大小');
  }

  logger.info(`总耗时: ${elapsed}s`);

  // 写入摘要
  const summaryPath = path.join(videoOutputDir, `${videoId}_summary.json`);
  await fs.writeFile(summaryPath, JSON.stringify({
    video_id: videoId,
    title: script.title,
    output_file: outputFile,
    total_time_seconds: parseFloat(elapsed),
    timestamp: new Date().toISOString(),
    scene_count: script.scenes.length,
    audio_count: audioFiles.length,
    template: script.template,
    fps,
    resolution: script.resolution,
  }, null, 2));

  logger.info(`摘要文件: ${summaryPath}`);

  await logger.saveSummary(path.join(videoOutputDir, `${videoId}_log.json`));

  return outputFile;
}

// 方法1: filter_complex 一次性合并（使用 apad 保持音轨数恒定，修复尾部音量暴涨）
async function tryMergeAllAudio(
  videoPath: string,
  audioFiles: { file: string; delay: number; duration: number; volume?: number }[],
  outputPath: string,
  logger: Logger
): Promise<boolean> {
  const inputArgs: string[] = ['-i', `"${videoPath}"`];
  const filterParts: string[] = [];

  // 计算总时长，用于 apad 填充所有音轨到统一长度
  // 这样 amix 的归一化因子恒定为 1/N，volume=N 补偿始终正确
  const totalDuration = Math.ceil(Math.max(...audioFiles.map(af => af.delay + af.duration)));

  audioFiles.forEach((af, i) => {
    inputArgs.push('-i', `"${af.file}"`);
    const delayMs = Math.round(af.delay * 1000);
    const vol = af.volume ?? 1.0;
    // adelay → volume → apad（填充到总时长，保持音轨始终活跃）
    filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},volume=${vol},apad=whole_dur=${totalDuration}[a${i + 1}]`);
  });

  const mixInputs = audioFiles.map((_, i) => `[a${i + 1}]`).join('');
  const n = audioFiles.length;
  // FFmpeg 4.3 不支持 normalize=0，用 apad + volume=N 补偿
  // apad 确保所有 N 个音轨始终活跃，amix 归一化因子恒定为 1/N
  // alimiter 防止多轨叠加时削波
  const filterComplex = `${filterParts.join(';')};${mixInputs}amix=inputs=${n}:duration=longest:dropout_transition=0[amixout];[amixout]volume=${n},alimiter=limit=0.95[aout]`;

  const ffmpegCmd = [
    `"${BIN.ffmpeg}"`, '-y',
    ...inputArgs,
    '-filter_complex', `"${filterComplex}"`,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    `"${outputPath}"`,
  ].join(' ');

  logger.info('执行 filter_complex 合并...');
  logger.debug(`ffmpeg 命令: ${ffmpegCmd.substring(0, 300)}...`);

  try {
    const { stderr } = await execAsync(ffmpegCmd, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000,
    });

    if (stderr) {
      const lines = stderr.split('\n').filter(l => l.trim());
      logger.debug(`ffmpeg: ${lines[lines.length - 1] || ''}`);
    }

    // 验证输出文件
    const stats = await fs.stat(outputPath);
    if (stats.size > 0) {
      logger.success(`音频合并完成: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn(`filter_complex 合并失败: ${err.message.substring(0, 200)}`);
    return false;
  }
}

// 方法2: concat 方式合并（先拼接音频再合并到视频）
async function tryConcatAudio(
  videoPath: string,
  audioFiles: { file: string; delay: number; duration: number; volume?: number }[],
  outputPath: string,
  logger: Logger
): Promise<boolean> {
  // concat 方式无法处理重叠音效，只使用 TTS 音频（跳过 SFX）
  const ttsFiles = audioFiles.filter(af => (af.volume ?? 1.0) >= 1.0);
  if (ttsFiles.length === 0) return false;

  const tempDir = path.dirname(videoPath);
  const concatListPath = path.join(tempDir, 'audio_concat.txt');

  // 生成静音音频片段来填充间隙
  const segments: string[] = [];
  let prevEnd = 0;

  for (const af of ttsFiles) {
    // 如果有间隙，用静音填充
    if (af.delay > prevEnd) {
      const silenceDuration = af.delay - prevEnd;
      const silenceFile = path.join(tempDir, `silence_${segments.length}.aac`);
      try {
        await execAsync(
          `"${BIN.ffmpeg}" -y -f lavfi -i anullsrc=channel_layout=mono:sample_rate=24000 -t ${silenceDuration} -c:a aac "${silenceFile}"`,
          { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
        );
        segments.push(silenceFile);
      } catch {
        // 忽略静音生成失败
      }
    }
    segments.push(af.file);
    prevEnd = af.delay + af.duration;
  }

  // 写入 concat 列表文件
  const concatContent = segments.map(f => `file '${f}'`).join('\n');
  await fs.writeFile(concatListPath, concatContent);

  const tempAudioPath = path.join(tempDir, 'merged_audio.aac');

  const concatCmd = [
    `"${BIN.ffmpeg}"`, '-y',
    '-f', 'concat', '-safe', '0',
    '-i', `"${concatListPath}"`,
    '-c:a', 'aac',
    '-b:a', '192k',
    `"${tempAudioPath}"`,
  ].join(' ');

  logger.info('执行 concat 音频合并...');
  logger.debug(`ffmpeg concat 命令: ${concatCmd.substring(0, 200)}...`);

  try {
    await execAsync(concatCmd, { maxBuffer: 50 * 1024 * 1024, timeout: 120000 });

    // 再合并视频和音频
    const mergeCmd = [
      `"${BIN.ffmpeg}"`, '-y',
      '-i', `"${videoPath}"`,
      '-i', `"${tempAudioPath}"`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      `"${outputPath}"`,
    ].join(' ');

    logger.info('合并视频和音频...');
    await execAsync(mergeCmd, { maxBuffer: 50 * 1024 * 1024, timeout: 120000 });

    const stats = await fs.stat(outputPath);
    if (stats.size > 0) {
      logger.success(`concat 合并完成: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      // 清理临时文件
      await fs.unlink(concatListPath).catch(() => {});
      await fs.unlink(tempAudioPath).catch(() => {});
      for (const seg of segments) {
        if (seg.includes('silence_')) {
          await fs.unlink(seg).catch(() => {});
        }
      }
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn(`concat 合并失败: ${err.message.substring(0, 200)}`);
    await fs.unlink(concatListPath).catch(() => {});
    return false;
  }
}

// 方法3: 逐个添加音频（备用方案）
async function addAudioOneByOne(
  videoPath: string,
  audioFiles: { file: string; delay: number; duration: number; volume?: number }[],
  outputPath: string,
  logger: Logger
): Promise<void> {
  // 逐个添加方式只使用 TTS 音频（跳过 SFX）
  const ttsFiles = audioFiles.filter(af => (af.volume ?? 1.0) >= 1.0);
  let currentVideo = videoPath;

  for (let i = 0; i < ttsFiles.length; i++) {
    const af = ttsFiles[i];
    const tempOutput = videoPath.replace('.mp4', `_step${i}.mp4`);
    const delayMs = Math.round(af.delay * 1000);

    const cmd = [
      `"${BIN.ffmpeg}"`, '-y',
      '-i', `"${currentVideo}"`,
      '-i', `"${af.file}"`,
      '-filter_complex', `"[1:a]adelay=${delayMs}|${delayMs}[a]"`,
      '-map', '0:v',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      `"${tempOutput}"`,
    ].join(' ');

    logger.info(`添加音频 ${i + 1}/${ttsFiles.length} (延迟 ${delayMs}ms)...`);

    try {
      await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024, timeout: 120000 });
      if (currentVideo !== videoPath) {
        await fs.unlink(currentVideo).catch(() => {});
      }
      currentVideo = tempOutput;
    } catch (err: any) {
      logger.error(`步骤 ${i + 1} 失败: ${err.message.substring(0, 200)}`);
      throw err;
    }
  }

  // 重命名最终文件
  await fs.copyFile(currentVideo, outputPath);
  if (currentVideo !== videoPath) {
    await fs.unlink(currentVideo).catch(() => {});
  }
  logger.success(`逐个添加音频完成: ${outputPath}`);
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  const scriptPath = args.find(a => !a.startsWith('--'));

  if (!scriptPath) {
    console.log('AI Auto Video - 本地渲染（绕过 Remotion v4 音频兼容问题）');
    console.log('');
    console.log('用法: npx tsx scripts/render-local.ts <script.json> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --output <dir>      输出目录 (默认: ./output/<video_id>)');
    console.log('  --skip-tts          跳过 TTS，使用已有音频');
    console.log('  --audio-dir <dir>   音频目录');
    console.log('  --concurrency <n>   渲染并发数 (默认: 2)');
    console.log('');
    console.log('环境变量:');
    console.log('  NODE_BIN            node 二进制路径 (默认: /usr/local/bin/node)');
    console.log('  FFMPEG_BIN          ffmpeg 二进制路径 (默认: /usr/local/bin/ffmpeg)');
    console.log('  PYTHON_BIN          python3 二进制路径 (默认: python3)');
    process.exit(0);
  }

  const skipTts = args.includes('--skip-tts');
  const outputIdx = args.indexOf('--output');
  const audioDirIdx = args.indexOf('--audio-dir');
  const concurrencyIdx = args.indexOf('--concurrency');

  renderLocal({
    scriptPath,
    skipTts,
    outputDir: outputIdx >= 0 ? args[outputIdx + 1] : undefined,
    audioDir: audioDirIdx >= 0 ? args[audioDirIdx + 1] : undefined,
    concurrency: concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1]) : undefined,
  }).then((outputPath) => {
    console.log(`\n✅ 视频已生成: ${outputPath}`);
  }).catch((err) => {
    console.error('\n❌ 渲染失败:', err.message);
    process.exit(1);
  });
}
