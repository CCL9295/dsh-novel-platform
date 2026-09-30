# dsh-novel-platform

[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的网文写作平台插件 —— 自包含第三方 bundle，一条命令安装，不改任何官方文件。

## 功能

- **写作台面板**：dsh Web UI 侧边栏"写作台"，管理作品、章节、设定集、大纲。
- **世界构建引导器**：七步引导（世界基调 → 力量体系 → 地理格局 → 势力阵营 → 规则禁忌 → 历史冲突 → 角色阵容），每步由对应弧光技能起草设定草案，你确认后写入设定集。
- **章节 AI 助手**：编辑器上方按钮（润色 / 去AI味 / 审稿 / 文风 / 爽点 / 设定核查），每个按钮绑定一个弧光技能；生成结果先预览，采纳才写回。
- **大纲 AI 助手**：大纲页的技能卡片（节奏结构 / 题材适配 / 反套路 / 爽点布局 / 情绪曲线 / 人物弧光），说明该技能在大纲层面能做什么，一键生成优化建议。
- **设定常驻上下文**：所有章节 AI 操作自动携带本作品的设定集与角色卡，让 AI 守你自己的设定；"设定核查"专门对照设定集找正文冲突。
- **Agent 工具**：9 个 `novel_*` 原生工具，让 dsh 对话里的 AI 直接读写同一份数据。
- **对话侧技能**：16 个弧光写作技能注册进 dsh 技能系统，对话里输入 `/` 即可调用。
- **数据持久化**：`~/.dsh/novel-platform/` 下的 JSON 存储，队列化写入 + 原子替换。

## 安装

```sh
dsh plugin add @ccl9295/dsh-novel-platform
# 或从本地路径：dsh plugin --profile <name> add /path/to/dsh-novel-platform
```

重启 dsh，侧边栏出现"写作台"。卸载：`dsh plugin --profile <name> remove @ccl9295/dsh-novel-platform`。

## 使用指南

### 前置：配置模型

所有 AI 功能走 dsh 自己的模型配置（`ctx.llm` + 默认模型选择）。在 dsh **设置 → 模型** 页配置 API key 并选好默认模型，写作台的 AI 功能即可用。未配置时按钮会给出明确提示。

### 世界构建引导（从零搭一个完整世界）

1. 打开 **写作台 → 设定 → 「🗺 世界构建引导」**。
2. 向导按 7 步推进，每步显示一个引导问题（如"力量体系"步会问境界划分、晋升代价与限制）。
3. 在备注框写下你的想法（可选），点 **AI 起草** —— 该步绑定的弧光技能 + 你已保存的设定会一起作为上下文，模型产出 2-4 个可直接使用的设定条目草案。
4. 编辑草案（满意即可），点 **保存到设定集** —— 草案按步骤分类存入世界设定集，自动进入下一步。
5. 每一步都能重跑（upsert 覆盖同分类同标题条目），设定随剧情演进随时回来改。

### 平时写文时使用

- **写作时**：章节编辑器上方的技能按钮即点即用；正文会先自动保存，生成建议后用 **采纳** 写回（审稿/设定核查只给意见，不覆盖正文），或 **复制** 出来自己改。
- **设定守一致**：润色、审稿等所有章节操作都会把设定集与角色卡注入 prompt——AI 不会写出违背你力量体系的桥段。改了设定后建议对近期章节跑一次 **设定核查**。
- **对话里**：让 dsh 的 AI 直接干活，例如"用 novel_chapter_write 把第三章写出来，按 novel-worldbuilding 的力量体系来"，或 `/novel-pacing` 调用完整技能。

### 大纲助手

大纲页底部是技能卡片网格，每张卡写着该技能对大纲的作用（如"情绪曲线：安排压抑、共情、释放的节奏"）。点击生成针对当前大纲的优化建议，预览后复制或照抄回大纲条目。

## 技能来自哪里

`resources/skills/` 中的 16 个写作技能来自开源项目 **[CharacterArc（弧光）](https://github.com/uu201/character-arc)**（`resources/skills/Distilled-Novel-Toolbox` 与 `community-skills` 目录），MIT License，按原样内置（未修改技能正文），其仓库 README 随包保留于 `resources/skills/README.md`。各技能与其在 UI 中的使用位置：

| 技能 | 来源包 | 使用位置 |
|---|---|---|
| `novel-polishing` | Distilled-Novel-Toolbox | 章节工具条「润色」 |
| `humanizer-zh` | community-skills | 章节工具条「去AI味」 |
| `novel-pacing` | Distilled-Novel-Toolbox | 章节工具条「审稿」、大纲卡片「节奏结构」 |
| `novel-language-style` | Distilled-Novel-Toolbox | 章节工具条「文风」 |
| `novel-pleasure-points` | Distilled-Novel-Toolbox | 章节工具条「爽点」、大纲卡片「爽点布局」 |
| `novel-worldbuilding` | Distilled-Novel-Toolbox | 章节工具条「设定核查」、引导器步骤 2-6 |
| `novel-genres` | Distilled-Novel-Toolbox | 引导器步骤 1（世界基调）、大纲卡片「题材适配」 |
| `novel-character-design` | Distilled-Novel-Toolbox | 引导器步骤 7（角色阵容）、大纲卡片「人物弧光」 |
| `novel-emotion` | Distilled-Novel-Toolbox | 大纲卡片「情绪曲线」 |
| `novel-commercialization` | Distilled-Novel-Toolbox | 对话侧调用 |
| `novel-compliance` | Distilled-Novel-Toolbox | 对话侧调用 |
| `novel-innovation` | Distilled-Novel-Toolbox | 大纲卡片「反套路」 |
| `novel-tools` | Distilled-Novel-Toolbox | 对话侧调用 |
| `style-fingerprint` | community-skills | 对话侧调用 |
| `style-fusion` | community-skills | 对话侧调用 |

`novel-anti-detection`（平台反检测）来自同一仓库但**未收录**——它是规避平台 AI 检测的指引，不属于写作技法。

## 引用与实现出处

实现中借用/参照的 dsh 内部模式（均为 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 仓库内公开源码，MIT）：

- **插件形态 / bundle / 安装机制**：`docs/user/develop/basic/publish.md`（官方打包文档）。
- **工具注册**（`defineTool` + `ctx.tools.register`）：`packages/extensions/tool-cordis/src/index.ts`。
- **技能注册**（`ctx.skills.register`）：`packages/skill/skill/src/index.ts` 与 `packages/skill/skill-office/src/index.ts` 的 provider 形态。
- **Typert Remote 控制器**（`TypertRemoteService` + `@Remote`）：`docs/cookbook/adding-a-remote-api.zh.md` 的 NotesController 示例。
- **浏览器半侧 / 面板注册**（`slots.inject('main')` + `sidebar.panellist`）：`packages/client/ui-plugin-manager/src/client/index.ts`。
- **client bundle 的 lazy-CJS factory 格式**：`packages/client/tsdown.client.ts`（`clientBundle` 预设）与 `packages/client/modules/README.zh.md`；独立构建 `scripts/build.mjs` 复刻其 banner/intro/footer 结构。
- **one-shot LLM 调用**（`ctx.llm.stream` + 手搓 `RequestMessage`）：`packages/compaction/compaction-basic/src/summarizer.ts` 的 `summarizeWithLlm`。
- **默认模型选择**（`ctx.agentDefaultModel.currentSelection()`）：`packages/core/agent-default-model/src/index.ts`。
- **JSON 持久化的原子写**：自研（队列 + 临时文件 rename），未引用 `@deepseek-ai/dsh-atomic-write`。
- **交互参考**：章节工具条与"预览-采纳"流参考星月写作等中文网文 AI 工具的通行模式；分步世界观引导参考落笔 AI、马良 AI、WriteWise 等同类工具的向导范式。

## 从源码构建

```sh
pnpm install
pnpm run build    # node scripts/build.mjs → lib/index.js + lib/client.js
```

构建自包含（rolldown + lightningcss）：host 半侧 ESM（`@Remote` 控制器按 dsh typertPlugin 同款方式经 TypeScript transpile 降级）；浏览器半侧为客户端模块系统的 lazy-CJS factory 格式，externals 限定平台基座；`lib/typert.*` 为确定性生成产物（`generated/` 提交，构建时重印包名）。

修改 Remote wire 面后需在一份 dsh monorepo checkout 里重新生成 typert 产物（本包放入 `packages/extensions/novel-platform/` 后跑 `tsdown --env.DSH_BUILD_FACE host`，产物复制回 `generated/`）。

## License

MIT。`resources/skills/` 内容遵循其原始 MIT 许可（见弧光仓库）。
