// generate-sfx.ts — 程序化生成音效 WAV 文件
// 生成: whoosh, boom, pop, ding, transition, ambient_drone
import * as fs from 'fs/promises';
import * as path from 'path';

const SAMPLE_RATE = 44100;
const SFX_DIR = path.join(process.cwd(), 'public', 'sfx');

function writeWav(filename: string, samples: Float32Array): Promise<void> {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return fs.writeFile(path.join(SFX_DIR, filename), buffer);
}

// Whoosh: 噪声 + 低通扫频
function generateWhoosh(duration: number = 0.4): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const noise = (Math.random() * 2 - 1);
    const cutoff = 1 - progress;
    const env = Math.sin(progress * Math.PI) * 0.7;
    const filter = Math.exp(-((1 - cutoff) * 5));
    out[i] = noise * env * filter * 0.5;
  }
  return out;
}

// Boom: 低频正弦 + 快速衰减
function generateBoom(duration: number = 0.6): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 80 * (1 - progress * 0.5);
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.exp(-progress * 4) * 0.8;
    const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 6) * 0.3;
    lastSample = lastSample * 0.95 + (Math.sin(phase) + noise) * 0.05;
    out[i] = lastSample * env;
  }
  return out;
}

// Pop: 短促噪声脉冲
function generatePop(duration: number = 0.08): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 800 * (1 - progress * 0.7);
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.exp(-progress * 12);
    const noise = (Math.random() * 2 - 1) * 0.3;
    out[i] = (Math.sin(phase) + noise) * env * 0.4;
  }
  return out;
}

// Ding: 高频正弦 + 长衰减
function generateDing(duration: number = 0.5): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq1 = 1200;
    const freq2 = 1800;
    const phase1 = (i / SAMPLE_RATE) * freq1 * 2 * Math.PI;
    const phase2 = (i / SAMPLE_RATE) * freq2 * 2 * Math.PI;
    const env = Math.exp(-progress * 5) * 0.5;
    out[i] = (Math.sin(phase1) * 0.7 + Math.sin(phase2) * 0.3) * env;
  }
  return out;
}

// Transition: 上升扫频
function generateTransition(duration: number = 0.3): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 200 + progress * 800;
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.sin(progress * Math.PI) * 0.4;
    out[i] = Math.sin(phase) * env;
  }
  return out;
}

// Ambient drone: 低频持续音
function generateAmbientDrone(duration: number = 3.0): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    const freq1 = 55;
    const freq2 = 82.5;
    const freq3 = 110;
    const lfo = Math.sin(t * 0.5) * 0.3 + 0.7;
    const env = Math.sin(progress * Math.PI) * 0.15;
    const s1 = Math.sin(t * freq1 * 2 * Math.PI) * 0.5;
    const s2 = Math.sin(t * freq2 * 2 * Math.PI) * 0.3;
    const s3 = Math.sin(t * freq3 * 2 * Math.PI) * 0.2;
    out[i] = (s1 + s2 + s3) * env * lfo;
  }
  return out;
}

// Blip: 短促电子音
function generateBlip(duration: number = 0.05): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 1000;
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.exp(-progress * 20);
    out[i] = Math.sin(phase) * env * 0.3;
  }
  return out;
}

// Tick: 极短脆响（用于数据点/字幕弹出）
function generateTick(duration: number = 0.03): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 2000;
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.exp(-progress * 30);
    const noise = (Math.random() * 2 - 1) * 0.2;
    out[i] = (Math.sin(phase) * 0.8 + noise) * env * 0.25;
  }
  return out;
}

// Riser: 上升扫频 + 混响尾音（用于场景过渡前的紧张感）
function generateRiser(duration: number = 0.8): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 150 + Math.pow(progress, 2) * 1200;
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.pow(progress, 1.5) * 0.35;
    const noise = (Math.random() * 2 - 1) * progress * 0.15;
    out[i] = (Math.sin(phase) + noise) * env;
  }
  // 添加混响尾音
  const tailLen = Math.floor(SAMPLE_RATE * 0.3);
  const tail = new Float32Array(tailLen);
  for (let i = 0; i < tailLen; i++) {
    const progress = i / tailLen;
    const noise = (Math.random() * 2 - 1);
    tail[i] = noise * Math.exp(-progress * 8) * 0.1;
  }
  const result = new Float32Array(n + tailLen);
  result.set(out);
  for (let i = 0; i < tailLen; i++) {
    result[n + i] = tail[i];
  }
  return result;
}

// Impact: 深沉撞击 + 金属共鸣（用于数据高潮/戏剧性时刻）
function generateImpact(duration: number = 0.7): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 低频冲击
    const lowFreq = 60;
    const lowPhase = t * lowFreq * 2 * Math.PI;
    const lowEnv = Math.exp(-progress * 5) * 0.6;
    // 金属共鸣
    const metal1 = Math.sin(t * 320 * 2 * Math.PI) * Math.exp(-progress * 3) * 0.15;
    const metal2 = Math.sin(t * 480 * 2 * Math.PI) * Math.exp(-progress * 4) * 0.1;
    // 初始噪声冲击
    const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 15) * 0.3;
    lastSample = lastSample * 0.9 + (Math.sin(lowPhase) + noise) * 0.1;
    out[i] = (lastSample * lowEnv + metal1 + metal2) * 0.7;
  }
  return out;
}

