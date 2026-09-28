# dsh-novel-platform

[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的网文写作平台插件 —— "一切皆插件"架构下的一个完整双半侧（Host + Browser）插件示例与实用工具。

## 功能

- **写作台面板**：dsh Web UI 侧边栏新增"写作台"入口，管理作品、章节、角色卡、大纲；章节编辑器带中文字数统计与状态流转（大纲 → 草稿 → 已修订 → 已发布）。
- **Agent 工具**：9 个 `novel_*` 原生工具（`novel_list` / `novel_create` / `novel_overview` / `novel_chapter_read` / `novel_chapter_write` / `novel_chapter_set_status` / `novel_character_set` / `novel_outline_set` / `novel_set_status`），让 dsh 里的 AI 直接在对话中创作、续写、维护设定一致性，与写作台共享同一份数据。
- **网文写作技能**：内置 16 个写作技能（人设工程、世界观、节奏、爽点、情绪、文风、商业猴、合规、去 AI 味等），启动时注册到 `ctx.skills`，模型与用户均可调用。
- **数据持久化**：`~/.dsh/novel-platform/` 下的 JSON 存储，队列化写入 + 临时文件原子替换，工具与面板并发安全。

## 安装（源码叠加方式）

本仓库是 **dsh monorepo 的源码叠加包**：client bundle 构建依赖 monorepo 内部的 `clientBundle` 预设与 workspace 依赖，因此以"拷贝进 monorepo + 三处集成改动"的方式安装。

### 1. 拷贝插件包

```bash
git clone https://github.com/<you>/dsh-novel-platform.git
cp -r dsh-novel-platform/ <dsh>/packages/extensions/novel-platform
```

### 2. 挂载到 web-app bundle

在 `<dsh>/packages/bundle/web-app/cordis.patch.yml` 的浏览器 roster `insert:` 列表中（`ui-cordis` 行之后）加入：

```yaml
    # Web novel writing platform: agent tools, writing skills, the
    # `novel` Remote namespace, and the sidebar's Writing Desk panel.
    - id: novel-platform
      name: '@deepseek-ai/dsh-novel-platform'
```

同时在 `<dsh>/packages/bundle/web-app/package.json` 的 `dependencies` 加入：

```json
"@deepseek-ai/dsh-novel-platform": "workspace:*"
```

### 3. 挂载 Remote namespace

`<dsh>/packages/api/remotes/src/client/index.ts` 三处改动：

```ts
import novelRemote from '@deepseek-ai/dsh-novel-platform/remote'   // import 区
export type {} from '@deepseek-ai/dsh-novel-platform/remote'       // type 再导出区
// apply() 的 mount 数组末尾：
officeToPdfRemote, novelRemote,
```

`<dsh>/packages/api/remotes/package.json` 的 `devDependencies` 加入：

```json
"@deepseek-ai/dsh-novel-platform": "workspace:*",
"zod": "^4.4.3"
```

> `zod` 是 typert 生成产物的运行时依赖；不声明会导致 client bundle 构建时把它留成 external，浏览器端报 `require("zod") missed the module table`。

### 4. 接入构建

`<dsh>/tsconfig.host.json` 的 `references` 加入：

```json
{ "path": "./packages/extensions/novel-platform/tsconfig.host.json" }
```

`<dsh>/tsconfig.client.json` 的 `references` 加入：

```json
{ "path": "./packages/extensions/novel-platform/tsconfig.client.json" }
```

include 数组加入 CSS module 声明：

```json
"packages/extensions/novel-platform/src/css-modules.d.ts",
```

### 5. 构建并启动

```bash
pnpm install --ignore-scripts
node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc -b tsconfig.host.json   # 全仓 host tsc
./node_modules/.bin/tsdown --env.DSH_BUILD_FACE host                                     # 生成 typert.* 产物
node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc -b tsconfig.client.json # 全仓 client tsc
./node_modules/.bin/tsdown --env.DSH_BUILD_FACE client                                   # 全部 client bundle
pnpm run build:web                                                                       # Vite 前端
pnpm dsh web                                                                             # 启动，打开输出的带 token URL
```

启动后侧边栏即出现"写作台"。

## 目录结构

```
├── package.json            # 双半侧声明（exports + dsh.client）
├── tsconfig.json           # dual-face 入口（host + client 两个 project reference）
├── tsconfig.host.json      # Host face：store / controller / tools / skills
├── tsconfig.client.json    # Client face：写作台面板
├── tsdown.config.ts        # clientBundle 预设（monorepo 内相对路径）
├── src/
│   ├── index.ts            # Host 插件入口（apply）
│   ├── types.ts            # 线格式词汇（NovelRow / ChapterRow / ...）
│   ├── store.ts            # NovelStoreService（JSON 持久化）
│   ├── controller.ts       # NovelController（TypertRemoteService，namespace `novel`）
│   ├── tools.ts            # novel_* 工具注册
│   ├── skills.ts           # 弧光技能集注册（frontmatter 解析 + ctx.skills.register）
│   └── client/             # 浏览器半侧（React + CSS Modules + slots）
│       ├── index.ts        # main 面板 + sidebar.panellist 注册
│       ├── NovelPage.tsx   # 写作台页面
│       ├── face.ts         # NovelFace（Remote 调用封装）
│       └── locales.ts      # zh / en 字典
└── resources/skills/       # 16 个网文写作技能（SKILL.md + references）
```

## 技能署名

`resources/skills/` 中的写作技能来自 [CharacterArc（弧光）](https://github.com/uu201/character-arc) 的 `Distilled-Novel-Toolbox` 与社区技能集（MIT License），按原样内置并保留其许可声明。其中 `novel-anti-detection`（平台反检测）未收录。

## License

MIT
