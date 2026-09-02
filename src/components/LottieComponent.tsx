// LottieComponent.tsx — Lottie 动画集成组件
// 在 Remotion 中渲染 Lottie 动画，支持动画进度同步
import React from 'react';
import { Lottie, getLottieMetadata } from '@remotion/lottie';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { TemplateConfig } from '../types/script';

interface LottieComponentProps {
  animationSource: string;
  template: TemplateConfig;
  width?: number;
  height?: number;
  loop?: boolean;
}

export const LottieComponent: React.FC<LottieComponentProps> = ({
  animationSource,
  template,
  width = 400,
  height = 400,
  loop = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Load Lottie animation data
  const [animationData, setAnimationData] = React.useState<any>(null);

  React.useEffect(() => {
    // For local files or URLs
    if (animationSource.startsWith('http')) {
      fetch(animationSource)
        .then(res => res.json())
        .then(data => setAnimationData(data))
        .catch(err => console.error('Failed to load Lottie:', err));
    } else {
      // Try to import from local path
      try {
        // Dynamic import for local Lottie JSON files
        import(animationSource)
          .then((data) => setAnimationData(data.default || data))
          .catch(() => {
            // Fallback: try fetch
            fetch(animationSource)
              .then(res => res.json())
              .then(data => setAnimationData(data))
              .catch(() => console.error('Failed to load local Lottie'));
          });
      } catch {
        console.error('Failed to load Lottie animation');
      }
    }
  }, [animationSource]);

  if (!animationData) {
    // Loading placeholder
    return (
      <div style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: template.card_bg,
        borderRadius: template.corner_radius,
        color: template.text_color,
        fontSize: 18,
        fontFamily: template.body_font,
      }}>
        Loading animation...
      </div>
    );
  }

  // Get Lottie metadata for frame calculation
  const metadata = getLottieMetadata(animationData);
  const totalLottieFrames = metadata?.durationInFrames || durationInFrames;
  const lottieFps = metadata?.fps || fps;

  // Calculate playback frame with loop
  let playbackFrame: number;
  if (loop) {
    const loopFrames = Math.ceil(totalLottieFrames);
    playbackFrame = frame % loopFrames;
  } else {
    playbackFrame = Math.min(frame, totalLottieFrames);
  }

  // Entrance fade
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ width, height, opacity }}>
      <Lottie
        animationData={animationData}
        style={{ width: '100%', height: '100%' }}
        playbackRate={1}
      />
    </div>
  );
};

// Fallback animated component for when Lottie data is not available
export const FallbackAnimation: React.FC<{ template: TemplateConfig }> = ({ template }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'relative',
      width: 400,
      height: 400,
      opacity,
    }}>
      {/* Rotating outer ring */}
      <div style={{
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: '50%',
        border: `3px solid ${template.primary_color}`,
        top: 100,
        left: 100,
        transform: `rotate(${frame * 2}deg)`,
        borderTopColor: 'transparent',
      }} />
      {/* Pulsing center circle */}
      <div style={{
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: '50%',
        backgroundColor: template.accent_color,
        top: 150,
        left: 150,
        transform: `scale(${1 + Math.sin(frame / 8) * 0.15})`,
        opacity: 0.7,
      }} />
      {/* Orbiting dots */}
      {[...Array(8)].map((_, i) => {
        const angle = (frame * 3 + i * 45) * (Math.PI / 180);
        const radius = 160;
        return (
          <div key={i} style={{
            position: 'absolute',
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: template.chart_colors[i % template.chart_colors.length],
            top: 194 + Math.sin(angle) * radius,
            left: 194 + Math.cos(angle) * radius,
          }} />
        );
      })}
    </div>
  );
};