// Shimmer: 高频闪烁 + 慢衰减（用于点缀/CTA 高亮）
function generateShimmer(duration: number = 0.6): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    const freq1 = 2400;
    const freq2 = 3200;
    const freq3 = 4000;
    const lfo = Math.sin(t * 8) * 0.3 + 0.7;
    const env = Math.exp(-progress * 3) * 0.3;
    const s1 = Math.sin(t * freq1 * 2 * Math.PI) * 0.4;
    const s2 = Math.sin(t * freq2 * 2 * Math.PI) * 0.35;
    const s3 = Math.sin(t * freq3 * 2 * Math.PI) * 0.25;
    out[i] = (s1 + s2 + s3) * env * lfo;
  }
  return out;
}

// SwooshIn: 快速进场呼啸（比 whoosh 更短更急促，带高频成分）
function generateSwooshIn(duration: number = 0.25): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const noise = (Math.random() * 2 - 1);
    // 高通滤波（快速进场的高频感）
    lastSample = lastSample * 0.85 + (noise - lastSample) * 0.15;
    const env = Math.pow(Math.sin(progress * Math.PI), 0.5) * 0.6;
    const highFreq = Math.sin(progress * 3000 * 2 * Math.PI) * 0.15;
    out[i] = (lastSample * 1.5 + highFreq) * env * 0.4;
  }
  return out;
}

// BassDrop: 低音下潜（电子音乐风格的 sub-bass drop）
function generateBassDrop(duration: number = 1.0): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 频率从 200 快速下潜到 30
    const freq = 200 * Math.pow(0.3, progress * 3) + 30;
    const phase = t * freq * 2 * Math.PI;
    // 指数衰减包络
    const env = Math.exp(-progress * 2.5) * 0.7;
    // 初始瞬态
    const transient = (Math.random() * 2 - 1) * Math.exp(-progress * 25) * 0.3;
    lastSample = lastSample * 0.92 + Math.sin(phase) * 0.08;
    out[i] = (lastSample + transient) * env;
  }
  return out;
}

// CinematicHit: 电影感重击（比 boom 更厚重，带金属共鸣尾音）
function generateCinematicHit(duration: number = 1.2): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  let reverbBuf: number[] = [];
  const reverbLen = Math.floor(SAMPLE_RATE * 0.4);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 低频冲击（40Hz）
    const lowFreq = 40;
    const lowPhase = t * lowFreq * 2 * Math.PI;
    const lowEnv = Math.exp(-progress * 3) * 0.7;
    // 中频厚度（120Hz）
    const midFreq = 120;
    const midPhase = t * midFreq * 2 * Math.PI;
    const midEnv = Math.exp(-progress * 4) * 0.3;
    // 金属泛音
    const metal1 = Math.sin(t * 520 * 2 * Math.PI) * Math.exp(-progress * 2) * 0.12;
    const metal2 = Math.sin(t * 780 * 2 * Math.PI) * Math.exp(-progress * 2.5) * 0.08;
    const metal3 = Math.sin(t * 1100 * 2 * Math.PI) * Math.exp(-progress * 3) * 0.05;
    // 初始噪声冲击
    const noise = (Math.random() * 2 - 1) * Math.exp(-progress * 12) * 0.25;
    // 低通滤波
    const input = Math.sin(lowPhase) * lowEnv + Math.sin(midPhase) * midEnv + metal1 + metal2 + metal3 + noise;
    lastSample = lastSample * 0.88 + input * 0.12;
    // 简单混响（延迟反馈）
    reverbBuf.push(lastSample * 0.3);
    if (reverbBuf.length > reverbLen) {
      const delayed = reverbBuf.shift()!;
      out[i] = lastSample * 0.9 + delayed * 0.1;
    } else {
      out[i] = lastSample * 0.9;
    }
  }
  return out;
}

// Glitch: 电子故障/数字抖动（现代科技风格转场）
function generateGlitch(duration: number = 0.3): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 随机频率跳变
    const segIdx = Math.floor(progress * 8);
    const segFreq = 200 + (segIdx * 37 + 100) % 1500;
    const phase = t * segFreq * 2 * Math.PI;
    // 方波（数字感）
    const square = Math.sin(phase) > 0 ? 1 : -1;
    // 包络（随机断续）
    const burstEnv = (Math.sin(t * 40 + segIdx) > 0.3) ? 0.4 : 0;
    const env = Math.exp(-progress * 5) * burstEnv;
    // 噪声成分
    const noise = (Math.random() * 2 - 1) * 0.3;
    out[i] = (square * 0.5 + noise) * env * 0.3;
  }
  return out;
}

