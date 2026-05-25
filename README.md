# Danbooru 画师筛选 (Danbooru Artist Search)

一个用于**快速筛选 Danbooru 画师**的 Electron 桌面应用。每个画师配代表作缩略图，一眼判断画风，挑中后可一键复制为 [Anima](https://huggingface.co/circlestone-labs/Anima) 模型所需的 `@画师名` 提示词格式。

> 适合给 Anima 等基于 Danbooru tag 的图像生成模型攒画师 tag。

## 功能

- **多种画师来源**
  - 最近更新：扫描最新作品，按最近活跃顺序列出画师
  - 搜索画师：输入名字搜索，带自动补全联想
  - 随机发现：随机抽画师，挖冷门
  - 按题材 tag：指定题材/角色，找画该题材的画师
  - 导入名单：粘贴一批画师名逐一拉图
- **网格总览 + 批量勾选**：每张卡片显示 4 张代表作，批量选中
- **一键复制为 Anima 格式**：自动转换 `nnn_yryr` → `@nnn yryr`（小写、下划线转空格、逗号连接）
- **收藏夹**：分组管理、字母排序、搜索过滤、每个收藏显示代表作缩略图
- **画师主页**：点画师名进入，无限滚动浏览其全部作品，点图看大图
- **无限滚动**：列表向下滚动自动加载更多
- **API Key 支持**：填入 Danbooru 账号可提升速率上限、看到更全内容，内置连接测试

## 快速开始

```bash
npm install
npm start
```

### 免命令行启动

- 双击桌面快捷方式「Danbooru画师筛选」（安装时自动创建）
- 或双击项目内的 `启动.vbs`（静默，无控制台窗口）/ `启动.bat`（带窗口）

## 配置 API Key（可选）

点右上角 ⚙ → 填入：

- **用户名 (login)**：你的 Danbooru **登录名**（不是数字 UID；填 UID 时「测试连接」会自动换算）
- **API Key**：在 Danbooru 个人资料页点「Generate API key」生成

填好点「测试连接」验证，再保存。不填也能匿名使用。

## 技术说明

- **Electron**（主进程负责 Danbooru API 调用与本地存储，渲染进程负责 UI）
- **图片代理**：`cdn.donmai.us` 的 Cloudflare 会拦截浏览器 UA 的图片请求，故缩略图/大图统一通过主进程的 `dimg://` 协议用自定义 UA 抓取
- **速率限制**：遵守 Danbooru 读请求 ≤10/秒，内置全局节流（~7.7/秒）+ 429 自动退避重试
- 收藏夹与设置持久化在 Electron 的 `userData` 目录

## 项目结构

```
main.js            主进程：Danbooru API、图片代理、IPC、本地存储
preload.js         IPC 桥接（contextBridge）
renderer/
  index.html       界面结构
  styles.css       样式
  renderer.js      界面逻辑：来源/搜索/网格/收藏/画师页/无限滚动
启动.vbs / 启动.bat  快速启动脚本
```

## 许可

MIT
