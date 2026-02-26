#!/bin/sh
# 后端启动包装脚本：
#   - 设置后端专用的环境变量（PORT=3000 给后端，不影响 nginx 的 8080）
#   - 继承容器级别的所有环境变量（如 JWT_SECRET 等 Cloud Run 注入的变量）

# 后端固定监听 3000 端口（nginx 代理到此端口）
export PORT=3000
export NODE_ENV=production
export DATABASE_PATH="${DATABASE_PATH:-/app/backend/db/database.sqlite}"

echo "[run-backend.sh] Starting backend on port ${PORT}"
echo "[run-backend.sh] NODE_ENV=${NODE_ENV}"
echo "[run-backend.sh] DATABASE_PATH=${DATABASE_PATH}"
echo "[run-backend.sh] JWT_SECRET is $([ -n \"${JWT_SECRET}\" ] && echo 'SET' || echo 'NOT SET')"

exec node /app/backend/src/server.js
