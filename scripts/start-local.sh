#!/bin/bash
# start-local.sh — 本地一键启动脚本
# 用法:
#   bash scripts/start-local.sh dev        # 启动 Remotion Studio 预览
#   bash scripts/start-local.sh render <script.json>  # 渲染视频
#   bash scripts/start-local.sh batch <dir>          # 批量渲染
#   bash scripts/start-local.sh env        # 检查环境

set -e

# 加载环境配置
source "$(dirname "$0")/local-env.sh"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

NODE="${NODE_BIN:-/usr/local/bin/node}"
TSX="node_modules/.bin/tsx"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  "$NODE" npm install
fi

CMD="${1:-help}"

case "$CMD" in
  env)
    # 环境检查已在 local-env.sh 中完成
    echo ""
    echo "项目路径: $PROJECT_ROOT"
    echo "tsx 版本: $($NODE $TSX --version 2>&1)"
    echo ""
    echo "可用命令:"
    echo "  bash scripts/start-local.sh dev                  # 启动 Studio 预览"
    echo "  bash scripts/start-local.sh render <script.json> # 渲染视频"
    echo "  bash scripts/start-local.sh render <script.json> --skip-tts  # 跳过TTS"
    echo "  bash scripts/start-local.sh batch <dir>          # 批量渲染"
    echo "  bash scripts/start-local.sh tts <script.json>    # 仅生成TTS"
    echo "  bash scripts/start-local.sh generate             # 生成模板脚本"
    echo ""
    ;;

  dev)
    echo "Starting Remotion Studio..."
    "$NODE" node_modules/.bin/remotion studio
    ;;

  render)
    SCRIPT_PATH="${2:-scripts/football_script.json}"
    echo "Rendering: $SCRIPT_PATH"
    shift 2 2>/dev/null || shift 1
    "$NODE" "$TSX" scripts/render-local.ts "$SCRIPT_PATH" "$@"
    ;;

  batch)
    INPUT_DIR="${2:-scripts}"
    echo "Batch rendering from: $INPUT_DIR"
    "$NODE" "$TSX" scripts/batch.ts "$INPUT_DIR"
    ;;

  tts)
    SCRIPT_PATH="${2:-scripts/football_script.json}"
    echo "TTS synthesis: $SCRIPT_PATH"
    "$NODE" "$TSX" scripts/tts.ts "$SCRIPT_PATH"
    ;;

  generate)
    shift
    echo "Generating template script..."
    "$NODE" "$TSX" scripts/template_generator.ts "$@"
    ;;

  smart-generate)
    shift
    echo "Smart scene breakdown..."
    "$NODE" "$TSX" scripts/smart_script_generator.ts "$@"
    ;;

  *)
    echo "Usage: bash scripts/start-local.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  env                          检查环境"
    echo "  dev                          启动 Remotion Studio 预览"
    echo "  render <script.json> [opts]  渲染视频 (opts: --skip-tts, --concurrency N)"
    echo "  batch <dir>                  批量渲染"
    echo "  tts <script.json>            仅生成 TTS 音频"
    echo "  generate <text.txt> [opts]   简单模板生成"
    echo "  smart-generate <text.txt>    智能分镜生成 (推荐)"
    echo "  smart-generate --all-templates <text.txt>  生成5种模板版本"
    echo ""
    echo "示例:"
    echo "  bash scripts/start-local.sh smart-generate football002.txt --output scripts/football_006.json"
    echo "  bash scripts/start-local.sh render scripts/football_006.json"
    echo "  bash scripts/start-local.sh render scripts/football_script.json --skip-tts"
    echo "  bash scripts/start-local.sh dev"
    ;;
esac
