// AnimatedBackground.tsx — 高级动态背景组件 v2.0
// 融合 GitHub 高 star 项目技术：Perlin noise 流场、Bokeh 光圈、SVG 液态波、
// 矩阵雨、渐变 LERP、几何递归、深度星空、极光漂移、粒子网络
import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, random, spring, Easing } from 'remotion';
import { noise2D, noise3D } from '@remotion/noise';

type BgType = 'cosmic' | 'storm' | 'ocean' | 'particles' | 'grid_pulse' | 'nebula' | 'bokeh' | 'matrix' | 'aurora' | 'geometric' | 'flowfield' | 'auto';

interface AnimatedBackgroundProps {
  type?: BgType;
  bgColor: string;
  accentColor: string;
  primaryColor: string;
  seed?: number;
}

// 根据场景视觉类型自动选择背景（含随机性）
export function pickBgType(visualType: string, sceneId: number): BgType {
  const allTypes: BgType[] = ['cosmic', 'storm', 'ocean', 'particles', 'nebula', 'bokeh', 'matrix', 'aurora', 'geometric', 'flowfield'];
  // 用 sceneId 作为随机种子选择，确保每场景不同
  const seedVal = random(`bg-pick-${sceneId}`);
  if (visualType === 'chart') return 'grid_pulse';
  if (visualType === 'cta_card') return 'cosmic';
  if (visualType === 'animation') return allTypes[Math.floor(seedVal * 3) + 1]; // storm/ocean/particles
  return allTypes[Math.floor(seedVal * allTypes.length)];
}

