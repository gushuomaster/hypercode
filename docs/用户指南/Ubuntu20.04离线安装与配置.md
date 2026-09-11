# HyperCode Ubuntu 20.04 离线安装与配置

本文面向 Ubuntu 20.04 x86_64 离线目标机，说明如何安装和配置改造后的 HyperCode。内容覆盖：

- HyperCode CLI 离线安装
- License 导入与验证
- MiniMax 或内网模型配置
- VS Code 扩展离线安装
- Agent 与多个 Skills 的全局配置
- 常见问题排查

本文中的操作均以最终运行 HyperCode 的普通用户执行，默认用户名示例为 `master`。安装过程不使用网络或 `sudo`，。

## 1. 交付文件

至少准备以下文件：

```text
hypercode-offline-ubuntu20.04-x64-1.17.3.tar.gz

hypercode.vsix
```

授权后还需要管理员签发的：

```text
license.txt
```

如果需要部署全局 Agent 与 Skills，还应准备完整的 `.hypercode` 目录，例如：

```text
.hypercode/
├── agents/
│   ├── defense-python-test.md
│   └── defense-review.md
└── skills/
    ├── defense-python-test/
    │   ├── SKILL.md
    │   ├── scripts/
    │   ├── references/
    │   └── assets/
    ├── defense-test-requirements/
    │   └── SKILL.md
    ├── defense-test-assets/
    │   └── SKILL.md
    ├── defense-test-execution/
    │   └── SKILL.md
    ├── defense-test-audit/
    │   └── SKILL.md
    └── defense-code-review/
        └── SKILL.md
```

不要只复制 `SKILL.md`。Skill 使用的 `scripts/`、`references/`、`assets/` 和其他资源也必须一起交付。

## 2. 安装 CLI

假设离线包已经放到 Ubuntu 的 `~/Downloads`：

```bash
cd ~/Downloads
tar -xzf hypercode-offline-ubuntu20.04-x64-1.17.3.tar.gz
cd hypercode-offline-ubuntu20.04-x64-1.17.3
./install.sh
```

`install.sh` 默认完成以下操作：

- 检查系统架构是否为 x86_64
- 检查 glibc
- 校验包内文件 SHA-256
- 根据 `/proc/cpuinfo` 自动选择 AVX2 标准版或 baseline 兼容版
- 安装到 `~/.local/bin/hypercode`


把安装目录加入当前用户的 `PATH`：

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

验证：

```bash
hypercode --version
hypercode --help
```

预期版本为：

```text
1.17.3
```

## 3. 安装 License

### 3.1 获取目标机 machine-id

虚拟机完成最终克隆和部署、确认 `/etc/machine-id` 不再变化后执行：

```bash
hypercode license machine-id
```

把输出的 machine-id 交给发证管理员。管理员在受控 Windows 电脑上使用 `HyperCodeLicenseGenerator.exe` 生成 `license.txt`。

License 当前与目标 Ubuntu 的 `/etc/machine-id` 绑定，不与 `1.17.3` 安装包版本绑定。虚拟机重新克隆或 machine-id 改变后，需要重新签发。

### 3.2 导入 license.txt

假设 `license.txt` 已经放到 `~/Downloads`，并且当前仍位于离线包解压目录：

```bash
./install-license.sh ~/Downloads/license.txt
```

该脚本会：

- 将 License 复制到 `~/hyper-aicode/license.txt`
- 将目录权限设为 `700`
- 将文件权限设为 `600`
- 自动执行 `hypercode license status`

再次验证：

```bash
hypercode license path
hypercode license status
```

CLI 和 VS Code 扩展共用这个 License，不需要分别授权。

## 4. 配置模型

模型配置、CLI 安装和 License 是三个独立环节。HyperCode 安装成功并不代表模型 API 已配置。

### 4.1 从离线模板创建配置

在离线包解压目录执行：

```bash
mkdir -p ~/.config/opencode
[ -e ~/.config/opencode/hypercode.json ] || cp config/hypercode.json.example ~/.config/opencode/hypercode.json
[ -e ~/.config/opencode/hypercode.env ] || cp config/hypercode.env.example ~/.config/opencode/hypercode.env
chmod 600 ~/.config/opencode/hypercode.json
chmod 600 ~/.config/opencode/hypercode.env
```


