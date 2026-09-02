# HyperCode 用户指南

本目录面向普通开发者用户，提供 HyperCode 的安装部署说明和日常使用说明。

当前优先覆盖已经在仓库内验证过的主路径：

- Windows CLI：`hypercode.exe`
- Ubuntu 20.04 x86_64 离线 CLI：`hypercode-offline-ubuntu20.04-x64-<version>.tar.gz`
- VS Code 扩展：`hypercode.vsix`

## 先看什么

- 想先知道 OpenCode 原生能力和 HyperCode 在此基础上的增强点，先看 [OpenCode 与 HyperCode 功能总览](OpenCode与HyperCode功能总览.md)
- 第一次安装或给同事分发可执行包，先看 [安装部署说明](安装部署说明.md)
- 在 Ubuntu 20.04 离线目标机安装 CLI、VS Code 扩展及全局 Skills，查看 [Ubuntu 20.04 离线安装与配置](Ubuntu20.04离线安装与配置.md)
- 已经装好，想知道怎么启动、怎么在 VS Code 里用、怎么做基础配置，先看 [使用说明书](使用说明书.md)

## 本目录范围

本目录重点回答：

- 用户应拿到哪些文件
- Windows 下如何部署 `hypercode.exe`
- Ubuntu 20.04 下如何离线部署 CLI、License、模型配置和全局 Agent/Skills
- VS Code 下如何安装 `hypercode.vsix`
- 装好后如何验证可用
- CLI 和 VS Code 的基本使用方法
- 常见设置与最常见的排错路径

本目录暂不展开：

- 维护者构建 CLI / VSIX 的详细命令
- upstream sync、rebrand、merge-back 等维护流程
- npm、Homebrew、AUR、Nix 等多平台分发路径

如果你需要的是维护者视角的构建与交付，请回到 [docs 索引](../README.md) 并查看 [操作手册](../操作手册/)。
