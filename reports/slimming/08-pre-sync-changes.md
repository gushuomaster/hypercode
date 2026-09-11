# Phase 2 Pre-Sync Changes

## Batch `BATCH-ARC-01`

- **Candidates:** `ARC-001`, `ARC-002`
- **Files removed:**
  - `packages/opencode/src.rar`
  - `packages/opencode/script/license.rar`
- **Files modified:** none
- **Why safe:** 两个文件都是 Git 跟踪的历史 `.rar` 快照；它们不是运行时、构建、测试、发布、配置或 filesystem discovery 输入。`src.rar` 解包后的 404 个源码路径全部有现行对应项，400 个完全一致，4 个为旧版本；`license.rar` 仅含两个现行 license 文件的旧副本。两者在 merge base 和目标 OpenCode 都不存在，且全仓无字符串引用。
- **Evidence:** 完整证据见 `07-pre-sync-candidates.md` 的 ARC-001/ARC-002；删除前已在临时目录使用 `tar -tf`/`tar -xf` 解包并做 SHA-256 路径对照。
- **Validation:** `git diff --check` 通过；删除后归档引用为 `NONE`；主工作区 baseline license tests 为 12 pass/0 fail；隔离工作区测试和 typecheck 因缺少依赖分别阻塞，见 `09-pre-sync-validation.md`。
- **Result:** `PASS`（变更本身）；验证环境限制单独记录，不视为由本批次引入的失败。

## 未执行候选

本批次没有混入 dependency、config、Agent/Skill/Prompt、脚本、license runtime、VS Code metadata、TUI、session、provider/plugin、CI 或生成/交付目录清理。