### 4.2 配置内网千问服务

“OpenAI-compatible”指接口格式兼容 OpenAI API，并不要求运行 OpenAI 模型。使用 vLLM、LMDeploy、Xinference 等部署的千问模型，只要提供类似以下接口即可接入：

```text
GET  /v1/models
POST /v1/chat/completions
```

需要向内网模型管理员确认：

1. 服务地址，例如 `http://192.168.1.100:8000/v1`
2. 模型 ID，例如 `Qwen3-32B`
3. API Key，或确认服务不鉴权

编辑配置：

```bash
nano ~/.config/opencode/hypercode.json
```

示例：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "internal/Qwen3-32B",
  "small_model": "internal/Qwen3-32B",
  "provider": {
    "internal": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "内网千问",
      "options": {
        "baseURL": "http://192.168.1.100:8000/v1",
        "apiKey": "{env:HYPERCODE_INTERNAL_API_KEY}"
      },
      "models": {
        "Qwen3-32B": {
          "name": "千问 Qwen3 32B"
        }
      }
    }
  }
}
```

编辑环境变量：

```bash
nano ~/.config/opencode/hypercode.env
```

有 API Key 时：

```bash
export HYPERCODE_DISABLE_MODELS_FETCH=1
export HYPERCODE_INTERNAL_API_KEY='替换为真实内网密钥'
```

如果服务明确不鉴权，可使用非空占位值：

```bash
export HYPERCODE_DISABLE_MODELS_FETCH=1
export HYPERCODE_INTERNAL_API_KEY='unused'
```

加载配置：

```bash
source ~/.config/opencode/hypercode.env
```

让终端以后自动加载：

```bash
echo '[ -f "$HOME/.config/opencode/hypercode.env" ] && . "$HOME/.config/opencode/hypercode.env"' >> ~/.bashrc
source ~/.bashrc
```

验证：

```bash
hypercode debug config
hypercode models internal
hypercode run -m internal/Qwen3-32B "只回复ok"
```

在内网服务尚未准备好时，可以先完成 CLI、License、VS Code、Agent 和 Skills 的安装，模型调用留到服务可用后验收。

### 4.3 更换内网模型

以后更换内网模型不需要重新安装 HyperCode，也不需要重新签发 License。只需修改模型配置和密钥环境变量。

修改前建议备份：

```bash
cp ~/.config/opencode/hypercode.json ~/.config/opencode/hypercode.json.bak
cp ~/.config/opencode/hypercode.env ~/.config/opencode/hypercode.env.bak
```

编辑：

```bash
nano ~/.config/opencode/hypercode.json
```

需要对应修改以下位置：

```json
{
  "model": "internal/新模型ID",
  "small_model": "internal/新模型ID",
  "provider": {
    "internal": {
      "options": {
        "baseURL": "http://新服务器地址:端口/v1",
        "apiKey": "{env:HYPERCODE_INTERNAL_API_KEY}"
      },
      "models": {
        "新模型ID": {
          "name": "界面显示名称"
        }
      }
    }
  }
}
```

必须保持以下对应关系：

```text
provider 键：internal
默认模型：internal/新模型ID
models 键：新模型ID
```

例如从 `Qwen3-32B` 更换为 `Qwen3-Coder-30B-A3B-Instruct`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "internal/Qwen3-Coder-30B-A3B-Instruct",
  "small_model": "internal/Qwen3-Coder-30B-A3B-Instruct",
  "provider": {
    "internal": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "内网千问",
      "options": {
        "baseURL": "http://192.168.1.120:8000/v1",
        "apiKey": "{env:HYPERCODE_INTERNAL_API_KEY}"
      },
      "models": {
        "Qwen3-Coder-30B-A3B-Instruct": {
          "name": "千问 Qwen3 Coder 30B"
        }
      }
    }
  }
}
```

如果新服务使用不同 API Key，编辑：

```bash
nano ~/.config/opencode/hypercode.env
```

修改：

