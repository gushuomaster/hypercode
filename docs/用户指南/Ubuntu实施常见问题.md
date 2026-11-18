# HyperCode Ubuntu 实施常见问题

面向现场实施人员。完整安装步骤见《Ubuntu20.04离线安装与配置.md》，本文只回答实施时最常问的几个问题。

## 交付物

| 项目 | 内容 |
| --- | --- |
| 安装包 | `hypercode-offline-ubuntu20.04-x64-1.18.30.tar.gz` |
| 校验文件 | `hypercode-offline-ubuntu20.04-x64-1.18.30.tar.gz.sha256` |
| SHA-256 | 以随包的 `.sha256` 文件为准，拷入目标机前先核对 |
| 适用系统 | Ubuntu 20.04 及以上，x86_64，glibc |

## 1. 安装包是什么格式？`.sh` 又是什么？

- `.tar.gz` 是压缩包，相当于 Windows 的 `.zip`，你拿到的就是这个文件。
- 解压后里面有 `install.sh`、`install-license.sh` 两个 shell 脚本，相当于 Windows 的安装程序，在终端里运行。
- Linux 没有 `.exe`。HyperCode 的可执行文件是包里的 `bin/hypercode`，安装后就是 `hypercode` 命令。

解压并安装（用最终使用 HyperCode 的普通用户执行，**不要加 `sudo`**）：

```bash
tar -xzf hypercode-offline-ubuntu20.04-x64-1.18.30.tar.gz
cd hypercode-offline-ubuntu20.04-x64-1.18.30
./install.sh
export PATH="$HOME/.local/bin:$PATH"
hypercode --version
```

`install.sh` 会自动完成：

1. 检查系统是 Linux、x86_64、glibc。
2. 校验包内所有文件的 SHA-256。
3. 根据 CPU 是否支持 AVX2，在标准版和兼容版（baseline）之间自动选择。
4. 安装到 `~/.local/bin/hypercode`，不联网，不需要 `sudo`。
5. 运行一次 `hypercode --version` 验证。

如果自动选择的版本启动报错（例如 `Illegal instruction`），可以强制使用兼容版：

```bash
./install.sh --variant baseline
```

## 2. 装完是不是就能直接用？

不能。装完还要做两件事：

| 步骤 | 不做的后果 | 见本文 |
| --- | --- | --- |
| 导入 License | CLI 拒绝启动 | 第 3、4 节 |
| 配置模型地址、模型 ID、API Key | 找不到可用模型，或调用时报 401 | 第 5 节 |

包里的配置模板（`config/hypercode.json.example`、`config/hypercode.env.example`）都是**占位值**，必须改成现场的实际值。

## 3. License 怎么申请？

License 与目标机器绑定，按机器签发。

**第一步：在目标 Ubuntu 上取机器码。** 没有 License 也可以运行这个命令：

```bash
hypercode license machine-id
```

输出类似：

```text
5da1-32fc-0f7b-afcb-4c94-5361-4d2c-eb4a
```

机器码由 `/etc/machine-id` 计算得出。**取机器码之前，必须先完成虚拟机克隆和最终部署。** 克隆虚拟机或重装系统后，machine-id 可能改变，原来的 License 就会失效。

**第二步：把机器码发给 License 管理员。** 管理员签发后，你会拿到一个 `license.txt` 文件。

注意：

- Windows 和 Ubuntu 用的是同一个签发工具，但机器码不同。同一台物理机在 Windows 和 Ubuntu 下取出的机器码不一样，不能混用。
- **旧版 License 已停用。** 2026 年 11 月之前签发的 `license.txt` 会显示"旧格式已停用"，需要用新版本重新取机器码、重新申请。
- 签发工具只由管理员保管，不随交付包分发，现场不需要也不应该拿到它。

## 4. `license.txt` 放到哪里？

放在**运行 HyperCode 的那个用户**的主目录下：

```text
~/hyper-aicode/license.txt
```

例如用户名是 `zhangsan`，完整路径就是 `/home/zhangsan/hyper-aicode/license.txt`。

推荐用安装包里的脚本导入，不用手动建目录：

```bash
cd hypercode-offline-ubuntu20.04-x64-1.18.30
./install-license.sh /path/to/license.txt
```

