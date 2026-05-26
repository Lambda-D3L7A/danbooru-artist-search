# Danbooru 画师筛选

[English](README.en.md) · 中文

[![Release](https://img.shields.io/github/v/release/Lambda-D3L7A/danbooru-artist-search?display_name=tag)](https://github.com/Lambda-D3L7A/danbooru-artist-search/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Lambda-D3L7A/danbooru-artist-search/release.yml)](https://github.com/Lambda-D3L7A/danbooru-artist-search/actions)
[![License](https://img.shields.io/github/license/Lambda-D3L7A/danbooru-artist-search)](LICENSE)

一个用于**快速筛选 Danbooru 画师**的 Electron 桌面应用。每个画师配代表作缩略图，一眼判断画风；挑中后可一键复制为 [Anima](https://huggingface.co/circlestone-labs/Anima) 模型所需的 `@画师名` 提示词格式。点开大图自动显示分类好的 Danbooru 标签，整张作品的提示词也能一键复制。

适合给 Anima 等基于 Danbooru tag 的图像生成模型攒画师 tag、扒提示词。

---

## 功能

### 画师发现
- **最近更新**：扫描 Danbooru 最新作品，按最近活跃顺序排列画师（默认）
- **搜索画师**：输入名字搜，**带 Danbooru 官方自动补全**（↑/↓/Enter/Esc 键控）
- **随机发现**：随机抽画师，挖冷门
- **按题材 tag**：指定题材或角色 tag，列出画该题材的画师；同样**带 tag 自动补全**（显示作品数和类别：general / character / copyright / meta）
- **导入名单**：粘贴一批画师名逐一拉图

### 网格主视图
- 自适应卡片，每张卡片显示 **4 张代表作**（按 score 排序，自动避开 Cloudflare 反爬）
- **批量勾选**：点卡片任意位置或勾选框选中，底部出现操作栏
  - **复制为 Anima 格式**：自动转换 `nnn_yryr` → `@nnn yryr`（小写、下划线转空格、逗号连接）
  - **加入收藏夹**：弹出分组选择，可建新组
  - 清空选择
- **无限滚动**：向下滚动自动加载更多，状态栏显示进度

### 画师主页（点画师名进入）
- 显示该画师全部作品，瀑布式网格 + **「加载更多」分页**
- 顶部固定栏：收藏、复制为 Anima、在 Danbooru 打开
- 返回时**保留列表原滚动位置**，无需重新滚

### 大图弹窗（点缩略图）
- 自动加载大图（`large_file_url`，约 850 px 高清），加载期间显示「加载中…」
- **右侧标签面板**自动展示该 post 的 Danbooru 标签，分类整齐：
  - `character` · `copyright` · `artist` · `general` · `meta`
- **点 chip 复制单个 tag**（artist 自动加 `@` 并 Anima 化）
- 底部两个按钮：
  - **复制为 Anima 提示词**：character → copyright → @artist → general → meta，全部按 Anima 格式拼好
  - **复制全部（原样）**：保留下划线的原 Danbooru tag，方便直接当搜索串

### 收藏夹
- 分组管理，**按字母排序**
- 顶部**搜索框**实时过滤
- 每个收藏画师下方显示 **4 张代表作缩略图**（懒加载 + 缓存，点开看大图）
- 每组单独复制为 Anima，整库一键复制
- 持久化存在 Electron 的 `userData` 目录

### 体验细节
- 固定顶栏与选择栏，**滚动时永不消失**
- 列表 / 画师页 / 弹窗各自独立滚动
- 点击过渡动画：弹窗淡入、收藏夹滑入、卡片按压反馈、缩略图悬停微放大
- 内置 Danbooru API 速率节流（≤ 8 req/s）+ 429 自动退避 + 410 友好提示
- 支持 Danbooru 账号 API Key（自动把 UID 换算成用户名）

---

## 安装与使用

### 方式 A：下载安装版（推荐）

到 [Releases](https://github.com/Lambda-D3L7A/danbooru-artist-search/releases) 下载最新版的 `danbooru-artist-search-x.y.z-setup.exe`，双击安装即可。

### 方式 B：从源码运行

需要 Node.js ≥ 18。

```bash
git clone https://github.com/Lambda-D3L7A/danbooru-artist-search.git
cd danbooru-artist-search
npm install
npm start
```

#### 免命令行启动

- 双击桌面快捷方式（安装版自动创建）
- 或双击项目内的 `启动.vbs`（静默，无控制台窗口）/ `启动.bat`（带窗口）

### 配置 API Key（可选）

点右上角 ⚙：

- **用户名 (login)**：你的 Danbooru **登录名**（不是数字 UID；填 UID 时「测试连接」会自动换算）
- **API Key**：在 Danbooru 个人资料页点「Generate API key」生成

填好点「测试连接」验证（绿字 = 通过），保存即可。**不填也能匿名使用**，只是速率上限较低。

---

## 工作流示例

1. 打开应用 → 默认列出**最近活跃的画师**
2. 滚动浏览 → 看到喜欢的就**勾选**；不感兴趣继续滚
3. 想看某画师全部作品 → **点画师名**进入主页
4. 点缩略图看大图 → 右侧自动显示 **Danbooru 完整标签**，挑感兴趣的 chip 点一下就复制
5. 收集够了 → 点底部**「复制为 Anima 格式」** → 粘到 Anima 提示词里
6. 同时勾选的画师可一键**加入收藏夹**，分组保存，下次继续

---

## 技术说明

- **Electron**：主进程负责 Danbooru API 调用与本地存储（`userData/`），渲染进程负责 UI
- **图片代理**：`cdn.donmai.us` 的 Cloudflare 会拦截浏览器 UA 的图片请求 → 缩略图与大图统一通过主进程的 `dimg://` 协议用自定义 UA 抓取，规避封锁
- **速率限制**：遵守 Danbooru 读请求 ≤ 10 / 秒，内置全局节流（~7.7 / 秒）+ 429 自动退避重试 + 410 友好提示
- **数据流**：tags.json（画师列表）→ posts.json per artist（代表作 + 完整 tag 字段）→ 主进程 IPC → 渲染进程网格

## 项目结构

```
main.js              主进程：Danbooru API、图片代理、IPC、本地存储
preload.js           IPC 桥接（contextBridge）
renderer/
  index.html         界面结构
  styles.css         样式
  renderer.js        交互：来源/搜索/网格/收藏/画师页/大图弹窗
build/
  icon.png / icon.ico  应用图标
.github/workflows/
  release.yml        打 tag 自动构建并发版
启动.vbs / 启动.bat   快速启动脚本
```

## 开发与发布

```bash
# 开发
npm start

# 本地打包（不发布）
npm run pack      # 仅产出 dist/win-unpacked
npm run dist      # 产出完整 NSIS 安装包

# 发布新版本
# 1. 在 CHANGELOG.md 顶部加新版本说明
# 2. 升版本号
npm version 0.1.x --no-git-tag-version
# 3. 提交并打 tag
git add . && git commit -m "Release v0.1.x"
git tag v0.1.x
git push && git push origin v0.1.x
# CI 自动构建并创建 Release
```

详见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

[MIT](LICENSE)
