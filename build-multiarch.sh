#!/bin/bash

# 本地多架构 Docker 镜像构建脚本
# 使用方法: ./build-multiarch.sh
# 环境变量:
#   IMAGE_NAME - 镜像名称 (默认: ghcr.io/kylsky/chatgpt-team-helper)
#   TAG - 镜像标签 (默认: latest)
#   PLATFORMS - 目标平台 (默认: linux/amd64,linux/arm64)
#   PUSH - 是否推送到远程仓库 (默认: false)

set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/kylsky/chatgpt-team-helper}"
TAG="${TAG:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PUSH="${PUSH:-false}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "======================================"
echo "    多架构 Docker 镜像构建"
echo "======================================"
echo "镜像名称: ${IMAGE_NAME}:${TAG}"
echo "目标平台: ${PLATFORMS}"
echo "推送镜像: ${PUSH}"
echo ""

# 检查 docker buildx
if ! docker buildx version > /dev/null 2>&1; then
    print_error "未安装 docker buildx"
    echo "请升级 Docker 到最新版本或安装 buildx 插件"
    exit 1
fi
print_success "docker buildx 已安装"

# 创建或使用 builder
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
    echo "创建 buildx builder: ${BUILDER_NAME}"
    docker buildx create --name "${BUILDER_NAME}" --driver docker-container --use
    docker buildx inspect "${BUILDER_NAME}" --bootstrap
    print_success "builder 创建完成"
else
    docker buildx use "${BUILDER_NAME}"
    print_success "使用已有 builder: ${BUILDER_NAME}"
fi

# 构建参数
BUILD_ARGS=(
    --platform "${PLATFORMS}"
    --tag "${IMAGE_NAME}:${TAG}"
)

if [ "${PUSH}" = "true" ]; then
    BUILD_ARGS+=(--push)
    print_warning "将推送到远程仓库..."
else
    echo "仅构建，不推送（设置 PUSH=true 推送）"
    BUILD_ARGS+=(--output type=image,push=false)
fi

# 执行构建
echo ""
echo "开始构建..."
echo "------------------------"
docker buildx build "${BUILD_ARGS[@]}" .

echo ""
echo "======================================"
echo "    构建完成！"
echo "======================================"

if [ "${PUSH}" = "true" ]; then
    echo ""
    print_success "镜像已推送"
    echo ""
    echo "验证多架构镜像："
    echo "  docker buildx imagetools inspect ${IMAGE_NAME}:${TAG}"
fi
