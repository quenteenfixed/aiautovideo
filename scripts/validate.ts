// validate.ts — script.json 校验器
import type { ScriptData } from '../src/types/script';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateScript(script: ScriptData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Top-level fields
  if (!script.video_id) {
    errors.push({ field: 'video_id', message: 'video_id is required', severity: 'error' });
  }
  if (!script.title) {
    errors.push({ field: 'title', message: 'title is required', severity: 'error' });
  }
  if (!script.resolution || !script.resolution.width || !script.resolution.height) {
    errors.push({ field: 'resolution', message: 'resolution.width and height are required', severity: 'error' });
  } else if (script.resolution.width < 720 || script.resolution.height < 720) {
    errors.push({ field: 'resolution', message: 'resolution should be at least 720p', severity: 'warning' });
  }
  if (!script.fps || script.fps < 24 || script.fps > 60) {
    errors.push({ field: 'fps', message: 'fps should be between 24 and 60', severity: 'warning' });
  }
  if (!script.template) {
    errors.push({ field: 'template', message: 'template is required', severity: 'error' });
  }
  if (!script.global_style) {
    errors.push({ field: 'global_style', message: 'global_style is required', severity: 'error' });
  }
  if (!script.voice) {
    errors.push({ field: 'voice', message: 'voice config is required', severity: 'error' });
  } else {
    if (!script.voice.voice_name) {
      errors.push({ field: 'voice.voice_name', message: 'voice_name is required', severity: 'error' });
    }
  }
  if (!script.subtitle_style) {
    errors.push({ field: 'subtitle_style', message: 'subtitle_style is required', severity: 'error' });
  } else {
    if (script.subtitle_style.font_size < 20 || script.subtitle_style.font_size > 60) {
      errors.push({ field: 'subtitle_style.font_size', message: 'font_size should be between 20 and 60', severity: 'warning' });
    }
    const validAnimations = ['bounce', 'slide', 'fade', 'pop'];
    if (!validAnimations.includes(script.subtitle_style.animation)) {
      errors.push({ field: 'subtitle_style.animation', message: `animation must be one of: ${validAnimations.join(', ')}`, severity: 'warning' });
    }
  }

  // Scenes validation
  if (!script.scenes || script.scenes.length === 0) {
    errors.push({ field: 'scenes', message: 'at least one scene is required', severity: 'error' });
  } else {
    script.scenes.forEach((scene, i) => {
      const prefix = `scenes[${i}]`;
      if (scene.scene_id === undefined || scene.scene_id < 0) {
        errors.push({ field: `${prefix}.scene_id`, message: 'scene_id must be a non-negative number', severity: 'error' });
      }
      if (!scene.narration || scene.narration.trim().length === 0) {
        errors.push({ field: `${prefix}.narration`, message: 'narration text is required', severity: 'error' });
      }
      if (!scene.duration || scene.duration <= 0) {
        errors.push({ field: `${prefix}.duration`, message: 'duration must be positive (seconds)', severity: 'warning' });
      }
      if (!scene.visual) {
        errors.push({ field: `${prefix}.visual`, message: 'visual config is required', severity: 'error' });
      } else {
        const validTypes = ['text_card', 'chart', 'animation', 'image', 'mixed', 'cta_card'];
        if (!validTypes.includes(scene.visual.type)) {
          errors.push({ field: `${prefix}.visual.type`, message: `visual.type must be one of: ${validTypes.join(', ')}`, severity: 'error' });
        }
        // Type-specific validation
        if (scene.visual.type === 'text_card') {
          const tc = scene.visual as any;
          if (!tc.title) {
            errors.push({ field: `${prefix}.visual.title`, message: 'text_card requires title', severity: 'error' });
          }
        }
        if (scene.visual.type === 'chart') {
          const ch = scene.visual as any;
          if (!ch.chart_type) {
            errors.push({ field: `${prefix}.visual.chart_type`, message: 'chart requires chart_type', severity: 'error' });
          }
          if (!ch.data) {
            errors.push({ field: `${prefix}.visual.data`, message: 'chart requires data', severity: 'error' });
          }
        }
        if (scene.visual.type === 'cta_card') {
          const ct = scene.visual as any;
          if (!ct.text) {
            errors.push({ field: `${prefix}.visual.text`, message: 'cta_card requires text', severity: 'error' });
          }
        }
      }
      if (!scene.transition_in) {
        errors.push({ field: `${prefix}.transition_in`, message: 'transition_in is required', severity: 'warning' });
      }
      if (!scene.transition_out) {
        errors.push({ field: `${prefix}.transition_out`, message: 'transition_out is required', severity: 'warning' });
      }
    });

    // Check scene_id uniqueness
    const sceneIds = script.scenes.map((s) => s.scene_id);
    const uniqueIds = new Set(sceneIds);
    if (uniqueIds.size !== sceneIds.length) {
      errors.push({ field: 'scenes', message: 'scene_id must be unique', severity: 'error' });
    }
  }

  // Outro validation
  if (!script.outro) {
    errors.push({ field: 'outro', message: 'outro is required', severity: 'error' });
  } else {
    if (!script.outro.visual || !script.outro.visual.text) {
      errors.push({ field: 'outro.visual.text', message: 'outro text is required', severity: 'error' });
    }
  }

  return errors;
}

export function printValidationErrors(errors: ValidationError[]): void {
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  if (errorCount > 0) {
    console.error('\n  Validation Errors:');
    errors.filter((e) => e.severity === 'error').forEach((e) => {
      console.error(`    ✗ ${e.field}: ${e.message}`);
    });
  }

  if (warningCount > 0) {
    console.warn('\n  Validation Warnings:');
    errors.filter((e) => e.severity === 'warning').forEach((e) => {
      console.warn(`    ⚠ ${e.field}: ${e.message}`);
    });
  }

  console.log(`\n  Total: ${errorCount} errors, ${warningCount} warnings`);
}

// CLI entry point
if (require.main === module) {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error('Usage: tsx scripts/validate.ts <script.json>');
    process.exit(1);
  }

  import('../src/utils/helpers').then(async ({ loadScript }) => {
    const script = await loadScript(scriptPath);
    const errors = validateScript(script);
    if (errors.length === 0) {
      console.log('\n  ✓ Script validation passed.\n');
    } else {
      printValidationErrors(errors);
      if (errors.some((e) => e.severity === 'error')) {
        process.exit(1);
      }
    }
  }).catch((err) => {
    console.error('Failed to load/validate script:', err);
    process.exit(1);
  });
}
