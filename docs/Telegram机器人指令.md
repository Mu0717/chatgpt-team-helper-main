# Telegram 兑换机器人指令（含外部 API 调用说明）

后端内置 Telegram Bot（`backend/src/services/telegram-bot.js`），用于在 Telegram 私聊中完成“库存查询 / 购买 / 兑换”等操作；部分指令会调用本服务 API 或外部激活服务。

## 1) 启用与配置

### 1.1 Bot Token 与白名单

优先从后台系统设置读取，其次读取环境变量（见 `backend/.env.example`）：

- `TELEGRAM_BOT_TOKEN`：BotFather 创建机器人后获取。
- `TELEGRAM_ALLOWED_USER_IDS`：可选，逗号分隔的 Telegram `user_id`；留空表示对所有人开放。

### 1.2 机器人调用本服务 API（/stock、/buy）

机器人会通过 HTTP 调用本服务的“购买相关接口”，用于查询库存、创建订单、轮询订单状态：

- `TELEGRAM_INTERNAL_API_BASE_URL`：本服务 API 地址（示例：`http://127.0.0.1:3000` 或 `http://127.0.0.1:3000/api`）。
  - 若未以 `/api` 结尾，机器人会自动补全为 `.../api`。
  - 默认值：`http://127.0.0.1:${PORT}/api`（`PORT` 默认 3000）。
- `TELEGRAM_INTERNAL_API_TIMEOUT_MS`：请求超时，默认 `12000` ms。

### 1.3 /buy 轮询参数（可选）

- `TELEGRAM_BUY_POLL_INTERVAL_MS`：轮询间隔，默认 `5000` ms（最小 1500）。
- `TELEGRAM_BUY_POLL_TIMEOUT_MS`：轮询总超时，默认 `35` 分钟。
- `PURCHASE_ORDER_EXPIRE_MINUTES`：订单有效期（提示文本使用），默认 `15` 分钟。

### 1.4 /buy 购买链接兜底（可选）

当机器人无法正常走“创建订单”流程时，会返回网页购买链接：

优先级：`PURCHASE_URL` > `PURCHASE_LINK` > `${PUBLIC_BASE_URL}/purchase`

## 2) 指令一览

普通用户（如配置了 `TELEGRAM_ALLOWED_USER_IDS` 则需在白名单内）：

- `/start`、`/help`：查看可用指令。
- `/stock`：查询今日剩余库存（会调用本服务 API）。
- `/buy`：购买（默认支付宝），会引导输入邮箱并创建订单（会调用本服务 API）。
- `/redeem`：兑换（依次输入邮箱、通用兑换码）。
- `/cancel`：取消当前流程。

管理员绑定（用于识别 `super_admin` 权限）：

- `/admin auth <username_or_email> <api_key>`：将当前 Telegram 账号绑定到站内用户（仅私聊）。
  - `api_key` 为系统“自动上车 API Key”（即对外开放 API 使用的 `x-api-key`）。

仅 `super_admin`（完成绑定后生效）：

- `/random_activate`：随机激活账号（调用外部 SSE 服务）。
- `/activate <checkout_url> [activate_code]`：指定激活账号（调用外部 SSE/HTTP 服务）。

## 3) /stock（调用本服务 API）

- 调用：`GET {TELEGRAM_INTERNAL_API_BASE_URL}/purchase/meta`
- 用途：读取 `availableCount/productName/amount/serviceDays` 等字段并返回给用户。

## 4) /buy（调用本服务 API）

仅支持私聊，流程如下：

1. 查询库存：`GET /purchase/meta`（同 /stock）。
2. 让用户回复邮箱（正则校验）。
3. 创建订单：`POST /purchase/orders`
   - 请求体：`{"email":"name@example.com","type":"alipay"}`
   - 返回：`orderNo/payUrl/img` 等；机器人会发送支付链接与付款码图片（如有）。
4. 轮询订单状态：`GET /purchase/orders/:orderNo?email=<email>`
   - 当 `status=paid` 时结束并提示邀请状态/发货情况。
   - 当 `status=expired/failed/refunded` 时结束并提示原因。
   - 超时或连续错误过多会停止轮询并提示用户去网页“查询订单”页查看。

## 5) /redeem（站内兑换逻辑）

仅支持私聊，流程如下：

1. `/redeem` 后要求输入邮箱。
2. 再输入兑换码（格式：`XXXX-XXXX-XXXX`）。
3. 后端在站内执行通用渠道兑换（`channel=common`），返回邀请状态与提示信息。

## 6) /random_activate 与 /activate（调用外部 API）

这两个指令会调用“外部激活服务”，并通过 SSE（`text/event-stream`）实时刷新进度消息。

### 6.1 /random_activate

- 请求：`GET {TELEGRAM_RANDOM_ACTIVATE_SSE_URL}`
- Header：`x-api-key: {TELEGRAM_RANDOM_ACTIVATE_API_KEY}`
- 默认 URL：`http://127.0.0.1:8000/api/team/accounts/random/checkout/sse`
- SSE 事件（机器人会处理）：
  - `selected`：返回选中的账号信息（会展示邮箱等）
  - `progress`：进度更新
  - `result`：最终结果（`success`/`card` 等）

### 6.2 /activate

- 请求：`POST {TELEGRAM_ACTIVATE_SSE_URL}`
- Header：`x-api-key: {TELEGRAM_ACTIVATE_API_KEY}`（若未设置，会尝试复用 `TELEGRAM_RANDOM_ACTIVATE_API_KEY`）
- Body：`{"checkout_url":"...","activate_code":"...（可选）"}`
- 默认 URL：`http://127.0.0.1:8000/api/payments/checkout`
- 响应：
  - 若为 `text/event-stream`：处理 `selected/progress/message/result/done` 事件
  - 否则：尝试解析 JSON（解析失败则作为文本错误展示）

## 7) 常见问题

- Bot 未启动：检查是否配置了 `TELEGRAM_BOT_TOKEN`（后台系统设置优先）。
- /buy 无法创建订单：通常是支付未配置（ZPAY 参数缺失）或 `TELEGRAM_INTERNAL_API_BASE_URL` 配置错误。
- 管理员指令不可用：需先用 `/admin auth ...` 绑定 Telegram 账号到站内用户，并确保该用户具备 `super_admin` 角色。