```bash
export HYPERCODE_INTERNAL_API_KEY='新的内网密钥'
```

同一服务也可以注册多个模型：

```json
"models": {
  "Qwen3-32B": {
    "name": "千问 Qwen3 32B"
  },
  "Qwen3-Coder-30B-A3B-Instruct": {
    "name": "千问 Qwen3 Coder 30B"
  }
}
```

默认使用哪个模型，由顶层字段决定：

```json
"model": "internal/Qwen3-Coder-30B-A3B-Instruct",
"small_model": "internal/Qwen3-Coder-30B-A3B-Instruct"
```

修改后加载新环境变量：

```bash
source ~/.config/opencode/hypercode.env
```

验证实际生效配置：

```bash
hypercode debug config
hypercode models internal
hypercode run -m internal/Qwen3-Coder-30B-A3B-Instruct "只回复ok"
```

最后完全退出 HyperCode CLI 和所有 VS Code 窗口，再从已加载环境变量的终端启动：

```bash
source ~/.config/opencode/hypercode.env
code .
```

如果修改后仍显示 `MiniMax (直连)`，说明顶层 `model` 仍指向 `minimax-direct/...`，或 VS Code 工作区运行时尚未重启。

### 4.4 使用 MiniMax 直连配置

如果现场仍使用内置的 `minimax-direct/MiniMax-M2.7`，需要加载：

```bash
export MINIMAX_API_KEY='替换为真实MiniMax密钥'
```

出现以下错误表示模型密钥没有进入当前进程，而不是 License 失败：

```text
login fail: Please carry the API secret key in the 'Authorization' field
```

## 5. 安装 VS Code 扩展

扩展要求 VS Code `1.94.0` 或更高版本。

假设 `hypercode.vsix` 已放到 `~/Downloads`：

```bash
code --version
code --install-extension ~/Downloads/hypercode.vsix --force
```

出现以下信息表示安装成功：

```text
Extension 'hypercode.vsix' was successfully installed.
```

`url.parse()` 的 `DeprecationWarning` 是 VS Code/Node.js 警告，不影响 VSIX 安装。

检查扩展：

```bash
code --list-extensions --show-versions | grep -i hypercode
```

### 5.1 指定 CLI 路径

先查询 CLI 绝对路径：

```bash
readlink -f "$(command -v hypercode)"
```

通常得到：

```text
/home/master/.local/bin/hypercode
```

在 VS Code 设置中搜索 `hypercode.cliPath`，填写该绝对路径。

也可以在 VS Code 的 `settings.json` 中设置：

```json
{
  "hypercode.cliPath": "/home/master/.local/bin/hypercode"
}
```

### 5.2 让 VS Code 获得 API Key

从 Ubuntu 桌面图标启动的 VS Code 可能不会读取 `~/.bashrc`。最可靠的验证方式是完全退出所有 VS Code 窗口，然后从已经加载环境变量的终端启动：

```bash
source ~/.config/opencode/hypercode.env
code .
```

如果已有 VS Code 后台进程，新执行的 `code .` 可能仍连接旧进程，因此修改环境变量后必须彻底退出并重新打开 VS Code。

安装完成后：

1. 打开一个项目目录。
2. 点击左侧活动栏的 `HyperCode`。
3. 创建会话。
4. 确认底部显示的模型是预期 provider/model。
5. 发送最小测试消息。

## 6. 全局安装 Agent 与多个 Skills

### 6.1 项目级与全局级的区别

项目级配置只对一个项目生效：

```text
项目根目录/.hypercode/agents/
项目根目录/.hypercode/skills/
```

全局配置对当前 Ubuntu 用户打开的所有项目生效：

```text
~/.hypercode/agents/
~/.hypercode/skills/
```

对于本项目现有的整套 `.hypercode` 配置包，推荐保持目录结构不变，整体复制到当前用户主目录。

### 6.2 整体复制配置包

假设完整 `.hypercode` 位于 VMware 共享目录 `/mnt/hgfs/VMShare/.hypercode`：

```bash
mkdir -p ~/.hypercode
cp -a /mnt/hgfs/VMShare/.hypercode/. ~/.hypercode/
```

如果放在 `~/Downloads/.hypercode`：

