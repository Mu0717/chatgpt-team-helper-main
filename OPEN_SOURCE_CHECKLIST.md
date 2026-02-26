# 开源前检查清单（建议）

## 1) 敏感信息 / PII

- 确认 `.env` 等私密配置**未被 Git 跟踪**：
  - `git ls-files -- backend/.env frontend/.env || true`
  - `git check-ignore -v backend/.env frontend/.env`
- 仅扫描**已跟踪文件**里是否误提交密钥/Token（避免扫到本机 `.env`）：
  - `git ls-files -z | xargs -0 rg -n "(api[_-]?key|secret|token|password|passwd|Authorization:|Bearer |AKIA|ASIA|xox[baprs]-|ghp_[A-Za-z0-9]{20,}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----)" -S`
- 检查是否有硬编码域名、邮箱、内网 IP 等：
  - `git ls-files -z | xargs -0 rg -n "(https?://|@example\\.com|192\\.168\\.|10\\.|172\\.(1[6-9]|2\\d|3[0-1])\\.)" -S`

## 2) Git 历史风险（很关键）

- 如果曾经把密钥提交进历史（即使现在删了），公开仓库也会泄露。
- 快速检查某个文件是否出现在历史里：
  - `git log --oneline --all -- backend/.env frontend/.env`
- 如确认历史里出现过密钥：**立刻轮换所有相关凭据**，并使用 `git filter-repo` / BFG 清理历史（清理后需要强推并通知所有协作者重新克隆）。

## 3) `.gitignore` / `.dockerignore`

- 确认忽略：`node_modules/`、数据库/运行数据（如 `data/`、`*.sqlite*`）、日志（`logs/`）、`.env*`、编辑器目录（`.vscode/`、`.cursor/`）等。

## 4) 文档与默认配置

- 提供可用的 `*.env.example`（占位符，不包含真实密钥）。
- README 里明确：
  - 必填/可选环境变量
  - 生产环境必须修改的默认口令/密钥
  - Docker / 本地启动方式

## 5) 许可证（必须）

- 本仓库已添加 ISC `LICENSE`；如需改为 MIT / Apache-2.0 / GPLv3 等，请同步更新 `LICENSE` 与 `package.json` 的 `license` 字段。
