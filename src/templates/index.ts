// Template registry
import type { TemplateConfig, TemplateType } from '../types/script';
import { DataVisualStyle } from './DataVisualStyle';
import { IllustrationStyle } from './IllustrationStyle';
import { CinematicStyle } from './CinematicStyle';
import { MinimalStyle } from './MinimalStyle';
import { InfographicStyle } from './InfographicStyle';

export const templates: Record<string, TemplateConfig> = {
  data_visual_style: DataVisualStyle,
  illustration_style: IllustrationStyle,
  cinematic_style: CinematicStyle,
  minimal_style: MinimalStyle,
  infographic_style: InfographicStyle,
};

export function getTemplate(name: string): TemplateConfig {
  return templates[name] || DataVisualStyle;
}

export { DataVisualStyle, IllustrationStyle, CinematicStyle, MinimalStyle, InfographicStyle };
