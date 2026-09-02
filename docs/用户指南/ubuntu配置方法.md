Ubuntu 用户应把配置放在：

```bash
~/.config/opencode/hypercode.json
```

不要放到 `~/.config/hypercode/`，程序实际默认读取的是 `~/.config/opencode/`。

## 1. 创建配置

```bash
mkdir -p ~/.config/opencode
nano ~/.config/opencode/hypercode.json
```

以本机运行的千问 3.6、OpenAI-compatible 地址 `http://127.0.0.1:8000/v1` 为例：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "local-qwen/qwen3.6-27b",
  "small_model": "local-qwen/qwen3.6-27b",
  "provider": {
    "local-qwen": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "本地千问",
      "options": {
        "baseURL": "http://127.0.0.1:8000/v1",
        "apiKey": "{env:HYPERCODE_QWEN_API_KEY}"
      },
      "models": {
        "qwen3.6-27b": {
          "name": "千问 3.6 27B",
          "tool_call": true,
          "limit": {
            "context": 131072,
            "output": 16384
          }
        }
      }
    }
  }
}
```

## 2. 配置环境变量

创建环境变量文件：

```bash
nano ~/.config/opencode/hypercode.env
```

无需鉴权的本地服务：

```bash
export HYPERCODE_QWEN_API_KEY='unused'
export HYPERCODE_DISABLE_MODELS_FETCH=1
```

需要鉴权则把 `unused` 换成真实密钥。

加载环境变量：

```bash
source ~/.config/opencode/hypercode.env
```

设置登录后自动加载：

```bash
echo '[ -f "$HOME/.config/opencode/hypercode.env" ] && . "$HOME/.config/opencode/hypercode.env"' >> ~/.bashrc
source ~/.bashrc
```

## 3. 确认真实模型 ID

模型 ID 必须和服务端返回结果完全一致：

```bash
curl -s http://127.0.0.1:8000/v1/models
```

如果返回：

```json
{
  "data": [
    {
      "id": "Qwen3.6-27B-Instruct"
    }
  ]
}
```

配置就要改为：

```json
"model": "local-qwen/Qwen3.6-27B-Instruct",
"small_model": "local-qwen/Qwen3.6-27B-Instruct"
```

同时修改模型注册键：

```json
"models": {
  "Qwen3.6-27B-Instruct": {
    "name": "千问 3.6 27B",
    "tool_call": true
  }
}
```

## 4. 不同部署方式的地址

- vLLM：`http://127.0.0.1:8000/v1`
- LMDeploy：通常为 `http://127.0.0.1:23333/v1`
- Ollama：`http://127.0.0.1:11434/v1`
- 远程内网服务器：`http://192.168.1.100:8000/v1`

## 5. 验证

```bash
hypercode debug config
hypercode models local-qwen
hypercode run -m local-qwen/qwen3.6-27b "只回复 OK"
```

如果通过 VS Code 使用，配置完成后需要完全退出 VS Code，再从已加载环境变量的终端启动：

```bash
source ~/.config/opencode/hypercode.env
code .
```
