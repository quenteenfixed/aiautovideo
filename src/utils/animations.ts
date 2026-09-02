// animations.ts — 通用动画工具函数
import { interpolate, spring, Easing } from 'remotion';

const { cos, PI } = Math;

export function fadeIn(frame: number, duration: number = 15): number {
  return interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function fadeOut(frame: number, totalFrames: number, duration: number = 15): number {
  return interpolate(frame, [totalFrames - duration, totalFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function slideUp(frame: number, distance: number = 50, duration: number = 15): number {
  return interpolate(frame, [0, duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function zoomIn(frame: number, startScale: number = 0.8, duration: number = 20): number {
  return interpolate(frame, [0, duration], [startScale, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

export function bounceIn(frame: number, fps: number): number {
  return spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
  });
}

export function kenBurns(frame: number, totalFrames: number, fps: number): {
  scale: number;
  translateX: number;
  translateY: number;
} {
  const progress = frame / totalFrames;
  const scale = 1 + 0.15 * progress;
  const translateX = -30 * progress;
  const translateY = -20 * progress;
  return { scale, translateX, translateY };
}

export function typingProgress(frame: number, fps: number, totalChars: number): number {
  const charsPerSecond = 8;
  const charsToShow = Math.floor((frame / fps) * charsPerSecond);
  return Math.min(charsToShow, totalChars);
}
