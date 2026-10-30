# Node and npm are pinned per deck by scripts/init.mjs (resolved when the deck is created).
# The two lines below are the floating fallback used by the un-initialized template.
FROM node:26.12.1-bookworm
RUN npm install -g npm@12.2.1

# Chromium for "npm run pdf". Debian's package exists for arm64 and amd64 (Puppeteer's own download does not for arm64 Linux).
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_PATH=/usr/bin/chromium
