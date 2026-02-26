#!/bin/bash

# Docker Compose 部署脚本（以 docker-compose.yml / 镜像行为为准）
# 使用方法: ./build-docker.sh

set -euo pipefail

echo "====================================="
echo "    Docker Compose 部署脚本"
echo "====================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

if ! command -v docker >/dev/null 2>&1; then
  print_error "Docker 未安装，请先安装 Docker"
  exit 1
fi

COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  print_error "未找到 Docker Compose（请安装 docker compose 或 docker-compose）"
  exit 1
fi

COMPOSE_FILE="docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  print_error "未找到 $COMPOSE_FILE"
  exit 1
fi

# 兼容旧脚本遗留容器名（可能占用端口）
LEGACY_CONTAINER_NAME="auto-gpt-team-container"
if docker ps -aq -f "name=^${LEGACY_CONTAINER_NAME}$" | grep -q .; then
  print_warning "发现旧容器 ${LEGACY_CONTAINER_NAME}，正在停止并删除..."
  docker stop "${LEGACY_CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker rm "${LEGACY_CONTAINER_NAME}" >/dev/null 2>&1 || true
  print_success "旧容器已清理"
fi

mkdir -p data logs
print_success "已创建/确认目录: ./data ./logs"

if [ ! -f "backend/.env" ]; then
  print_error "缺少 backend/.env（docker-compose.yml 会引用该文件）"
  echo "请先执行：cp backend/.env.example backend/.env 并填写必要配置"
  exit 1
fi

echo ""
echo "开始构建并启动（使用 ${COMPOSE_CMD}）..."
echo "------------------------"

${COMPOSE_CMD} -f "${COMPOSE_FILE}" up -d --build
print_success "已启动"

echo ""
${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps

echo ""
echo "等待服务启动..."
sleep 5

echo ""
echo "检查服务状态..."
echo "------------------------"

if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ | grep -q "200\\|304"; then
  print_success "前端服务运行正常 (http://localhost:5173)"
else
  print_warning "前端服务可能未就绪，请稍后再试"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/health | grep -q "200\\|304"; then
  print_success "后端 API 代理运行正常 (http://localhost:5173/api/health)"
else
  print_warning "后端 API 可能未就绪，请稍后再试（可查看 compose logs）"
fi

echo ""
echo "====================================="
echo "    部署完成！"
echo "====================================="
echo ""
echo "访问地址："
echo "  - 前端: http://localhost:5173"
echo "  - 后端 API（经 Nginx 代理）: http://localhost:5173/api"
echo ""
echo "常用命令："
echo "  查看日志: ${COMPOSE_CMD} -f ${COMPOSE_FILE} logs -f"
echo "  停止:     ${COMPOSE_CMD} -f ${COMPOSE_FILE} down"
echo "  重启:     ${COMPOSE_CMD} -f ${COMPOSE_FILE} restart"
echo ""
