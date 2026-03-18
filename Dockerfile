# 多阶段构建 - 阶段1：构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

RUN npm ci

COPY frontend/ ./frontend/
RUN npm run build-only --workspace=frontend


# 多阶段构建 - 阶段2：准备后端
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev --workspace=backend

COPY backend/ ./backend/


# 多阶段构建 - 阶段3：最终运行镜像
FROM node:20-alpine

RUN apk add --no-cache \
    nginx \
    supervisor \
    nss \
    harfbuzz \
    freetype \
    ttf-freefont \
    bash \
    udev \
    curl \
    wget \
    gettext \
    tzdata

WORKDIR /app

COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend/src ./backend/src
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY --from=backend-builder /app/backend/version.json ./backend/

RUN mkdir -p /etc/nginx/conf.d
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

COPY supervisord.conf /etc/supervisord.conf

RUN mkdir -p /app/backend/db

EXPOSE 8080

RUN mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.template

RUN printf '#!/bin/sh\nset -e\nexport NGINX_PORT=${NGINX_PORT:-8080}\nenvsubst "\\$NGINX_PORT" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf\nexec /usr/bin/supervisord -c /etc/supervisord.conf\n' > /app/start.sh \
    && chmod +x /app/start.sh

CMD ["/app/start.sh"]