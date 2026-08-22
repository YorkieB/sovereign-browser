FROM mcr.microsoft.com/devcontainers/javascript-node:22

# Electron headless-test dependencies: xvfb virtual display + Chromium shared libs.
# Needed for `npm run smoke` inside the container; `npm ci` / `npm run check` need none of this.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
       xvfb xauth libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
       libgtk-3-0 libgbm1 libasound2 libxss1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*
