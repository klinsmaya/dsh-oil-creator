# 实现说明

`dsh-dingze` 是 DeepSeek Harness 插件。它对官方侧栏的替换写在 `cordis.patch.yml`，通过 `dsh.bundle.patch` 随包安装。卸掉插件后官方侧栏恢复。

## 真源

进度由 `定版/` 里的文件名加 overlay 推导，见 `src/catalog.ts`。规则顺序：改版中 → 需复核 → 已定版 → 已跳过 → 其余待做；最小序号是当前步，有改版则改版步是当前步。

## 工具

工具前缀 `dz_`。所有写操作先预览再 apply。解析当前项目：显式 `project` → cwd 落在项目内 → overlay 绑定的 sessionId。

## 客户端

locale 命名空间 `dsh.dingze`，CSS 前缀 `dz-`，Inspector 默认宽 320。对话输入走 `conversation.input.for(scope)`，并对旧 rc 做兼容。

## 不做什么

插件不放教练人设，不定责方法论正文。配套 preset 是 `dingze-coach`，不在本仓库。
