# 前端（Vue 3 + Vite）

本目录为 `auto-gpt-team` 的前端应用，提供：
- 用户侧兑换页（`/redeem/*`、`/purchase` 等）
- 管理后台（`/admin/*`）

## 开发运行

推荐在仓库根目录安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev:frontend
```

默认地址：http://localhost:5173

> 后端默认地址为 http://localhost:3000（前端开发会直连该地址）。

## 环境变量

参考 `frontend/.env.example`：
- `VITE_API_URL`：可选；不填时开发环境默认 `http://localhost:3000/api`，生产环境默认使用相对路径 `/api`
- `VITE_TURNSTILE_SITE_KEY` / `VITE_TURNSTILE_WIDGET_SIZE`：可选；用于候车室人机验证展示

## 构建

```bash
npm run build --workspace=frontend
```

产物输出到 `frontend/dist/`。

## 生产部署（Docker）

项目的 Docker 镜像会将 `frontend/dist` 作为静态站点由 nginx 提供，并通过反向代理将 `/api` 转发到后端服务。
