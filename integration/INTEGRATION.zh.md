# 集成改动参考

以下是对 dsh monorepo 的全部集成改动。README 的"安装"一节是操作指南；本目录存放可直接比对的最终形态。

## 1. packages/bundle/web-app/cordis.patch.yml

浏览器 roster `insert:` 列表内，`ui-cordis` 行之后新增：

```yaml
    # Web novel writing platform: agent tools, writing skills, the
    # `novel` Remote namespace, and the sidebar's Writing Desk panel.
    - id: novel-platform
      name: '@deepseek-ai/dsh-novel-platform'
```

## 2. packages/bundle/web-app/package.json

`dependencies` 新增：

```json
"@deepseek-ai/dsh-novel-platform": "workspace:*"
```

## 3. packages/api/remotes/src/client/index.ts

```ts
// import 区新增
import novelRemote from '@deepseek-ai/dsh-novel-platform/remote'

// type 再导出区新增
export type {} from '@deepseek-ai/dsh-novel-platform/remote'

// apply() 的 mount 数组，officeToPdfRemote 之后新增 novelRemote：
      permissionPresetsRemote, subagentsRemote, sessionRemote, jobRemote, workspaceRemote, workspaceFilesRemote, terminalRemote,
      officeToPdfRemote, novelRemote,
```

## 4. packages/api/remotes/package.json

`devDependencies` 新增（`zod` 为 typert 生成产物的构建/运行时依赖，缺失会导致 client bundle 运行时 `require("zod") missed the module table`）：

```json
"@deepseek-ai/dsh-novel-platform": "workspace:*",
"zod": "^4.4.3"
```

## 5. tsconfig.host.json（仓库根）

`references` 新增：

```json
{ "path": "./packages/extensions/novel-platform/tsconfig.host.json" }
```

## 6. tsconfig.client.json（仓库根）

`references` 新增：

```json
{ "path": "./packages/extensions/novel-platform/tsconfig.client.json" }
```

`include` 新增：

```json
"packages/extensions/novel-platform/src/css-modules.d.ts",
```
