# Tasks

## 1. 交付文档修正

- [x] 1.1 `docs/操作手册/构建与交付规范.md`：版本号改为 `<version>` 占位并说明取自 `packages/opencode/package.json`；恢复 `## 产物清单` 正文，`## Cross-Host Packaged Smoke` 移到独立位置；`grep -n '1\.17\.3' docs/操作手册` 无残留
- [x] 1.2 `docs/用户指南/Ubuntu20.04离线安装与配置.md`：同样处理版本号；`grep -n '1\.17\.3' docs/用户指南/Ubuntu20.04离线安装与配置.md` 无残留（`1.18.30升级说明.md` 中描述升级区间的 1.17.3 保留）
- [x] 1.3 构建手册注明根目录 `install` 脚本为 upstream 在线安装脚本、不属于 HyperCode 交付物

## 2. 品牌审计门禁

- [x] 2.1 在当前 HEAD 运行 `bun run rebrand:check`，记录完整签名（blocked / planned / manual 各项）
- [x] 2.2 逐项处理：`core-env-alias-missing`、`runtime-env-alias-missing` 判断是规则过期还是确有缺失并修正；`packages/app/src/i18n/en.ts` 4 处按"不在交付面内"规则排除或修正；`README.md`、`sdks/vscode/src/extension.ts` 人工确认后加入允许清单；修正后再次运行 dry-run
- [x] 2.3 在 `docs/规范/上游同步与品牌化规范.md` 或同步操作手册中记录新的 `rebrand:check` 基线签名，作为同步后品牌回归门禁

## 3. 扩展 publisher（决策 1 通过后执行）

- [ ] 3.1 修改 `sdks/vscode/package.json` 的 `publisher`，grep 仓库内对 `sst-dev.hypercode` 的引用并同步更新；`bun run check-types` 与 VSIX 打包通过，`code --install-extension` 后扩展 ID 为新值（publisher 已改为 `hypercode`，`settings.ts` 已同步，`check-types` 通过；VSIX 打包与安装验证留到最后统一验证）
- [x] 3.2 在 `docs/用户指南/安装部署说明.md` 增加"从旧版本升级需先卸载 `sst-dev.hypercode`"说明，并在构建手册的验收清单加入扩展 ID 检查

## Workflow follow-up

- 决策 2（数据目录迁移）在 D2 定案后另起 change，不在本 change 范围。
