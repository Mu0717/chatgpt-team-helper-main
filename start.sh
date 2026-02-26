#!/bin/sh
# 容器启动脚本：
#   1. 将 Cloud Run 注入的 PORT 环境变量写入 nginx 配置
#   2. 启动 supervisord（管理 nginx + 后端）

set -e

# Cloud Run 会通过 PORT 环境变量指定监听端口，默认 8080
export NGINX_PORT="${PORT:-8080}"

echo "[start.sh] PORT=${PORT:-<not set>}, NGINX_PORT=${NGINX_PORT}"

# 用 envsubst 将 ${NGINX_PORT} 替换到 nginx 配置中
envsubst '${NGINX_PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "[start.sh] nginx config generated, listening on port ${NGINX_PORT}"

# 启动 supervisord（前台运行，管理 nginx 和后端进程）
exec /usr/bin/supervisord -c /etc/supervisord.conf
