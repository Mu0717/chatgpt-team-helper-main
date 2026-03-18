#!/bin/bash

# ==========================================
# Docker 自动更新部署脚本 (Update & Re-deploy Script)
# ==========================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}==> 开始执行更新与重新部署...${NC}"

# 1. 拉取最新代码
echo -e "\n${YELLOW}[1/4] 正在拉取最新的代码 (git pull)...${NC}"
git pull

# 2. 检查 Docker Compose 命令
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo -e "${RED}✗ 未找到 Docker Compose，请确认 Docker 已正确安装。${NC}"
  exit 1
fi

# 3. 强制重新构建镜像，禁用缓存
echo -e "\n${YELLOW}[2/4] 正在强制重新构建 Docker 镜像 (不使用缓存，这可能需要一点时间)...${NC}"
# 注意：镜像名称与您 docker-compose.yml 中的名称保持一致
docker build --no-cache -t ghcr.io/kylsky/chatgpt-team-helper:latest .

# 4. 停止并移除旧容器 (数据由于挂载在本地，不受任何影响)
echo -e "\n${YELLOW}[3/4] 正在停止并移除旧版本容器...${NC}"
$COMPOSE_CMD down

# 5. 启动新容器
echo -e "\n${YELLOW}[4/4] 正在启动新版本服务...${NC}"
$COMPOSE_CMD up -d

echo -e "\n${GREEN}============ 部署完成！============${NC}"
echo "新的代码已生效，所有数据 (比如 ./data 目录中数据库) 已安全保留并自动挂载加载。"
echo -e "${YELLOW}如需检查浏览器发现页面没有更新，请在页面中强刷 (Windows: Ctrl+F5，Mac: Cmd+Shift+R)。${NC}"
echo -e "若需查看启动是否报错，请执行指令跟踪日志: ${NC}$COMPOSE_CMD logs -f app"
echo -e "==================================="
