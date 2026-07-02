# syntax=docker/dockerfile:1.7
ARG PLAYWRIGHT_VERSION=1.61.1
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION

LABEL org.opencontainers.image.title="training-log-playwright" \
      org.opencontainers.image.description="Playwright test runner image with Chromium, Firefox, and WebKit preinstalled." \
      org.opencontainers.image.licenses="MIT"

# Keep an explicit Playwright CLI available and verify required browsers.
RUN set -eu; \
      apt-get update; \
      apt-get install -y --no-install-recommends ffmpeg; \
      rm -rf /var/lib/apt/lists/*; \
      npm install -g playwright@${PLAYWRIGHT_VERSION}; \
      playwright install chromium firefox webkit; \
      playwright install --list | grep -Eq \
      '/ms-playwright/chromium-|/ms-playwright/firefox-|/ms-playwright/webkit-'

USER pwuser

WORKDIR /work
