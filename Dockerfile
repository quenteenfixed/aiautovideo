# Dockerfile — AI Auto Video 生产环境
# 基于 Node.js + Python，支持 Remotion 渲染和 edge-tts 语音合成

FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    wget \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    ca-certificates \
    ffmpeg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages edge-tts

# Copy source code
COPY . .

# Create output directories
RUN mkdir -p output/audio output/final output/assets_cache

# Set environment variables
ENV NODE_ENV=production
ENV PYTHON_PATH=python3
ENV REMOTION_CONCURRENCY=2
ENV OUTPUT_DIR=/app/output

# Expose Remotion Studio port
EXPOSE 3000

# Default command: render pipeline
CMD ["node", "scripts/batch.js", "--help"]
