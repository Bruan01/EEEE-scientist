# OpenClaw Lingzhu

面向 Rokid/乐奇眼镜场景的 `Lingzhu <-> OpenClaw` 桥接插件。

本目录已随 DeepScientist 一起打包，可直接从当前仓库安装。

## 安装

```bash
# 在 DeepScientist 仓库根目录下安装
openclaw plugins install ./assets/connectors/lingzhu/openclaw-bridge

# 或以开发模式链接安装
openclaw plugins install --link ./assets/connectors/lingzhu/openclaw-bridge
```

## 配置

在 `openclaw.json` 或 `moltbot.json` 中加入：

```json5
{
  "gateway": {
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  },
  "plugins": {
    "entries": {
      "lingzhu": {
        "enabled": true,
        "config": {
          "authAk": "",
          "agentId": "main",
          "includeMetadata": true,
          "requestTimeoutMs": 60000,
          "sessionMode": "per_user",
          "sessionNamespace": "lingzhu",
          "defaultNavigationMode": "0",
          "enableFollowUp": true,
          "followUpMaxCount": 3,
          "maxImageBytes": 5242880,
          "systemPrompt": "你是部署在 Rokid 眼镜上的智能助手。",
          "autoReceiptAck": true,
          "visibleProgressHeartbeat": true,
          "visibleProgressHeartbeatSec": 10,
          "debugLogging": true,
          "debugLogPayloads": false,
          "debugLogDir": "",
          "enableExperimentalNativeActions": true
        }
      }
    }
  }
}
```

## CLI

```bash
openclaw lingzhu info
openclaw lingzhu status
openclaw lingzhu curl
openclaw lingzhu capabilities
openclaw lingzhu logpath
openclaw lingzhu doctor
openclaw lingzhu cache-cleanup
```

## 健康检查

```bash
curl http://127.0.0.1:18789/metis/agent/api/health
```

## 调试日志

启用 `debugLogging` 后，桥接日志默认写入插件目录下的 `logs/`：

- `logs/lingzhu-YYYY-MM-DD.log`

联调时建议先这样配置：

- `debugLogging: true`
- `debugLogPayloads: false`

只有在需要精确排查协议载荷时，再临时改为：

- `debugLogPayloads: true`

## 长时间兼容策略

这份 bridge 默认采用更稳妥的 Lingzhu 兼容策略：

- `autoReceiptAck: true`
  - 请求进入后立即发一条可见回执，避免眼镜端等待模型首 token 时像“没收到”
- `visibleProgressHeartbeat: true`
  - 长时间无正文输出时，补发轻量可见进度帧，而不仅仅是 SSE 注释心跳
- `visibleProgressHeartbeatSec: 10`
  - 控制可见进度帧最短间隔，避免过于频繁刷屏

这会明显改善实际体验，但仍不能消除灵珠平台单次 SSE 请求的时长限制。

## 实验性原生动作

启用 `enableExperimentalNativeActions` 后，会额外向模型暴露这些实验动作：

- `send_notification`
- `send_toast`
- `speak_tts`
- `start_video_record`
- `stop_video_record`
- `open_custom_view`

这些动作是否被灵珠平台或眼镜端真实识别，仍需真机联调验证。

## 额外工具

- `openclaw lingzhu doctor`: 输出当前桥接自检结果，适合部署后快速核对配置。
- `openclaw lingzhu cache-cleanup`: 清理 24 小时前的图片缓存，避免联调过程中缓存目录持续膨胀。
