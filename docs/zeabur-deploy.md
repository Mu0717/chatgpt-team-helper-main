# ChatGPT Team Helper 在 Zeabur 部署教程

## 一、创建项目

1. 登录 [Zeabur](https://zeabur.com)
2. 点击「创建新项目」
3. 选择「共享集群」（有免费试用，按量付费）

## 二、部署服务

1. 点击「新建服务」
2. 选择「从 Git 仓库部署」
3. 输入仓库地址：`https://github.com/Kylsky/chatgpt-team-helper`
4. 等待构建完成

## 三、配置环境变量

点击服务 → 「环境变量」标签 → 添加以下变量：

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `你的随机密钥至少32位` |
| `INIT_ADMIN_PASSWORD` | `你的管理员密码` |

> 注意：JWT_SECRET 建议使用 `openssl rand -base64 32` 生成

## 四、配置网络端口

点击「网络」标签：

1. 删除默认的 8080 端口配置
2. 内网访问：添加端口 `5173`
3. 公网访问：点击「生成域名」，容器端口选择 `5173`

## 五、配置持久化存储

点击「硬盘」标签：

1. 点击「添加硬盘」
2. 挂载路径：`/app/backend/db`
3. 保存

## 六、重新部署

点击「服务状态」→「重新部署」

## 七、访问服务

部署完成后，访问生成的域名（如 `xxx.zeabur.app`）

**登录信息：**

- 用户名：`admin`
- 密码：你设置的 `INIT_ADMIN_PASSWORD` 值

---

## 环境变量汇总（必填）

```env
JWT_SECRET=你的随机密钥至少32位
INIT_ADMIN_PASSWORD=你的管理员密码
```

## 其他可选配置

根据需要在环境变量中添加：

- **邮件通知**：`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` 等
- **Telegram 机器人**：`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS` 等
- **支付功能**：`ZPAY_BASE_URL`, `ZPAY_PID`, `ZPAY_KEY` 等

详见项目 [README](https://github.com/Kylsky/chatgpt-team-helper)。
