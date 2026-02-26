# 多阶段构建 - 阶段1：构建前端（使用 lockfile 确保可复现）
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 复制依赖清单（包含 workspaces），用于可复现安装
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

# 安装所有依赖（包含前端构建所需的 devDependencies）
RUN npm ci

# 复制前端代码并构建
COPY frontend/ ./frontend/
RUN npm run build-only --workspace=frontend

# 多阶段构建 - 阶段2：准备后端（仅安装生产依赖，使用 lockfile）
FROM node:20-alpine AS backend-builder

WORKDIR /app

# 复制依赖清单（包含 workspaces）
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# 仅安装后端生产依赖
RUN npm ci --omit=dev --workspace=backend

# 复制后端源代码
COPY backend/ ./backend/

# 多阶段构建 - 阶段3：最终运行镜像
FROM node:20-alpine

# 安装 nginx、supervisor 以及小红书订单同步所需的运行依赖（Chromium、Chromedriver、Python等）
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
    tzdata

# 创建工作目录
WORKDIR /app

# 从构建阶段复制前端构建文件
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# 从构建阶段复制后端文件
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend/src ./backend/src
COPY --from=backend-builder /app/backend/package.json ./backend/
COPY --from=backend-builder /app/backend/version.json ./backend/

# 创建 nginx 配置
RUN mkdir -p /etc/nginx/conf.d
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# 创建 supervisor 配置
COPY supervisord.conf /etc/supervisord.conf

# 创建数据库目录
RUN mkdir -p /app/backend/db

# 暴露端口（只需要暴露前端端口，API 通过 nginx 内部代理）
EXPOSE 5173

# 使用 supervisor 启动所有服务
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
