// Subtitle.tsx — 动画字幕组件，支持变色和跳动效果
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import type { WordBoundary, SubtitleStyle } from '../types/script';

interface AnimatedSubtitleProps {
  words: WordBoundary[];
  sceneStartFrame: number;
  style: SubtitleStyle;
}

export const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({ words, sceneStartFrame, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine which words are visible at the current frame
  // word.offset_ms is relative to the start of the audio
  const currentWordIndex = useMemo(() => {
    const currentMs = (frame / fps) * 1000;
    let activeIndex = -1;
    for (let i = 0; i < words.length; i++) {
      const wordStart = words[i].offset_ms;
      const wordEnd = wordStart + words[i].duration_ms;
      if (currentMs >= wordStart && currentMs <= wordEnd) {
        activeIndex = i;
        break;
      }
      if (currentMs >= wordStart) {
        activeIndex = i;
      }
    }
    return activeIndex;
  }, [frame, fps, words]);

  if (words.length === 0 || currentWordIndex < 0) {
    return null;
  }

  // Build subtitle text: show words up to current, with active word highlighted
  const visibleWords = words.slice(0, currentWordIndex + 1);

  // Group words into lines (approx 12 chars per line for vertical video)
  const lines = buildLines(visibleWords, style.max_width || 800);
  const activeLineIndex = lines.length - 1;

  // Position
  const positionStyles: React.CSSProperties = {};
  if (style.position === 'bottom') {
    positionStyles.bottom = style.offset_y || 120;
  } else if (style.position === 'center') {
    positionStyles.top = '50%';
    positionStyles.transform = 'translateY(-50%)';
  } else {
    positionStyles.top = style.offset_y || 120;
  }

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: style.position === 'center' ? 'center' : 'flex-start',
      zIndex: 100,
      pointerEvents: 'none',
      ...positionStyles,
    }}>
      <div style={{
        maxWidth: style.max_width || 800,
        textAlign: 'center',
        fontFamily: style.font_family,
        fontSize: style.font_size,
        lineHeight: 1.6,
        textShadow: `2px 2px 4px rgba(0,0,0,0.8), 0 0 2px ${style.stroke_color || '#000'}`,
        WebkitTextStroke: `${style.stroke_width || 2}px ${style.stroke_color || '#000'}`,
        paintOrder: 'stroke fill',
      }}>
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} style={{ marginBottom: 4 }}>
            {line.map((wordInfo, wordIdx) => {
              const isActive = lineIdx === activeLineIndex && wordInfo.index === currentWordIndex;
              return (
                <SubtitleWord
                  key={wordIdx}
                  text={wordInfo.text}
                  isActive={isActive}
                  frame={frame}
                  fps={fps}
                  style={style}
                  animation={style.animation}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// Individual subtitle word with animation
const SubtitleWord: React.FC<{
  text: string;
  isActive: boolean;
  frame: number;
  fps: number;
  style: SubtitleStyle;
  animation: string;
}> = ({ text, isActive, frame, fps, style, animation }) => {
  // For active word: apply highlight color and bounce/pop effect
  let color = style.color || '#ffffff';
  let scale = 1;
  let translateY = 0;

  if (isActive) {
    color = style.highlight_color || '#FFD700';

    if (animation === 'bounce') {
      // Bounce effect: spring-based vertical movement
      scale = spring({
        frame: frame,
        fps,
        config: { damping: 8, stiffness: 300, mass: 0.5 },
        from: 0.8,
        to: 1,
      });
      translateY = spring({
        frame: frame,
        fps,
        config: { damping: 6, stiffness: 400, mass: 0.3 },
        from: -10,
        to: 0,
      });
    } else if (animation === 'pop') {
      // Pop effect: quick scale up then settle
      scale = spring({
        frame: frame,
        fps,
        config: { damping: 10, stiffness: 200, mass: 0.6 },
        from: 0.5,
        to: 1,
      });
    } else if (animation === 'slide') {
      // Slide effect: horizontal slide in
      translateY = interpolate(
        frame,
        [0, 5],
        [15, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
      );
    } else if (animation === 'fade') {
      // Fade: opacity change
      const opacity = interpolate(frame, [0, 4], [0.3, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      color = style.highlight_color || '#FFD700';
      return (
        <span style={{
          color,
          display: 'inline-block',
          opacity,
          transition: 'color 0.1s',
          padding: '0 2px',
        }}>
          {text}
        </span>
      );
    }
  }

  return (
    <span style={{
      color,
      display: 'inline-block',
      transform: `translateY(${translateY}px) scale(${scale})`,
      transition: 'color 0.1s, transform 0.05s',
      padding: '0 2px',
      transformOrigin: 'center bottom',
    }}>
      {text}
    </span>
  );
};

// Build lines from word list based on max width approximation
interface WordInfo {
  text: string;
  index: number;
}

function buildLines(words: WordBoundary[], maxWidth: number): WordInfo[][] {
  const lines: WordInfo[][] = [];
  let currentLine: WordInfo[] = [];
  let currentWidth = 0;
  const charWidth = 1; // approximate

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidth = word.text.length * charWidth;
    if (currentWidth + wordWidth > maxWidth / 18 && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }
    currentLine.push({ text: word.text, index: i });
    currentWidth += wordWidth + 1;
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}
