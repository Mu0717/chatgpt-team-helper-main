# 支付（ZPAY）功能启用指南

本功能包含：
- 用户侧 `/purchase`（商品列表）与下单流程
- 支付回调 `/notify`（无 `/api` 前缀兼容入口）与 `/api/purchase/notify`
- 管理后台「支付订单」：`/admin/purchase-orders`

## 1) 开启功能开关

- 进入管理后台：`/admin/settings`
- 在「功能开关」中启用「支付（ZPAY）」

禁用时相关页面与接口会返回 `403`（`FEATURE_DISABLED`）。

## 2) 配置 ZPAY 参数

推荐在管理后台配置并入库：
- 进入：`/admin/settings` →「ZPAY 支付配置」
- 填写：
  - `ZPAY_BASE_URL`
  - `ZPAY_PID`
  - `ZPAY_KEY`

## 3) 配置公网回调域名（生产环境强烈建议）

支付平台会回调 `notify_url`，需公网可访问。

后端用于生成回调地址的优先级：
- `backend/.env` 的 `PUBLIC_BASE_URL`（推荐明确配置）
- 未配置时：从请求头推导（反向代理场景可能不稳定）

## 4) 可选：调整商品与订单参数

商品/订单相关环境变量见 `backend/.env.example` 的「支付 / 购买（可选）」段落（例如 `PURCHASE_PRICE`、`PURCHASE_SERVICE_DAYS` 等）。

## 5) 验证

- 访问：`/purchase`
- 下单并完成支付
- 在管理后台查看订单：`/admin/purchase-orders`
