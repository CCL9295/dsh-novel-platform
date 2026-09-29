# dsh-novel-platform

[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的网文写作平台插件 —— 一个完整的自包含第三方 bundle：**一条命令安装**，不改任何官方文件。

## 功能

- **写作台面板**：dsh Web UI 侧边栏新增"写作台"入口，管理作品、章节、角色卡、大纲；章节编辑器带中文字数统计与状态流转（大纲 → 草稿 → 已修订 → 已发布）。
- **Agent 工具**：9 个 `novel_*` 原生工具（`novel_list` / `novel_create` / `novel_overview` / `novel_chapter_read` / `novel_chapter_write` / `novel_chapter_set_status` / `novel_character_set` / `novel_outline_set` / `novel_set_status`），让 dsh 里的 AI 直接在对话中创作、续写、维护设定一致性，与写作台共享同一份数据。
- **网文写作技能**：内置 16 个写作技能（人设工程、世界观、节奏、爽点、情绪、文风、商业化、合规、去 AI 味等），启动时注册到 `ctx.skills`，模型与用户均可调用。
- **数据持久化**：`~/.dsh/novel-platform/` 下的 JSON 存储，队列化写入 + 临时文件原子替换，工具与面板并发安全。
- **自带 Remote namespace**：`novel` 命名空间由插件浏览器半侧通过 `ctx.remote.$mount()` 自行挂载，无需修改官方 `api-remotes` facade。

## 安装

已安装 `dsh` CLI 的用户：

```sh
# npm（发布后）：dsh plugin add @ccl9295/dsh-novel-platform
# tarball：dsh plugin add ./ccl9295-dsh-novel-platform-0.1.0.tgz
# 本地路径：
dsh plugin --profile <name> add /path/to/dsh-novel-platform
```

重启 dsh，侧边栏出现"写作台"。卸载：`dsh plugin --profile <name> remove @ccl9295/dsh-novel-platform`。

## 从源码构建

```sh
pnpm install
pnpm run build    # node scripts/build.mjs → lib/index.js + lib/client.js
```

构建完全自包含（rolldown + lightningcss，见 `scripts/build.mjs`）：

- `lib/index.js` —— Host 半侧（ESM，`@deepseek-ai/*` peers 与 zod 留给宿主解析；`@Remote` 控制器注解按 dsh typertPlugin 同款方式经 TypeScript transpile 降级）。
- `lib/client.js` —— 浏览器半侧，按客户端模块系统的 lazy-CJS factory 格式产出（`window.__ModuleLoader__.load({id, factory})`），externals 严格限定平台基座（react / cordis / dsh-client-ui-*），CSS Modules 由 lightningcss 编译并注入 factory 闭包。
- `lib/typert.*` —— 确定性生成产物（来自 `generated/`，构建时把包名重印为本包名）。

**修改 Remote wire 面后重新生成 typert 产物**：在一份 dsh monorepo checkout 内（本包以同名包放入 `packages/extensions/novel-platform/`）跑一次全仓 `tsdown --env.DSH_BUILD_FACE host`，把 `lib/typert.*` 复制回 `generated/` 并提交。

### 目录结构

```
├── package.json            # dsh.bundle（cordis.patch.yml）+ dsh.client 声明
├── cordis.patch.yml         # bundle 行：挂载 host + 浏览器半侧
├── scripts/build.mjs        # 自包含构建（host + client factory 复刻）
├── generated/               # typert 生成产物（提交）
├── src/
│   ├── index.ts             # Host 插件入口（tools + skills + store + controller）
│   ├── types.ts             # 线格式词汇
│   ├── store.ts             # NovelStoreService（JSON 持久化）
│   ├── controller.ts        # NovelController（TypertRemoteService）
│   ├── tools.ts             # novel_* 工具
│   ├── skills.ts            # 技能集注册（frontmatter 解析）
│   ├── virtual-contribution.d.ts / remote-merge.d.ts
│   └── client/              # 浏览器半侧（React + CSS Modules + slots）
│       ├── index.ts         # $mount 自挂载 + 面板注册（ctx.inject 等 namespace）
│       ├── NovelPage.tsx    # 写作台页面
│       ├── face.ts          # NovelFace
│       └── locales.ts       # zh / en 字典
└── resources/skills/        # 16 个网文写作技能
```

## 实现要点（给 dsh 插件作者的参考）

- **第三方包不能改官方 `api-remotes` facade**：remote namespace 用插件自己的浏览器半侧 `ctx.remote.$mount(contribution)` 挂载（Gateway 的公开扩展缝）。
- **`$mount` 必须避开 entry 激活窗口**：同步 mount 会让 Gateway 在 boot 激活期创建 namespace 的动态插件 fiber，与初始模块组合互相等待死锁。推迟一个宏任务（`setTimeout(…, 0)`）即可；重载竞态的 `already mounted` 拒绝需吞掉。
- **`remote.<ns>` 是扁平服务键**：面板注册放进 `ctx.inject(['remote.novel'], (child) => …)` 的子上下文，face 在 child 上取 `ctx.remote.novel`。
- **client bundle 的 externals 限定平台基座**：`PLATFORM_MODULES`（react、react/jsx-runtime、react-dom、react-dom/client、@deepseek-ai/cordis、dsh-client-store、dsh-client-ui-slots、dsh-client-ui-primitives、dsh-client-ui-dockkit）之外的一律打进 bundle（包括 zod）。
- **`@Remote` 是 stage-3 标准装饰器**（context.addInitializer 语义）：oxc 的 legacy decorator 降级不兼容，构建时用 `ts.transpileModule` 降级（产物形状 `__esDecorate`）。

## 技能署名

`resources/skills/` 中的写作技能来自 [CharacterArc（弧光）](https://github.com/uu201/character-arc) 的 `Distilled-Novel-Toolbox` 与社区技能集（MIT License），按原样内置并保留其许可声明。其中 `novel-anti-detection`（平台反检测）未收录。

## License

MIT
