// assetManager.ts — 素材管理器
// 负责素材的下载、缓存、查询和自动获取
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ScriptData } from '../types/script';

const execAsync = promisify(exec);

export interface AssetInfo {
  id: string;
  url: string;
  local_path: string;
  type: 'image' | 'video' | 'audio';
  source: 'pexels' | 'unsplash' | 'local' | 'generated';
  width?: number;
  height?: number;
  size_bytes?: number;
  cached: boolean;
}

export class AssetManager {
  private cacheDir: string;
  private manifestPath: string;
  private manifest: Map<string, AssetInfo> = new Map();

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.resolve(process.cwd(), 'output', 'assets_cache');
    this.manifestPath = path.join(this.cacheDir, 'manifest.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    try {
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      const data = JSON.parse(content);
      for (const item of Object.values(data) as AssetInfo[]) {
        this.manifest.set(item.id, item);
      }
    } catch {
      // No manifest yet, start fresh
    }
  }

  async saveManifest(): Promise<void> {
    const data: Record<string, AssetInfo> = {};
    this.manifest.forEach((value, key) => {
      data[key] = value;
    });
    await fs.writeFile(this.manifestPath, JSON.stringify(data, null, 2));
  }

  // Download and cache an asset
  async downloadAsset(url: string, fileName?: string): Promise<AssetInfo> {
    const id = this.hashUrl(url);
    const ext = this.getExtension(url);
    const localFileName = fileName || `${id}${ext}`;
    const localPath = path.join(this.cacheDir, localFileName);

    // Check cache
    const existing = this.manifest.get(id);
    if (existing && existing.cached) {
      try {
        await fs.access(existing.local_path);
        return existing;
      } catch {
        // File missing, re-download
      }
    }

    // Download
    console.log(`  [Asset] Downloading: ${url.substring(0, 80)}...`);
    try {
      await execAsync(`curl -sL "${url}" -o "${localPath}"`);
      const stats = await fs.stat(localPath);
      const type = ext === '.mp4' || ext === '.mov' ? 'video' : ext === '.mp3' || ext === '.wav' ? 'audio' : 'image';

      const info: AssetInfo = {
        id,
        url,
        local_path: localPath,
        type,
        source: 'local',
        size_bytes: stats.size,
        cached: true,
      };
      this.manifest.set(id, info);
      return info;
    } catch (err) {
      console.error(`  [Asset] Failed to download: ${err}`);
      throw err;
    }
  }

  // Resolve asset reference from script visual data
  async resolveScriptAssets(script: ScriptData): Promise<Record<string, AssetInfo>> {
    const resolved: Record<string, AssetInfo> = {};

    for (const scene of script.scenes) {
      const visual = scene.visual as any;

      if (visual.type === 'image' && visual.image_source) {
        const key = `scene_${scene.scene_id}_image`;
        if (visual.image_source.startsWith('http')) {
          resolved[key] = await this.downloadAsset(visual.image_source);
        } else if (visual.image_source.startsWith('/')) {
          // Local file
          resolved[key] = {
            id: this.hashUrl(visual.image_source),
            url: visual.image_source,
            local_path: visual.image_source,
            type: 'image',
            source: 'local',
            cached: true,
          };
        }
      }

      if (visual.type === 'text_card' && visual.bg_image) {
        const key = `scene_${scene.scene_id}_bg`;
        if (visual.bg_image.startsWith('http')) {
          resolved[key] = await this.downloadAsset(visual.bg_image);
        }
      }

      if (visual.type === 'animation' && visual.animation_source) {
        const key = `scene_${scene.scene_id}_lottie`;
        if (visual.animation_source.startsWith('http')) {
          resolved[key] = await this.downloadAsset(visual.animation_source);
        }
      }

      if (visual.type === 'mixed' && visual.elements) {
        for (let i = 0; i < visual.elements.length; i++) {
          const el = visual.elements[i];
          if (el.type === 'image' && el.data?.src?.startsWith('http')) {
            const key = `scene_${scene.scene_id}_element_${i}`;
            resolved[key] = await this.downloadAsset(el.data.src);
          }
        }
      }
    }

    await this.saveManifest();
    return resolved;
  }

  // Search Pexels for images
  async searchPexels(query: string, perPage: number = 5): Promise<AssetInfo[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.warn('  [Asset] PEXELS_API_KEY not set');
      return [];
    }

    try {
      const { stdout } = await execAsync(
        `curl -s -H "Authorization: ${apiKey}" "https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait"`
      );
      const data = JSON.parse(stdout);
      const results: AssetInfo[] = [];

      if (data.photos) {
        for (const photo of data.photos) {
          const info: AssetInfo = {
            id: `pexels_${photo.id}`,
            url: photo.src.large2x || photo.src.large,
            local_path: '',
            type: 'image',
            source: 'pexels',
            width: photo.width,
            height: photo.height,
            cached: false,
          };
          results.push(info);
        }
      }
      return results;
    } catch (err) {
      console.error(`  [Asset] Pexels search failed: ${err}`);
      return [];
    }
  }

  // Search Pexels for videos
  async searchPexelsVideos(query: string, perPage: number = 5): Promise<AssetInfo[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.warn('  [Asset] PEXELS_API_KEY not set');
      return [];
    }

    try {
      const { stdout } = await execAsync(
        `curl -s -H "Authorization: ${apiKey}" "https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}"`
      );
      const data = JSON.parse(stdout);
      const results: AssetInfo[] = [];

      if (data.videos) {
        for (const video of data.videos) {
          const file = video.video_files?.find((f: any) => f.quality === 'hd') || video.video_files?.[0];
          if (file) {
            results.push({
              id: `pexels_video_${video.id}`,
              url: file.link,
              local_path: '',
              type: 'video',
              source: 'pexels',
              width: file.width,
              height: file.height,
              cached: false,
            });
          }
        }
      }
      return results;
    } catch (err) {
      console.error(`  [Asset] Pexels video search failed: ${err}`);
      return [];
    }
  }

  // Auto-fetch assets for script based on keywords in narration
  async autoFetchAssets(script: ScriptData): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};

    for (const scene of script.scenes) {
      const visual = scene.visual as any;

      // If scene needs an image but doesn't have one, try to fetch from Pexels
      if (visual.type === 'image' && !visual.image_source) {
        const keywords = this.extractKeywords(scene.narration);
        if (keywords.length > 0) {
          const results = await this.searchPexels(keywords[0], 1);
          if (results.length > 0) {
            const downloaded = await this.downloadAsset(results[0].url);
            resolved[`scene_${scene.scene_id}`] = downloaded.local_path;
            visual.image_source = downloaded.local_path;
          }
        }
      }
    }

    return resolved;
  }

  // Extract keywords from narration text for asset search
  private extractKeywords(text: string): string[] {
    // Remove punctuation and common words
    const cleaned = text.replace(/[，。！？；：、,\.!?;:\n\r]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);

    // Take first few meaningful words as keywords
    return words.slice(0, 3);
  }

  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `asset_${Math.abs(hash).toString(16)}`;
  }

  private getExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp|mp4|mov|mp3|wav|json)(\?|$)/i);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  }

  // Get cache stats
  getCacheStats(): { count: number; totalSize: number } {
    let totalSize = 0;
    this.manifest.forEach((info) => {
      totalSize += info.size_bytes || 0;
    });
    return { count: this.manifest.size, totalSize };
  }

  // Clear cache
  async clearCache(): Promise<void> {
    await fs.rm(this.cacheDir, { recursive: true, force: true });
    await fs.mkdir(this.cacheDir, { recursive: true });
    this.manifest.clear();
  }
}