// 颜色 LERP 插值
function lerpColor(c1: string, c2: string, t: number): string {
  const parse = (c: string) => {
    const hex = c.replace('#', '');
    return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
}

// hex 转 rgba
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  type = 'auto',
  bgColor,
  accentColor,
  primaryColor,
  seed = 42,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const slowT = t * 0.15;

  // ===== 预生成粒子/星星数据（确定性随机） =====
  const stars = useMemo(() => Array.from({ length: 150 }, (_, i) => ({
    x: random(`${seed}-sx-${i}`) * 100,
    y: random(`${seed}-sy-${i}`) * 100,
    size: random(`${seed}-ss-${i}`) * 2.5 + 0.5,
    speed: random(`${seed}-sp-${i}`) * 0.4 + 0.1,
    twinkle: random(`${seed}-st-${i}`) * 360,
    depth: random(`${seed}-sd-${i}`), // 0=远 1=近
    color: i % 4 === 0 ? accentColor : i % 7 === 0 ? primaryColor : '#ffffff',
  })), [seed]);

  const particles = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    x: random(`${seed}-px-${i}`) * 100,
    y: random(`${seed}-py-${i}`) * 100,
    size: random(`${seed}-ps-${i}`) * 4 + 1,
    vx: (random(`${seed}-pvx-${i}`) - 0.5) * 0.2,
    vy: (random(`${seed}-pvy-${i}`) - 0.5) * 0.2,
    opacity: random(`${seed}-po-${i}`) * 0.6 + 0.2,
    depth: random(`${seed}-pd-${i}`),
  })), [seed]);

  const bokeh = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    x: random(`${seed}-bx-${i}`) * 100,
    y: random(`${seed}-by-${i}`) * 100,
    size: random(`${seed}-bs-${i}`) * 120 + 40,
    driftX: random(`${seed}-bdx-${i}`) * 40 + 10,
    driftY: random(`${seed}-bdy-${i}`) * 30 + 8,
    pulseSpeed: random(`${seed}-bps-${i}`) * 0.5 + 0.2,
    pulsePhase: random(`${seed}-bpp-${i}`) * Math.PI * 2,
    opacity: random(`${seed}-bo-${i}`) * 0.15 + 0.05,
    colorIdx: i % 3,
  })), [seed]);

  const matrixCols = useMemo(() => Array.from({ length: Math.floor(width / 22) }, (_, i) => ({
    x: i * 22,
    startY: random(`${seed}-mx-${i}`) * height,
    speed: random(`${seed}-ms-${i}`) * 4 + 3,
    charIdx: Math.floor(random(`${seed}-mc-${i}`) * 36),
  })), [seed, height, width]);

  const nebulaClouds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    x: random(`${seed}-nx-${i}`) * 100,
    y: random(`${seed}-ny-${i}`) * 100,
    size: random(`${seed}-ns-${i}`) * 400 + 250,
    drift: random(`${seed}-nd-${i}`) * 0.06 + 0.02,
    pulsePhase: random(`${seed}-npp-${i}`) * Math.PI * 2,
    colorIdx: i % 3,
  })), [seed]);

  const geoLayers = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
    delay: i * 2,
    rotSpeed: random(`${seed}-gr-${i}`) * 0.8 + 0.2,
    borderRadius: random(`${seed}-gbr-${i}`) * 40 + 5,
    scale: random(`${seed}-gsc-${i}`) * 0.3 + 0.8,
  })), [seed]);

  const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*∞∆∇◇◆○●';

  // ============================================================
  // 1. 宇宙星空（升级版：深度分层 + 旋转 + 流星 + 星云）
  // ============================================================
  if (type === 'cosmic') {
    const rotation = slowT * 5;
    const warpSpeed = interpolate(t, [0, 3, 6, 10], [0, 0.5, 1, 0.8]);
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 旋转星空层（远） */}
        <AbsoluteFill style={{ transform: `rotate(${rotation * 0.3}deg)`, transformOrigin: 'center' }}>
          {stars.filter(s => s.depth < 0.4).map((s, i) => {
            const twinkle = Math.sin((t * s.twinkle + i * 30) * Math.PI / 180);
            const opacity = 0.2 + twinkle * 0.4;
            const yPos = (s.y + t * s.speed * 5) % 100;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${s.x}%`, top: `${yPos}%`,
                width: s.size, height: s.size, borderRadius: '50%',
                backgroundColor: s.color, opacity,
                boxShadow: `0 0 ${s.size * 4}px ${s.color}`,
              }} />
            );
          })}
        </AbsoluteFill>
        {/* 旋转星空层（近） */}
        <AbsoluteFill style={{ transform: `rotate(${-rotation * 0.6}deg)`, transformOrigin: 'center' }}>
          {stars.filter(s => s.depth >= 0.4).map((s, i) => {
            const twinkle = Math.sin((t * s.twinkle + i * 50) * Math.PI / 180);
            const opacity = 0.3 + twinkle * 0.6;
            const yPos = (s.y + t * s.speed * 15) % 100;
            const scaleVal = 1 + warpSpeed * s.depth * 2;
            return (
              <div key={i} style={{
                position: 'absolute', left: `${s.x}%`, top: `${yPos}%`,
                width: s.size * scaleVal, height: s.size * scaleVal * (1 + warpSpeed * 3),
                borderRadius: '50%', backgroundColor: s.color, opacity,
                boxShadow: `0 0 ${s.size * 6}px ${s.color}`,
              }} />
            );
          })}
        </AbsoluteFill>
        {/* 星云层 */}
        {nebulaClouds.map((c, i) => {
          const colors = [accentColor, primaryColor, accentColor];
          const driftX = (c.x + slowT * c.drift * 100) % 120 - 10;
          const driftY = c.y + Math.sin(slowT + c.pulsePhase) * 8;
          const pulseScale = 1 + Math.sin(slowT * 2 + c.pulsePhase) * 0.15;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${driftX}%`, top: `${driftY}%`,
              width: c.size, height: c.size, borderRadius: '50%',
              background: `radial-gradient(circle, ${hexToRgba(colors[c.colorIdx], 0.12)} 0%, ${hexToRgba(colors[c.colorIdx], 0.04)} 30%, transparent 70%)`,
              transform: `translate(-50%, -50%) scale(${pulseScale})`,
              filter: 'blur(30px)',
            }} />
          );
        })}
        {/* 中心光晕 */}
        <AbsoluteFill style={{
          background: `radial-gradient(circle at 50% 40%, ${hexToRgba(accentColor, 0.08)} 0%, ${hexToRgba(primaryColor, 0.04)} 30%, transparent 70%)`,
        }} />
        {/* 流星 */}
        {[0, 1, 2, 3].map(i => {
          const cycle = (t + i * 3.5) % 10;
          if (cycle > 3) return null;
          const meteorX = interpolate(cycle, [0, 3], [110, 20]);
          const meteorY = interpolate(cycle, [0, 3], [5 + i * 15, 50 + i * 10]);
          const trailLen = 120 + warpSpeed * 80;
          return (
            <div key={`m-${i}`} style={{
              position: 'absolute', left: `${meteorX}%`, top: `${meteorY}%`,
              width: trailLen, height: 2,
              background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.7)}, #ffffff)`,
              opacity: interpolate(cycle, [0, 0.5, 2.5, 3], [0, 0.9, 0.6, 0]),
              transform: 'rotate(-25deg)', filter: 'blur(0.5px)',
            }} />
          );
        })}
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 2. 风暴（升级版：多层云 + 闪电 + 数据雨 + 能量积累）
  // ============================================================
  if (type === 'storm') {
    const cloudOffset = (t * 25) % 200;
    const lightningCycle = (t * 0.4 + seed * 0.3) % 6;
    const flash = lightningCycle < 0.2 ? interpolate(lightningCycle, [0, 0.08, 0.2], [0, 0.5, 0]) : 0;
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 多层移动云 */}
        {[0, 1, 2, 3].map(layer => (
          <AbsoluteFill key={layer} style={{
            backgroundImage: `radial-gradient(ellipse at ${15 + layer * 25 + cloudOffset * (layer + 1) * 0.2}% ${25 + layer * 18}%, ${hexToRgba(primaryColor, layer === 0 ? 0.15 : 0.08)} 0%, transparent 50%)`,
            opacity: 0.6 - layer * 0.12,
          }} />
        ))}
        {/* 闪电 */}
        {flash > 0 && (
          <>
            <AbsoluteFill style={{ backgroundColor: accentColor, opacity: flash * 0.25 }} />
            <svg style={{ position: 'absolute', top: 0, left: '30%', width: 200, height: 400, opacity: flash }}>
              <path d="M100,0 L80,100 L120,120 L60,250 L100,280 L70,400"
                stroke={accentColor} strokeWidth={3} fill="none"
                style={{ filter: `drop-shadow(0 0 10px ${accentColor})` }} />
            </svg>
          </>
        )}
        {/* 数据雨 */}
        {particles.slice(0, 40).map((p, i) => {
          const dropY = (p.y + t * 50 * (0.4 + p.size / 4)) % 100;
          const dropLen = p.size * 12;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${p.x}%`, top: `${dropY}%`,
              width: 1.5, height: dropLen,
              background: `linear-gradient(180deg, transparent, ${hexToRgba(primaryColor, 0.4)})`,
            }} />
          );
        })}
        {/* 底部能量 */}
        <AbsoluteFill style={{ background: `linear-gradient(0deg, ${hexToRgba(accentColor, 0.12)} 0%, transparent 35%)` }} />
        {/* 风暴漩涡 */}
        <AbsoluteFill style={{
          background: `conic-gradient(from ${slowT * 60}deg at 50% 60%, transparent 0%, ${hexToRgba(accentColor, 0.06)} 25%, transparent 50%, ${hexToRgba(primaryColor, 0.05)} 75%, transparent 100%)`,
        }} />
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 3. 海洋（升级版：多层 SVG 波浪 + 光斑 + 深度渐变）
  // ============================================================
  if (type === 'ocean') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 深海渐变 */}
        <AbsoluteFill style={{
          background: `linear-gradient(180deg, ${bgColor} 0%, ${hexToRgba(primaryColor, 0.06)} 40%, ${hexToRgba(primaryColor, 0.15)} 100%)`,
        }} />
        {/* 多层波浪 */}
        {[0, 1, 2, 3].map(layer => {
          const waveOffset = Math.sin(t * 0.3 + layer * 1.2) * 4;
          const waveY = 35 + layer * 14 + waveOffset;
          const colors = [accentColor, primaryColor, accentColor, primaryColor];
          return (
            <svg key={layer} style={{ position: 'absolute', bottom: 0, width: '100%', height: '65%', opacity: 0.35 - layer * 0.07 }}>
              <defs>
                <linearGradient id={`og-${layer}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={colors[layer]} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={colors[layer]} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <path
                d={`M0,${100 - waveY} ${Array.from({ length: 50 }, (_, i) => {
                  const x = (i / 49) * 100;
                  const y = 100 - waveY + Math.sin(t * 0.5 + i * 0.3 + layer * 1.5) * (4 - layer * 0.5);
                  return `L${x},${y}`;
                }).join(' ')} L100,100 L0,100 Z`}
                fill={`url(#og-${layer})`}
              />
            </svg>
          );
        })}
        {/* 水面光斑 */}
        {stars.slice(0, 30).map((s, i) => {
          const shimmer = Math.sin(t * 2.5 + i * 0.7) * 0.5 + 0.5;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${s.x}%`, top: `${55 + s.y * 0.35}%`,
              width: s.size * 5, height: s.size * 1.5, borderRadius: '50%',
              backgroundColor: accentColor, opacity: shimmer * 0.25, filter: 'blur(3px)',
            }} />
          );
        })}
        {/* 气泡上升 */}
        {particles.slice(0, 15).map((p, i) => {
          const bubbleY = (100 - (t * (8 + p.size * 2) + p.y * 100 / (i + 1)) % 100);
          return (
            <div key={i} style={{
              position: 'absolute', left: `${p.x}%`, top: `${bubbleY}%`,
              width: p.size * 3, height: p.size * 3, borderRadius: '50%',
              border: `1px solid ${hexToRgba(accentColor, 0.3)}`,
              opacity: p.opacity * 0.5,
            }} />
          );
        })}
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 4. 粒子网络（升级版：noise 驱动 + 连接线 + 深度分层）
  // ============================================================
  if (type === 'particles') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 粒子 */}
        {particles.map((p, i) => {
          const noiseX = noise3D(`px-${seed}-${i}`, p.x / 10, p.y / 10, t * 0.1);
          const noiseY = noise3D(`py-${seed}-${i}`, p.x / 10, p.y / 10, t * 0.1);
          const px = (p.x + (p.vx + noiseX * 0.3) * t * 30) % 100;
          const py = (p.y + (p.vy + noiseY * 0.3) * t * 30) % 100;
          const pulseSize = p.size * (1 + Math.sin(t * 2 + i) * 0.3);
          return (
            <div key={i} style={{
              position: 'absolute', left: `${px}%`, top: `${py}%`,
              width: pulseSize, height: pulseSize, borderRadius: '50%',
              backgroundColor: i % 5 === 0 ? accentColor : i % 3 === 0 ? primaryColor : '#ffffff',
              opacity: p.opacity * (0.5 + p.depth * 0.5),
              boxShadow: `0 0 ${pulseSize * 5}px currentColor`,
            }} />
          );
        })}
        {/* 连接线 */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.12 }}>
          {particles.slice(0, 25).map((p1, i) => {
            const p2 = particles[(i + 1) % 25];
            const noiseX1 = noise3D(`px-${seed}-${i}`, p1.x / 10, p1.y / 10, t * 0.1);
            const noiseY1 = noise3D(`py-${seed}-${i}`, p1.x / 10, p1.y / 10, t * 0.1);
            const noiseX2 = noise3D(`px-${seed}-${i+1}`, p2.x / 10, p2.y / 10, t * 0.1);
            const noiseY2 = noise3D(`py-${seed}-${i+1}`, p2.x / 10, p2.y / 10, t * 0.1);
            const x1 = (p1.x + (p1.vx + noiseX1 * 0.3) * t * 30) % 100;
            const y1 = (p1.y + (p1.vy + noiseY1 * 0.3) * t * 30) % 100;
            const x2 = (p2.x + (p2.vx + noiseX2 * 0.3) * t * 30) % 100;
            const y2 = (p2.y + (p2.vy + noiseY2 * 0.3) * t * 30) % 100;
            const dist = Math.hypot(x2 - x1, y2 - y1);
            if (dist > 22) return null;
            return <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke={accentColor} strokeWidth={1} opacity={1 - dist / 22} />;
          })}
        </svg>
        {/* 中心辉光 */}
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${hexToRgba(primaryColor, 0.08)} 0%, transparent 60%)` }} />
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 5. 网格脉冲（升级版：脉冲 + 扫描线 + 数据点 + 辉光角落）
  // ============================================================
  if (type === 'grid_pulse') {
    const pulseT = (t * 0.4) % 2.5;
    const pulseScale = 1 + Math.sin(pulseT * Math.PI / 1.25) * 0.06;
    const gridShift = (t * 12) % 40;
    const scanY = (gridShift / 40) * 100;
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 脉冲网格 */}
        <AbsoluteFill style={{
          backgroundImage: `linear-gradient(${hexToRgba(primaryColor, 0.12)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(primaryColor, 0.12)} 1px, transparent 1px)`,
          backgroundSize: '40px 40px', transform: `scale(${pulseScale})`,
          opacity: interpolate(pulseT, [0, 1, 2.5], [0.12, 0.28, 0.12]),
        }} />
        {/* 扫描线 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: `${scanY}%`, height: 3,
          background: `linear-gradient(90deg, transparent, ${hexToRgba(accentColor, 0.6)}, transparent)`,
          boxShadow: `0 0 20px ${hexToRgba(accentColor, 0.3)}`,
        }} />
        {/* 数据点闪烁 */}
        {particles.slice(0, 12).map((p, i) => {
          const flashCycle = (t * 0.5 + i * 0.3) % 2;
          const flashOpacity = flashCycle < 0.3 ? interpolate(flashCycle, [0, 0.15, 0.3], [0, 0.8, 0]) : 0;
          if (flashOpacity < 0.01) return null;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: i % 2 === 0 ? accentColor : primaryColor,
              opacity: flashOpacity, boxShadow: `0 0 15px currentColor`,
            }} />
          );
        })}
        {/* 角落辉光 */}
        {[{x:8,y:12}, {x:92,y:88}, {x:88,y:15}, {x:12,y:85}].map((g, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${g.x}%`, top: `${g.y}%`,
            width: 250, height: 250, borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba(i % 2 ? primaryColor : accentColor, 0.1)} 0%, transparent 70%)`,
            transform: `translate(-50%, -50%) scale(${1 + Math.sin(t * 0.4 + i) * 0.15})`,
          }} />
        ))}
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 6. 星云（升级版：noise 漂移 + 多层云 + 星点 + 引力扭曲）
  // ============================================================
  if (type === 'nebula') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {nebulaClouds.map((c, i) => {
          const noiseDriftX = noise3D(`nx-${seed}-${i}`, c.x / 10, c.y / 10, t * 0.05);
          const noiseDriftY = noise3D(`ny-${seed}-${i}`, c.x / 10, c.y / 10, t * 0.05);
          const driftX = (c.x + (slowT * c.drift + noiseDriftX * 0.5) * 100) % 120 - 10;
          const driftY = c.y + Math.sin(slowT + c.pulsePhase) * 8 + noiseDriftY * 5;
          const colors = [accentColor, primaryColor, accentColor];
          const pulseScale = 1 + Math.sin(slowT * 2 + c.pulsePhase) * 0.15;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${driftX}%`, top: `${driftY}%`,
              width: c.size, height: c.size, borderRadius: '50%',
              background: `radial-gradient(circle, ${hexToRgba(colors[c.colorIdx], 0.12)} 0%, ${hexToRgba(colors[c.colorIdx], 0.04)} 30%, transparent 70%)`,
              transform: `translate(-50%, -50%) scale(${pulseScale})`, filter: 'blur(25px)',
            }} />
          );
        })}
        {/* 星点 */}
        {stars.slice(0, 60).map((s, i) => {
          const noiseX = noise3D(`nsx-${seed}-${i}`, s.x / 20, s.y / 20, t * 0.03);
          const noiseY = noise3D(`nsy-${seed}-${i}`, s.x / 20, s.y / 20, t * 0.03);
          return (
            <div key={i} style={{
              position: 'absolute', left: `${s.x + noiseX * 3}%`, top: `${s.y + noiseY * 3}%`,
              width: s.size, height: s.size, borderRadius: '50%', backgroundColor: '#ffffff',
              opacity: 0.25 + Math.sin(t + i * 0.5) * 0.2,
              boxShadow: `0 0 ${s.size * 2}px #fff`,
            }} />
          );
        })}
        {/* 引力中心 */}
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${hexToRgba(accentColor, 0.08)} 0%, ${hexToRgba(primaryColor, 0.03)} 30%, transparent 50%)` }} />
        {/* 引力扭曲环 */}
        {[0, 1, 2].map(i => {
          const ringScale = 0.5 + ((t * 0.1 + i * 0.33) % 1) * 1.5;
          const ringOpacity = interpolate((t * 0.1 + i * 0.33) % 1, [0, 0.2, 0.8, 1], [0, 0.3, 0.15, 0]);
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 300, height: 300, borderRadius: '50%',
              border: `2px solid ${hexToRgba(accentColor, ringOpacity)}`,
              transform: `translate(-50%, -50%) scale(${ringScale})`,
            }} />
          );
        })}
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 7. Bokeh 光圈（新增：漂浮光球 + 径向渐变 + 脉动）
  // ============================================================
  if (type === 'bokeh') {
    const colors = [primaryColor, accentColor, primaryColor];
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 渐变底色 */}
        <AbsoluteFill style={{
          background: `linear-gradient(${135 + slowT * 20}deg, ${hexToRgba(primaryColor, 0.08)} 0%, ${hexToRgba(accentColor, 0.05)} 50%, ${bgColor} 100%)`,
        }} />
        {/* Bokeh 光圈 */}
        {bokeh.map((b, i) => {
          const driftX = b.x + Math.sin(t * b.pulseSpeed + b.driftX) * 3;
          const driftY = (b.y + t * b.pulseSpeed * 2) % 100;
          const pulse = Math.sin(t * b.pulseSpeed * 2 + b.pulsePhase) * 0.2 + 1;
          const size = b.size * pulse;
          const rgb = colors[b.colorIdx];
          return (
            <div key={i} style={{
              position: 'absolute', left: `${driftX}%`, top: `${driftY}%`,
              width: size, height: size, borderRadius: '50%',
              background: `radial-gradient(circle, ${hexToRgba(rgb, b.opacity + 0.05)} 0%, ${hexToRgba(rgb, 0)} 70%)`,
              transform: 'translate(-50%, -50%)',
              filter: 'blur(8px)',
            }} />
          );
        })}
        {/* 细微星点 */}
        {stars.slice(0, 30).map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: '50%',
            backgroundColor: '#ffffff', opacity: 0.2 + Math.sin(t * 1.5 + i) * 0.15,
          }} />
        ))}
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 8. 矩阵数据雨（新增：字符瀑布 + 发光 + 渐隐）
  // ============================================================
  if (type === 'matrix') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 渐变底色 */}
        <AbsoluteFill style={{ background: `linear-gradient(180deg, ${hexToRgba(primaryColor, 0.05)} 0%, ${bgColor} 50%, ${hexToRgba(accentColor, 0.03)} 100%)` }} />
        {matrixCols.map((col, i) => {
          const y = (col.startY + frame * col.speed) % (height + 200) - 100;
          const charsShown = 15;
          return (
            <div key={i} style={{ position: 'absolute', left: col.x, top: y, display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: charsShown }).map((_, ci) => {
                const charIdx = (col.charIdx + Math.floor((frame + i * 7) / 6) + ci) % matrixChars.length;
                const fadeOpacity = interpolate(ci, [0, 3, charsShown - 1], [0.9, 0.5, 0]);
                const isHead = ci === 0;
                return (
                  <span key={ci} style={{
                    color: isHead ? '#ffffff' : hexToRgba(primaryColor, fadeOpacity),
                    fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold',
                    textShadow: `0 0 8px ${hexToRgba(primaryColor, isHead ? 0.9 : 0.5)}`,
                    lineHeight: 1.2,
                  }}>
                    {matrixChars[charIdx]}
                  </span>
                );
              })}
            </div>
          );
        })}
        {/* 底部渐隐 */}
        <AbsoluteFill style={{ background: `linear-gradient(0deg, ${bgColor} 0%, transparent 30%)` }} />
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 9. 极光（新增：noise 漂移极光带 + 星空底色 + 呼吸光）
  // ============================================================
  if (type === 'aurora') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 底层星空 */}
        {stars.slice(0, 40).map((s, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: '50%', backgroundColor: '#ffffff',
            opacity: 0.15 + Math.sin(t + i) * 0.1,
          }} />
        ))}
        {/* 极光带 1 */}
        {[0, 1, 2].map(layer => {
          const colors = [accentColor, primaryColor, accentColor];
          const auroraY = 20 + layer * 12;
          const points = Array.from({ length: 30 }, (_, i) => {
            const x = (i / 29) * 100;
            const noiseVal = noise3D(`aur-${seed}-${layer}`, x * 3, layer, t * 0.08);
            const y = auroraY + Math.sin(t * 0.2 + i * 0.4 + layer * 1.5) * 5 + noiseVal * 12;
            return `${x},${y}`;
          });
          return (
            <svg key={layer} style={{ position: 'absolute', top: 0, width: '100%', height: '100%', opacity: 0.4 - layer * 0.1 }}>
              <defs>
                <linearGradient id={`ag-${layer}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={colors[layer]} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={colors[layer]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={`M0,0 ${points.join(' L')} L100,0 Z`} fill={`url(#ag-${layer})`} style={{ filter: 'blur(15px)' }} />
            </svg>
          );
        })}
        {/* 呼吸光晕 */}
        <AbsoluteFill style={{
          background: `radial-gradient(ellipse at 50% 30%, ${hexToRgba(accentColor, 0.06 + Math.sin(t * 0.3) * 0.03)} 0%, transparent 60%)`,
        }} />
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 10. 几何递归（新增：spring 旋转 + 多层递归 + 缩放脉动）
  // ============================================================
  if (type === 'geometric') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 渐变底色 */}
        <AbsoluteFill style={{
          background: `linear-gradient(${45 + slowT * 15}deg, ${hexToRgba(primaryColor, 0.06)} 0%, ${hexToRgba(accentColor, 0.04)} 50%, ${bgColor} 100%)`,
        }} />
        {/* 递归几何层 */}
        {geoLayers.map((layer, i) => {
          const rotation = spring({
            frame: Math.max(0, frame - layer.delay), fps,
            from: 0, to: 360 * (layer.rotSpeed > 0.5 ? 1 : -1),
            config: { damping: 100, stiffness: 60, mass: 1.5 },
          });
          const scaleVal = spring({
            frame: Math.max(0, frame - layer.delay), fps,
            from: 0.3, to: layer.scale,
            config: { damping: 100, stiffness: 80 },
          });
          const breathScale = 1 + Math.sin(t * 0.5 + i * 0.3) * 0.05;
          return (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: '50%',
              width: '80%', height: '80%',
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scaleVal * breathScale})`,
              border: `1.5px solid ${hexToRgba(i % 2 ? accentColor : primaryColor, 0.08)}`,
              borderRadius: `${layer.borderRadius}%`,
            }} />
          );
        })}
        {/* 中心光点 */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          width: 30, height: 30, borderRadius: '50%',
          backgroundColor: accentColor,
          opacity: 0.4 + Math.sin(t * 2) * 0.2,
          boxShadow: `0 0 40px ${accentColor}`,
          transform: 'translate(-50%, -50%)',
        }} />
      </AbsoluteFill>
    );
  }

  // ============================================================
  // 11. Noise 流场（新增：粒子沿 noise 场流动 + 尾迹）
  // ============================================================
  if (type === 'flowfield') {
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
        {/* 流场粒子 */}
        {particles.slice(0, 60).map((p, i) => {
          const noiseVal = noise3D(`ff-${seed}-${i}`, p.x / 8, p.y / 8, t * 0.12);
          const angle = noiseVal * Math.PI * 4;
          const speed = 0.3 + Math.abs(noiseVal) * 0.5;
          const px = (p.x + Math.cos(angle) * t * speed * 15) % 100;
          const py = (p.y + Math.sin(angle) * t * speed * 15) % 100;
          const trailLen = 5 + Math.abs(noiseVal) * 8;
          return (
            <div key={i} style={{
              position: 'absolute', left: `${(px + 100) % 100}%`, top: `${(py + 100) % 100}%`,
              width: p.size * 0.8, height: trailLen,
              backgroundColor: i % 4 === 0 ? accentColor : i % 3 === 0 ? primaryColor : '#ffffff',
              opacity: p.opacity * 0.6,
              borderRadius: p.size,
              transform: `rotate(${angle}rad)`,
              transformOrigin: 'center top',
              filter: 'blur(0.5px)',
            }} />
          );
        })}
        {/* 中心辉光 */}
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${hexToRgba(primaryColor, 0.06)} 0%, transparent 60%)` }} />
        {/* 流场方向指示线 */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.05 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const x = (i % 4) * 25 + 12.5;
            const y = Math.floor(i / 4) * 33 + 16;
            const nv = noise3D(`ffi-${seed}-${i}`, x / 8, y / 8, t * 0.12);
            const angle = nv * Math.PI * 4;
            const len = 30;
            return (
              <line key={i} x1={`${x}%`} y1={`${y}%`}
                x2={`${x + Math.cos(angle) * len / 10}%`} y2={`${y + Math.sin(angle) * len / 10}%`}
                stroke={accentColor} strokeWidth={1} />
            );
          })}
        </svg>
      </AbsoluteFill>
    );
  }

  // 默认：渐变背景
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${135 + slowT * 10}deg, ${bgColor} 0%, ${hexToRgba(primaryColor, 0.06)} 50%, ${hexToRgba(accentColor, 0.03)} 100%)`,
    }} />
  );
};
