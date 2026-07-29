# Markdown 小助手

一个纯前端 Markdown 编辑、实时预览与导出工具。项目不依赖后端服务，同时支持 Cloudflare Workers Static Assets 和 Cloudflare Pages。

## 已部署地址

- Cloudflare Workers Static Assets：<https://simimd.877781132.workers.dev/>
- Cloudflare Pages：<https://simimd.pages.dev/>

## 真正一键部署到自己的 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SimiTalk/PC_SimiTlakTools/tree/cfpage)

点击按钮后，Cloudflare 会自动完成以下流程：

1. 登录并选择自己的 Cloudflare 账号。
2. 将本仓库的 `cfpage` 分支 Clone/Fork 到点击者自己的 GitHub 或 GitLab 账号。
3. 自动识别 `package.json` 中的 `build`、`deploy` 命令和 `wrangler.jsonc`。
4. 执行 `npm run build`，将静态文件输出到 `dist/`。
5. 通过 Workers Static Assets 部署到点击者自己的 Cloudflare 账号。

不需要手工填写构建目录、上传压缩包或创建 Pages 项目。Wrangler 使用 `wrangler.jsonc` 中的 `assets.directory = "./dist"` 直接发布静态网站。

> 真正的一键按钮使用 **Cloudflare Workers Static Assets**，不是 Cloudflare Pages。Cloudflare 官方 Deploy to Cloudflare 按钮目前只支持 Workers 应用；按钮会自动完成仓库复制、Workers Builds 配置和首次部署。参考：[Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/configuration/deploy-button/) 与 [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)。

> 要让任何人都能使用此按钮，远端必须已经存在 `cfpage` 分支，并且源仓库必须是 Public。Cloudflare 官方按钮不支持向其他用户分享 Private Repository。

## 仍然使用 Cloudflare Pages

Pages 版本已经部署在 <https://simimd.pages.dev/>。如果希望把项目部署成自己账号下的 Pages 项目，Cloudflare 当前最短流程仍然是 Fork → Pages Import：

1. [![Fork this repository](https://img.shields.io/badge/1._Fork-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/SimiTalk/PC_SimiTlakTools/fork)
2. 创建 Fork 时不要勾选 **Copy the main branch only**，确保 `cfpage` 分支也被复制。
3. [![Import into Cloudflare Pages](https://img.shields.io/badge/2._Import-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/github) 点击后登录自己的 Cloudflare 账号。
4. 在 Pages 导入页选择自己 GitHub 账号下的仓库副本，并使用以下配置：

| 配置项 | 值 |
| --- | --- |
| Git 仓库 | `<你的 GitHub 用户名>/PC_SimiTlakTools` |
| Production branch | `cfpage` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/`（仓库根目录） |

确认后点击 **Save and Deploy**。后续推送到副本的 `cfpage` 分支会自动触发 Pages 生产部署，其他分支会生成 Preview Deployment。

## 本地运行

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

`npm run dev` 会构建 `dist/`，然后启动 Workers Static Assets 本地开发服务器。

如需使用 Pages 本地运行模式：

```bash
npm run dev:pages
```

## 命令行部署

登录 Cloudflare：

```bash
npm install
npx wrangler login
```

部署为 Workers Static Assets：

```bash
npm run deploy
```

部署到已经创建的 `simimd` Pages 项目：

```bash
npm run deploy:pages
```

## 构建与测试

```bash
npm run build
npm test
```

构建结果位于 `dist/`，其中包含：

- `index.html`：默认站点入口。
- `css/`、`js/`、`imgage/`：静态资源。
- `_headers`：Workers Static Assets 与 Pages 响应安全头、缓存策略。
- `_redirects`：将旧入口 `/md.html` 永久重定向到 `/`。

默认 Cloudflare 配置保存在 `wrangler.jsonc`，使用 Workers Static Assets 发布 `./dist`。Pages 可继续通过 `npm run deploy:pages` 部署。
