import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(2);
// 设置 public 目录为项目根目录，使音频/图片等本地资源可在渲染时访问
Config.setPublicDir('.');
