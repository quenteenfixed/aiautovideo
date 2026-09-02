// assets.ts — 素材管理脚本（Phase 3 完善版）
// 支持: Pexels搜索、下载缓存、自动获取、批量预取
import { AssetManager } from '../src/utils/assetManager';
import { loadScript } from '../src/utils/helpers';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new AssetManager();
  await manager.init();

  switch (command) {
    case 'search': {
      const query = args[1];
      if (!query) {
        console.error('Usage: tsx scripts/assets.ts search <query>');
        process.exit(1);
      }
      console.log(`Searching Pexels for: "${query}"...`);
      const results = await manager.searchPexels(query, 10);
      console.log(`\nFound ${results.length} results:`);
      results.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.url.substring(0, 80)}... (${r.width}x${r.height})`);
      });
      break;
    }

    case 'search-video': {
      const query = args[1];
      if (!query) {
        console.error('Usage: tsx scripts/assets.ts search-video <query>');
        process.exit(1);
      }
      console.log(`Searching Pexels videos for: "${query}"...`);
      const results = await manager.searchPexelsVideos(query, 5);
      console.log(`\nFound ${results.length} results:`);
      results.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.url.substring(0, 80)}... (${r.width}x${r.height})`);
      });
      break;
    }

    case 'download': {
      const url = args[1];
      const fileName = args[2];
      if (!url) {
        console.error('Usage: tsx scripts/assets.ts download <url> [filename]');
        process.exit(1);
      }
      console.log(`Downloading: ${url}`);
      const info = await manager.downloadAsset(url, fileName);
      console.log(`Downloaded to: ${info.local_path}`);
      console.log(`Size: ${info.size_bytes} bytes`);
      break;
    }

    case 'prefetch': {
      const scriptPath = args[1];
      if (!scriptPath) {
        console.error('Usage: tsx scripts/assets.ts prefetch <script.json>');
        process.exit(1);
      }
      console.log(`Pre-fetching assets for: ${scriptPath}`);
      const script = await loadScript(scriptPath);
      const resolved = await manager.resolveScriptAssets(script);
      console.log(`\nResolved ${Object.keys(resolved).length} assets:`);
      for (const [key, info] of Object.entries(resolved)) {
        console.log(`  ${key}: ${info.local_path} (${info.size_bytes} bytes)`);
      }
      break;
    }

    case 'auto-fetch': {
      const scriptPath = args[1];
      if (!scriptPath) {
        console.error('Usage: tsx scripts/assets.ts auto-fetch <script.json>');
        process.exit(1);
      }
      console.log(`Auto-fetching assets for: ${scriptPath}`);
      const script = await loadScript(scriptPath);
      const fetched = await manager.autoFetchAssets(script);
      console.log(`\nAuto-fetched ${Object.keys(fetched).length} assets:`);
      for (const [key, localPath] of Object.entries(fetched)) {
        console.log(`  ${key}: ${localPath}`);
      }
      break;
    }

    case 'stats': {
      const stats = manager.getCacheStats();
      console.log('Asset Cache Stats:');
      console.log(`  Total assets: ${stats.count}`);
      console.log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Cache dir: ${path.resolve('output/assets_cache')}`);
      break;
    }

    case 'clear': {
      console.log('Clearing asset cache...');
      await manager.clearCache();
      console.log('Cache cleared.');
      break;
    }

    default:
      console.log('AI Auto Video - Asset Manager');
      console.log('');
      console.log('Usage:');
      console.log('  tsx scripts/assets.ts search <query>         Search Pexels images');
      console.log('  tsx scripts/assets.ts search-video <query>  Search Pexels videos');
      console.log('  tsx scripts/assets.ts download <url> [name] Download and cache an asset');
      console.log('  tsx scripts/assets.ts prefetch <script>    Pre-fetch all assets for a script');
      console.log('  tsx scripts/assets.ts auto-fetch <script>   Auto-fetch missing assets');
      console.log('  tsx scripts/assets.ts stats                  Show cache statistics');
      console.log('  tsx scripts/assets.ts clear                  Clear asset cache');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
