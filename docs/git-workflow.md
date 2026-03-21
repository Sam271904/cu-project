# Git 远程协作（简要）

适用于已配置 `origin`（例如 `https://github.com/.../cu-project.git`）后的日常操作。

## 首次克隆（另一台机器）

```bash
git clone https://github.com/<你的账号>/cu-project.git
cd cu-project
npm install
```

## 日常：提交并推送到远程

```bash
git status                    # 查看变更
git add -A                    # 或只 add 需要的文件
git commit -m "描述本次改动"
git pull --rebase origin master   # 推送前先拉取，减少冲突（分支名可能是 main）
git push origin master
```

若远程默认分支是 `main`，把上面命令里的 `master` 换成 `main`。

## 建议：功能分支（可选）

```bash
git checkout -b feat/short-name
# ... 开发与本地测试 ...
git push -u origin feat/short-name
```

然后在 GitHub/GitLab 上开 Pull Request 合并到 `main`/`master`。

## 与实施计划（`docs/superpowers/plans/*.md`）的关系

计划里的 **「Step N: Commit」** 表示**该里程碑适合做一次提交**的提醒，不要求每一步都单独 commit；可按你的习惯把多项改动合并成一次或多次提交。

## 提交前自检（本仓库）

```bash
npm run build
npm test
```

根目录 `package.json` 的 workspaces 会依次构建/测试 `shared`、`backend`、`frontend`（若配置了脚本）。
