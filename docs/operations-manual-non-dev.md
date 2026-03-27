# 项目操作手册（非研发同学精简版）

这份文档只保留最少操作，目标是：**可以发布、会检查、出问题能定位**。

## 1) 发布前准备（1 次）

确认根目录存在 `.env.production`，至少包含：

```env
DATABASE_URL=sqlite:./data/release/app.db
PORT=3002
```

## 2) 一键发布（核心命令）

在项目根目录执行：

```bash
npm run deploy:local
```

它会自动完成：

1. 构建
2. 单元测试
3. E2E 测试
4. 启动 PM2 服务

## 3) 发布后检查（2 分钟）

打开这两个地址（发布环境）：

- 首页：`http://127.0.0.1:3002/`
- 健康检查：`http://127.0.0.1:3002/health`

健康检查返回 `{"status":"ok"}` 即正常。

## 4) 日常运维（只记这 4 条）

```bash
npm run pm2:restart:local   # 重启服务
npm run pm2:stop:local      # 停止服务
npm run pm2:logs:local      # 查看日志
npx pm2 status e-cu-local   # 查看状态（online = 正常）
```

## 5) 出问题时怎么做

### A. 页面打不开

1. 执行：`npx pm2 status e-cu-local`
2. 如果不是 `online`，执行：`npm run pm2:restart:local`
3. 仍有问题，执行：`npm run pm2:logs:local` 并把报错发给研发

### B. 发布命令失败

发布命令是 `npm run deploy:local`。  
把终端里**最后一段报错**截图发给研发（最有用）。

## 6) 给研发的信息模板

反馈问题时请带上：

- 操作时间
- 执行命令（例如 `npm run deploy:local`）
- 报错截图（最后 30 行）
- `http://127.0.0.1:3001/health` 的返回结果
- `http://127.0.0.1:3002/health` 的返回结果

---

需要完整版本（开发/测试/排障细节），见：`docs/operations-manual.md`。
