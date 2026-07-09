export const bundledHypercodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "model": "minimax-direct/MiniMax-M2.7",
  "small_model": "minimax-direct/MiniMax-M2.7",
  "provider": {
    "minimax-direct": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiniMax (直连)",
      "options": {
        "baseURL": "https://api.minimaxi.com/v1",
        "apiKey": "{env:MINIMAX_API_KEY}"
      },
      "models": {
        "MiniMax-M2.7": {
          "name": "MiniMax M2.7"
        },
        "MiniMax-M2.7-highspeed": {
          "name": "MiniMax M2.7 (highspeed)"
        }
      }
    }
  }
}`
