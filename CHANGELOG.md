# Changelog

## [v0.1.1] - 2026-05-26

### 新功能 / Added
- **大图弹窗显示 Danbooru 标签** — 点缩略图后右侧弹出分类标签面板（character / copyright / artist / general / meta），点 chip 复制单个 tag，可一键复制整张图的提示词为 Anima 格式或原样
- **题材 tag 搜索关联** — 「按题材 tag」来源也支持自动补全，显示作品数与类别（general / character / copyright / meta 颜色区分）
- **画师搜索关联** — 「搜索画师」来源新增 Danbooru autocomplete（输入即联想，键盘 ↑/↓/Enter/Esc）
- **收藏夹缩略图** — 每个收藏画师下方显示 4 张代表作（懒加载 + 缓存），点开看大图
- **收藏夹搜索 + 字母排序** — 顶部搜索框实时过滤，组内按字母 A–Z 排
- **「最近更新」来源** — 替换原「热门」，按 Danbooru 最新作品聚合最近活跃画师
- **快速启动** — 桌面快捷方式 + 静默 `启动.vbs` + 带窗口 `启动.bat`
- **MIT LICENSE 和应用图标**（蓝底放大镜）

### 体验改进 / Improved
- 固定顶栏与选择栏，**滚动时永不消失**（布局改用 flex 列 + 独立滚动容器）
- 列表与画师页各自独立滚动，**从画师页返回保留列表原滚动位置**
- 点击过渡动画：弹窗淡入、收藏夹滑入、卡片按压反馈、缩略图悬停微放大
- 勾选/收藏现在只更新对应卡片，避免无限滚动后整页重绘
- 设置弹窗里用户名占位符改为「你的 Danbooru 登录名」

### 修复 / Fixed
- 画师页滚动时顶部条带处会露出作品的 sticky 定位 bug
- electron-builder 在 CI 上 tag push 时自动尝试发布、缺 `GH_TOKEN` 报错（改为 `--publish never`，发布交由 softprops 上传步骤）

## [v0.1.0] - 2026-05-25

### 首发 / Initial release
- Electron 桌面应用，从 Danbooru 拉画师 + 代表作缩略图，一键复制为 Anima 提示词
- 多种画师来源：热门 / 搜索 / 随机 / 按题材 / 导入名单
- 网格批量勾选 + 复制为 `@画师名` Anima 格式
- 画师主页查看全部作品 + 大图查看
- 收藏夹分组管理
- 无限滚动、API Key 支持、图片代理绕过 Cloudflare、速率节流、429/410 错误处理
- Windows NSIS 安装包（通过 GitHub Actions 自动构建发布）