脚本会创建 `~/hyper-aicode/` 目录（权限 700），复制 `license.txt`（权限 600），然后运行 `hypercode license status` 显示授权状态。

不确定该放哪里时，在目标机上运行下面的命令，它会打印当前用户应放的路径：

```bash
hypercode license path
```

注意：

- **不要用 `sudo` 导入。** 加了 `sudo`，文件会放进 `/root/hyper-aicode/`，普通用户读不到。
- **多个用户各导入一次。** License 放在用户自己的主目录里。同一台机器的机器码相同，所以同一份 `license.txt` 可以给每个用户各导入一次。
- Windows 的位置不同，固定为 `C:\hyper-aicode\license.txt`，不要混淆。

验证：

```bash
hypercode license status
```

## 5. "模型端点"是什么？要在内网服务器上配置吗？能用云端地址吗？

**模型端点**就是 HyperCode 发送 AI 请求的地址，即配置文件里的 `baseURL`。HyperCode 本身不包含模型，它只是一个客户端，需要连接一个提供 OpenAI-compatible 接口的模型服务。

"OpenAI-compatible"指接口格式兼容 OpenAI API，并不要求使用 OpenAI 的模型。服务只要提供类似以下接口即可接入：

```text
GET  /v1/models
POST /v1/chat/completions
```

**模型服务部署在哪里都可以，取决于目标机能访问到哪里：**

| 目标机网络情况 | 可用的端点 | 示例 |
| --- | --- | --- |
| 完全断网 | 只能用内网部署的模型服务（vLLM、LMDeploy、Xinference 等） | `http://192.168.1.100:8000/v1` |
| 能访问内网模型网关 | 内网网关地址 | `http://model-gateway:8000/v1` |
| 能访问公网 | 云端模型服务也可以 | `https://api.minimaxi.com/v1` 等 |

也就是说，**模型端点不需要在目标机上配置服务**，目标机只需要在 HyperCode 的配置文件里填上一个它能访问到的地址。模型服务本身由内网模型管理员或云服务商提供。

实施前需要向模型服务方确认三项：

1. 服务地址，例如 `http://192.168.1.100:8000/v1`
2. 模型 ID，例如 `Qwen3-32B`
3. API Key，或确认服务不鉴权

拿到后按《Ubuntu20.04离线安装与配置.md》第 4 节填写：

- `~/.config/opencode/hypercode.json`：填 `baseURL`、模型 ID
- `~/.config/opencode/hypercode.env`：填 API Key。服务不鉴权时填任意非空值，例如 `unused`

## 6. 环境变量文件要怎么生效？

`~/.config/opencode/hypercode.env` 是一个变量文件，**必须加载后才生效**。建议加入用户的 shell 配置，以后每次登录自动加载：

```bash
echo '. ~/.config/opencode/hypercode.env' >> ~/.bashrc
. ~/.config/opencode/hypercode.env
```

模板里默认包含以下设置，请保留：

| 变量 | 作用 |
| --- | --- |
| `HYPERCODE_DISABLE_MODELS_FETCH=1` | 不访问公网 `models.dev` 刷新模型目录 |
| `OPENCODE_DISABLE_LSP_DOWNLOAD=1` | 不自动下载语言服务器 |
| `HYPERCODE_DISABLE_AUTOUPDATE=1` | 不检查、不自动安装更新。目标机能上网时尤其重要，否则可能从上游渠道下载 OpenCode 覆盖 HyperCode |
| `HYPERCODE_INTERNAL_API_KEY` | 内网模型服务的 API Key，改成现场值 |

## 7. 实施完成后怎么验收？

依次运行：

```bash
hypercode --version          # 能输出版本号
hypercode license status     # 显示授权有效
hypercode                    # 进入界面后发一句话，模型能正常回复
```

完整验收清单见《Ubuntu20.04离线安装与配置.md》第 7 节。

## 8. 遇到问题时提供什么信息？

联系支持时请一并提供：

- `hypercode --version` 的输出
- `hypercode license status` 的输出
- `uname -a` 和 `getconf GNU_LIBC_VERSION` 的输出
- 报错截图或完整报错文字
- 模型服务地址能否从目标机访问，可以用 `curl http://<地址>/v1/models` 测试
