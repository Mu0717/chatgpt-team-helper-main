# 贡献指南

## 开发环境

- Node.js：`frontend/package.json` 要求 `^20.19.0 || >=22.12.0`
- 推荐使用 `npm`

## 本地启动

1. 安装依赖：`npm install`
2. 配置环境变量：
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`（可选）
3. 启动开发：`npm run dev`（同时启动前后端）

也可以分别启动：
- 后端：`npm run dev --workspace=backend`
- 前端：`npm run dev --workspace=frontend`

## 提交规范

- 不要提交任何密钥/Token/账号信息；提交前建议跑一遍 `OPEN_SOURCE_CHECKLIST.md` 的扫描命令。
- 变更尽量保持小而清晰，PR 描述包含动机、影响范围、验证方式。

