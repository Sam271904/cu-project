# 项目操作文档（本地运行/回归/发布/运维）

本文面向日常维护，覆盖从本地启动到发布后排障的常用操作。

非研发同学可优先阅读精简版：`docs/operations-manual-non-dev.md`。

## 1. 项目结构与前置条件

- 根目录工作区：`backend`、`frontend`、`shared`
- Node.js：建议使用当前 LTS
- 包管理：`npm`（workspace 模式）

首次拉起：

```bash
npm install
```

## 2. 环境变量

### 开发环境

- 参考根目录 `.env.example`
- 最小可运行变量通常为：
  - `DATABASE_URL=sqlite:./data/dev/app.db`
  - `PORT=3001`

### 本地生产发布环境

- 使用根目录 `.env.production`
- 当前已提供本地可运行默认值：
  - `DATABASE_URL=sqlite:./data/release/app.db`
  - `PORT=3002`
- E2E 独立环境（由脚本注入）：
  - `DATABASE_URL=sqlite:./data/e2e/playwright.db`
  - `PORT=3456`

## 3. 开发常用命令

在根目录执行：

| 场景 | 命令 | 说明 |
|---|---|---|
| 启动后端开发服务 | `npm run dev` | 实际执行 `backend` 的 `ts-node src/server.ts` |
| 全量构建 | `npm run build` | 构建 `shared`/`backend`/`frontend` |
| 全量测试 | `npm run test` | 运行 workspace 测试（当前主要 backend/shared） |
| 仅前端构建 | `npm run build -w @e-cu/frontend` | 产物到 `frontend/dist` |
| 仅后端测试 | `npm run test -w @e-cu/backend` | 后端 Vitest |

访问地址（默认）：

- 开发环境：`http://127.0.0.1:3001/`
- 发布环境（PM2）：`http://127.0.0.1:3002/`
- 健康检查：`/health`

## 4. 回归与验收

### 脚本化回归

- 快速回归：`npm run release:check`
- 完整回归（含 E2E）：`npm run release:all`
- 仅 E2E：`npm run release:e2e`

平台脚本：

- Windows：`.\scripts\release-regression.ps1`
- Linux/macOS：`./scripts/release-regression.sh`

详细清单见：`docs/release-regression-checklist.md`

## 5. 本机发布（PM2）

### 一键发布（推荐）

```bash
npm run deploy:local
```

该命令会依次执行：

1. `release:all`（build + test + e2e）
2. `pm2:start:local`（构建前端并启动 PM2 进程）

### PM2 日常运维

| 操作 | 命令 |
|---|---|
| 启动/更新 | `npm run pm2:start:local` |
| 重启 | `npm run pm2:restart:local` |
| 停止 | `npm run pm2:stop:local` |
| 删除进程 | `npm run pm2:delete:local` |
| 查看日志 | `npm run pm2:logs:local` |
| 查看状态 | `npx pm2 status e-cu-local` |

开发环境也可使用 PM2（可与发布环境并存）：

| 操作 | 命令 |
|---|---|
| 启动/更新开发服务 | `npm run pm2:start:dev` |
| 重启开发服务 | `npm run pm2:restart:dev` |
| 停止开发服务 | `npm run pm2:stop:dev` |
| 删除开发进程 | `npm run pm2:delete:dev` |
| 查看开发日志 | `npm run pm2:logs:dev` |
| 查看开发状态 | `npx pm2 status e-cu-dev` |

### 发布后检查

```bash
curl -s http://127.0.0.1:3001/health
```

期望输出：

```json
{"status":"ok"}
```

说明：发布环境使用端口 `3002`，与开发端口 `3001` 隔离，避免互相干扰。

## 6. 常见问题与处理

### 1) 页面打不开

- 先看 PM2 状态：`npx pm2 status e-cu-local`
- 再看日志：`npm run pm2:logs:local`
- 检查端口是否与 `.env.production` 一致

### 2) 回归失败

- 优先看失败命令的最后输出
- 若 E2E 失败：检查 `playwright-report/`，必要时加 `PWDEBUG=1`

### 3) 数据库文件不一致

- 开发默认库：`data/dev/app.db`
- 发布默认库：`data/release/app.db`
- E2E 独立库：`data/e2e/playwright.db`

## 7. 建议操作顺序（稳妥版）

1. 代码变更完成后：`npm run release:check`
2. 发布前：`npm run release:all`
3. 发布：`npm run deploy:local`
4. 验证：访问首页 + `health` + 手工点测 5 项

