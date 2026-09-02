#!/bin/bash
# local-env.sh — 本地环境配置脚本
# 统一管理 Node.js、Python、FFmpeg 路径，解决 TRAE 环境二进制兼容问题

# === 二进制路径 ===
export NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"
export FFMPEG_BIN="${FFMPEG_BIN:-/usr/local/bin/ffmpeg}"
export PYTHON_BIN="${PYTHON_BIN:-python3}"

# === 验证路径 ===
echo "=== 环境配置 ==="
echo "Node: $NODE_BIN ($($NODE_BIN --version 2>&1))"
echo "FFmpeg: $FFMPEG_BIN ($($FFMPEG_BIN -version 2>&1 | head -1))"
echo "Python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"

# 验证 Python edge_tts
if $PYTHON_BIN -c "import edge_tts" 2>/dev/null; then
  echo "edge_tts: OK"
else
  echo "edge_tts: NOT FOUND (pip3 install edge-tts)"
fi

# 验证 FFmpeg 编码器
if $FFMPEG_BIN -codecs 2>&1 | grep -q "libx264"; then
  echo "H.264 encoder: OK"
else
  echo "H.264 encoder: NOT FOUND"
fi

if $FFMPEG_BIN -codecs 2>&1 | grep -q "aac"; then
  echo "AAC encoder: OK"
else
  echo "AAC encoder: NOT FOUND"
fi

echo "=== 环境就绪 ==="