// SweepDown: 下降扫频（从高频到低频的转场）
function generateSweepDown(duration: number = 0.4): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const freq = 3000 * Math.pow(0.1, progress) + 100;
    const phase = (i / SAMPLE_RATE) * freq * 2 * Math.PI;
    const env = Math.sin(progress * Math.PI) * 0.4;
    const noise = (Math.random() * 2 - 1) * progress * 0.1;
    out[i] = (Math.sin(phase) + noise) * env;
  }
  return out;
}

// Bell: 清脆铃声（比 ding 更悠长，带泛音）
function generateBell(duration: number = 1.0): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 基频 + 泛音（钟铃特征）
    const f1 = 880;  // A5
    const f2 = 1320; // E6（五度泛音）
    const f3 = 1760; // A6（八度泛音）
    const f4 = 2640; // E7（高泛音）
    const env = Math.exp(-progress * 2.5) * 0.5;
    const s1 = Math.sin(t * f1 * 2 * Math.PI) * 0.4;
    const s2 = Math.sin(t * f2 * 2 * Math.PI) * 0.25;
    const s3 = Math.sin(t * f3 * 2 * Math.PI) * 0.2;
    const s4 = Math.sin(t * f4 * 2 * Math.PI) * 0.1;
    // 初始敲击瞬态
    const transient = (Math.random() * 2 - 1) * Math.exp(-progress * 30) * 0.15;
    out[i] = (s1 + s2 + s3 + s4 + transient) * env;
  }
  return out;
}

// CameraShutter: 相机快门声（用于图片/场景出现）
function generateCameraShutter(duration: number = 0.15): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 两次机械点击（快门开+关）
    const click1 = (Math.random() * 2 - 1) * Math.exp(-progress * 60) * 0.5;
    const click2Start = Math.floor(n * 0.45);
    const click2Progress = (i - click2Start) / (n - click2Start);
    const click2 = i > click2Start
      ? (Math.random() * 2 - 1) * Math.exp(-click2Progress * 60) * 0.5
      : 0;
    // 金属薄片感
    const metal = Math.sin(t * 4000 * 2 * Math.PI) * Math.exp(-progress * 20) * 0.1;
    out[i] = (click1 + click2 + metal) * 0.35;
  }
  return out;
}

// Heartbeat: 心跳声（用于紧张/戏剧性场景）
function generateHeartbeat(duration: number = 0.8): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  let lastSample = 0;
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const t = i / SAMPLE_RATE;
    // 两次心跳（lub-dub）
    const beat1 = Math.exp(-Math.pow((t - 0.1) * 8, 2)) * 0.6;
    const beat2 = Math.exp(-Math.pow((t - 0.25) * 10, 2)) * 0.4;
    // 低频振动
    const freq = 50;
    const phase = t * freq * 2 * Math.PI;
    lastSample = lastSample * 0.85 + Math.sin(phase) * 0.15;
    out[i] = lastSample * (beat1 + beat2) * 0.5;
  }
  return out;
}

export async function generateAllSfx(): Promise<void> {
  await fs.mkdir(SFX_DIR, { recursive: true });

  const sfxFiles: { name: string; data: Float32Array }[] = [
    { name: 'whoosh.wav', data: generateWhoosh() },
    { name: 'boom.wav', data: generateBoom() },
    { name: 'pop.wav', data: generatePop() },
    { name: 'ding.wav', data: generateDing() },
    { name: 'transition.wav', data: generateTransition() },
    { name: 'ambient.wav', data: generateAmbientDrone() },
    { name: 'blip.wav', data: generateBlip() },
    { name: 'tick.wav', data: generateTick() },
    { name: 'riser.wav', data: generateRiser() },
    { name: 'impact.wav', data: generateImpact() },
    { name: 'shimmer.wav', data: generateShimmer() },
    { name: 'swoosh_in.wav', data: generateSwooshIn() },
    { name: 'bass_drop.wav', data: generateBassDrop() },
    { name: 'cinematic_hit.wav', data: generateCinematicHit() },
    { name: 'glitch.wav', data: generateGlitch() },
    { name: 'sweep_down.wav', data: generateSweepDown() },
    { name: 'bell.wav', data: generateBell() },
    { name: 'camera_shutter.wav', data: generateCameraShutter() },
    { name: 'heartbeat.wav', data: generateHeartbeat() },
  ];

  for (const sfx of sfxFiles) {
    await writeWav(sfx.name, sfx.data);
    console.log(`  ✓ ${sfx.name} (${(sfx.data.length / SAMPLE_RATE).toFixed(2)}s)`);
  }

  console.log(`\n音效文件已生成到: ${SFX_DIR}`);
}

// CLI
if (require.main === module) {
  generateAllSfx().catch(console.error);
}

export { generateWhoosh, generateBoom, generatePop, generateDing, generateTransition, generateAmbientDrone, generateBlip, generateTick, generateRiser, generateImpact, generateShimmer, generateSwooshIn, generateBassDrop, generateCinematicHit, generateGlitch, generateSweepDown, generateBell, generateCameraShutter, generateHeartbeat, SAMPLE_RATE };
