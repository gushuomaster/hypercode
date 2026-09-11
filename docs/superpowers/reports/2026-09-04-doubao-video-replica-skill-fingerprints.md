# Doubao Video Replica Skill 指纹与验证记录

## 当前结论

- Skill：`C:\Users\28320\.codex\skills\doubao-video-replica`
- 当前 executable-skill 指纹：`3b5efcd321bdb81fbc8c4d3b969a3a7fefe53244db22d080bca1b253fc183bed`
- 当前隔离环境：`D:\venv\doubao-video-replica\3b5efcd321bdb81fbc8c4d3b969a3a7fefe53244db22d080bca1b253fc183bed`
- Python：3.14.3
- 依赖：`Pillow 12.3.0`、`pillow-heif 1.7.0`
- Skill 全量测试：137 项通过，2 项跳过
- `skill-creator` quick validator：本轮未执行成功；系统 Python 缺少其 `yaml` 依赖，未为验证器额外修改环境
- HyperCode 实际复用检查：`reused: true`，没有再次安装依赖
- HyperCode 真实 skill 最小纵向切片：通过（Question、LLM、图片 staging、正式导入、交付与恢复）

两项跳过分别因为本机没有 19 段性能 fixture，以及当前 Windows 账户没有创建符号链接的权限。

## 指纹规则

HyperCode 总是保护以下文件：

- `SKILL.md`
- `skill-runtime.json`
- manifest 的 entrypoint
- manifest 声明的 requirements

此外，当前 manifest 通过 `protected` 声明保护：

- `SKILL.md`
- `scripts/**/*.py`
- `references/**/*.md`

所有匹配文件按 POSIX 风格相对路径排序。每个文件记录 `path`、`size` 和内容 SHA-256，再对逐行 canonical JSON 计算最终 SHA-256。任何受保护文件变化都会产生新指纹、要求重新确认，并使用新的隔离环境；符号链接输入会被拒绝。

## 历史指纹

- 改造前环境键：`f4d83eb6927c4245f3e8ba1b37400064451402997e04fb0d5335216a6774fbd3`
- 初版协议改造后旧指纹：`c000e5e18957781a011771e232f94e0d632be8a3aa07fbaefb7be43829ef604c`
- 加入 manifest `protected` 契约后的当前指纹：`1ef6417ad74a8c448c6abef312e6166cf12f4ff95a3872deb157d90d8a6cec14`
- 移除 host 业务字段 `segment_id`、改由 skill 根据 pending action 推导后的当前指纹：`3b5efcd321bdb81fbc8c4d3b969a3a7fefe53244db22d080bca1b253fc183bed`

旧环境不会被新运行时复用。为避免误删用户数据，本次未自动删除旧环境或先前误建在 `D:\venv\doubao-video-replica` 根部的虚拟环境文件。