```bash
mkdir -p ~/.hypercode
cp -a ~/Downloads/.hypercode/. ~/.hypercode/
```

最终应类似：

```text
/home/master/.hypercode/
├── agents/
│   ├── defense-python-test.md
│   └── defense-review.md
└── skills/
    ├── defense-python-test/
    ├── defense-test-requirements/
    ├── defense-test-assets/
    ├── defense-test-execution/
    ├── defense-test-audit/
    └── defense-code-review/
```



同一份 Skill 不要同时安装到多个全局目录，否则会出现重名和覆盖提示。

### 6.3 一个 Agent 使用多个 Skills

一个 Agent 可以在提示词中按任务阶段加载多个已发现的 Skills。例如 `defense-python-test` 可以路由到：

```text
defense-test-requirements
defense-test-assets
defense-test-execution
defense-test-audit
```

如果需要限制 Agent 只能使用指定 Skills，可在 Agent Markdown 的 frontmatter 中配置：

```yaml
---
description: 面向军工/航天 Python 测试任务的子代理
mode: subagent
temperature: 0.1
permission:
  skill:
    "*": deny
    "defense-python-test": allow
    "defense-test-requirements": allow
    "defense-test-assets": allow
    "defense-test-execution": allow
    "defense-test-audit": allow
---
```

Agent 配置本身没有必须填写的 `skills` 数组；Skills 的选择通常由 Agent 提示词路由，并可通过 `permission.skill` 控制允许范围。


### 6.5 验证 Agent 与 Skills

列出全部已发现 Skills：

```bash
hypercode debug skill
```

检查指定 Agent：

```bash
hypercode debug agent defense-python-test
hypercode debug agent defense-review
```

完全重启 CLI 或 VS Code。在 VS Code HyperCode 输入框中：

- 输入 `/skills`，检查全局 Skills 是否出现。
- 输入 `@`，检查全局 Agent 是否出现。
- 选择 Agent 后提交一个只要求说明工作流程的测试任务。



## 7. 最终验收清单

依次执行：

```bash
hypercode --version
hypercode license status
hypercode debug config
hypercode debug skill
hypercode debug agent defense-python-test
code --list-extensions --show-versions | grep -i hypercode
```

模型服务可用后再执行：

```bash
hypercode models internal
hypercode run -m internal/Qwen3-32B "只回复ok"
```

VS Code 中验收：

1. HyperCode 活动栏可以打开。
2. 工作区运行时可以启动。
3. `/skills` 能看到全局 Skills。
4. `@` 能看到全局 Agent。
5. API Key 已加载时，最小消息可以获得回复。

## 8. 常见问题

### 8.1 VS Code 黑屏或非常卡

VMware 虚拟显卡可能与 VS Code Electron GPU 加速不兼容。先测试：

```bash
code --disable-gpu
```

若有效，创建或修改 `~/.config/Code/argv.json`：

```json
{
  "disable-hardware-acceleration": true
}
```

同时避免直接在 `/mnt/hgfs` 共享目录中打开大型项目。建议复制到 Ubuntu 本地磁盘：

```bash
mkdir -p ~/projects
cp -a /mnt/hgfs/VMShare/你的项目 ~/projects/
cd ~/projects/你的项目
code .
```

### 8.2 CLI 能调用模型，但 VS Code 插件不能

通常是 VS Code 进程没有继承 API Key。完全退出 VS Code，然后执行：

```bash
source ~/.config/opencode/hypercode.env
code .
```

### 8.3 插件提示找不到 HyperCode CLI

确认：

```bash
readlink -f "$(command -v hypercode)"
```

然后把结果填写到 VS Code 设置 `hypercode.cliPath`。

### 8.4 `/skills` 中看不到新安装的 Skill

检查：

```bash
find ~/.hypercode/skills -name SKILL.md -print
hypercode debug skill
```

每个 Skill 至少应满足：

```text
skills/<技能目录>/SKILL.md
```

并且 `SKILL.md` frontmatter 至少包含有效的 `name` 和 `description`。安装或修改后需要完全重启 HyperCode CLI 或 VS Code 工作区运行时。
