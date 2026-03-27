# 发布前回归清单（脚本化）

本清单用于在发布/打 tag 前做**可重复**的自动化验证；手工点测项作为补充。  
若需要完整运维手册，见 `docs/operations-manual.md`。

## 一键命令（推荐）

| 场景 | 命令 | 说明 |
|------|------|------|
| **快速回归**（约 1 分钟内） | `npm run release:check` | 全 workspace 构建 + 单元测试（shared / backend） |
| **含 E2E** | `npm run release:all` | `release:check` 后执行 Playwright |
| **仅 E2E** | `npm run release:e2e` | 等价于 `npm run test:e2e`（会拉起 `e2e:server`） |

### Windows（PowerShell）

```powershell
.\scripts\release-regression.ps1
```

可选参数：

```powershell
.\scripts\release-regression.ps1 -SkipE2e      # 只做 build + 单元测试
.\scripts\release-regression.ps1 -E2eOnly      # 仅 E2E（需已构建或依赖 webServer）
```

### Linux / macOS / Git Bash

```bash
chmod +x scripts/release-regression.sh
./scripts/release-regression.sh          # 默认：build + test + e2e
SKIP_E2E=1 ./scripts/release-regression.sh  # 跳过 E2E
```

## 自动化步骤说明

1. **`npm run build`**  
   构建 `shared`、`backend`（tsc）、`frontend`（vite）。

2. **`npm run test`**  
   各 workspace 的 `vitest run`（当前主要为 `shared` + `backend`）。

3. **`npm run test:e2e`**  
   Playwright `e2e/`；`playwright.config.ts` 会通过 `webServer` 启动 `npm run e2e:server`（端口 `3456`，独立 `DATABASE_URL=sqlite:./data/e2e/playwright.db`）。

## 手工补充（脚本无法覆盖）

在本地浏览器打开 `http://127.0.0.1:<PORT>/`（或你配置的端口），建议快速点 5 条：

| # | 路径 | 检查点 |
|---|------|--------|
| 1 | **首页** | 指标区、策略建议、调参回看窗口能加载 |
| 2 | **信源** | 健康卡、`recommendation_message`、静音 1/7/30 天与解除 |
| 3 | **个性化** | 保存规则后首页/搜索排序变化 |
| 4 | **搜索** | 反馈后分数与「反馈影响」行 |
| 5 | **推送**（若启用） | 订阅/Token 提示与 503 提示合理 |

## 环境变量提示

- 若需验证 RSS 限速/重试：见根目录 `.env.example` 中 `PIH_RSS_*`。
- 若需验证推送：需 `PIH_PUSH_ENABLED`、`VAPID_*` 等（见 `.env.example`）。
- 本机 PM2 发布可使用根目录 `.env.production`（已提供本地可运行默认值：`DATABASE_URL`、`PORT`）。
- 环境隔离约定：开发 `3001 + data/dev`，发布 `3002 + data/release`，E2E `3456 + data/e2e`。

## 本机发布（PM2）

1. 准备生产变量（首次）  
   编辑 `.env.production`（至少确认 `DATABASE_URL`、`PORT`）。
2. 一键发布（含回归 + 启动）  
   `npm run deploy:local`
3. 常用运维命令
   - 启动/更新：`npm run pm2:start:local`
   - 重启：`npm run pm2:restart:local`
   - 停止：`npm run pm2:stop:local`
   - 删除进程：`npm run pm2:delete:local`
   - 查看日志：`npm run pm2:logs:local`

## 失败时

- 先看 **最后一条失败命令** 的退出码与输出。
- E2E 失败：查看 `playwright-report/`（若生成）或加 `PWDEBUG=1` 本地调试。
- 数据库：E2E 使用 `data/e2e/playwright.db`，与开发/发布库分离。
