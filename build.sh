#!/bin/bash

# ==========================================
# 项目构建脚本 (Project Build Script)
# ==========================================

# 遇到错误即退出
set -euo pipefail

# 打印颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==> 开始构建项目...${NC}"

# 1. 拉取最新代码
echo -e "\n${GREEN}==> 正在拉取最新代码 (git pull)...${NC}"
git pull

# 2. 检查 node 和 npm
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}✗ 未找到 Node.js，请先安装 Node.js!${NC}"
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}✗ 未找到 npm，请确认您的 Node.js 安装是否完整!${NC}"
    exit 1
fi

echo "当前 Node 版："
node -v
echo "当前 npm 版："
npm -v

# 2. 安装所有依赖
echo -e "\n${GREEN}==> 正在安装项目依赖 (包含前端和后端)...${NC}"
npm install

# 3. 编译前端
echo -e "\n${GREEN}==> 正在构建前端资源...${NC}"
# 清除旧的构建产物
if [ -d "frontend/dist" ]; then
    echo "清理旧的 frontend/dist 目录..."
    rm -rf frontend/dist
fi

# 运行 package.json 中的 build 脚本
npm run build

# 4. 构建完成提示
if [ -d "frontend/dist" ]; then
    echo -e "\n${GREEN}============ 构建成功！============${NC}"
    echo "前端静态资源已被打包并存放在: frontend/dist/"
    echo "后端可直接运行，无需额外编译步骤 (Node.js)。"
    echo ""
    echo "【首次部署】"
    echo "  1. 准备环境变量: cp backend/.env.example backend/.env (根据需要修改内容)"
    echo "  2. 启动服务 (推荐使用 PM2): cd backend && pm2 start src/server.js --name chatgpt-team-helper"
    echo ""
    echo "【更新升级】"
    echo "  1. 执行了当前脚本完成拉取代码和编译后，只需重启后端服务即可生效："
    echo "  2. 如果使用 PM2: pm2 restart chatgpt-team-helper"
    echo "==================================="
else
    echo -e "\n${RED}✗ 构建失败，缺少 frontend/dist 输出目录，请查看上方的错误日志。${NC}"
    exit 1
fi
