# 🌉 Lark-ACP

<p align="center">
  <b>可插拔的飞书(Feishu)与 ACP 兼容 CLI Agent 桥接器</b>
</p>

<p align="center">
  <a href="https://github.com/yancy-coder/lark-acp/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/Language-TypeScript-3178C6.svg" alt="Language: TypeScript">
  </a>
  <a href="https://open.feishu.cn/">
    <img src="https://img.shields.io/badge/Feishu-OpenAPI-3370FF.svg" alt="Feishu OpenAPI">
  </a>
</p>

<p align="center">
  <a href="#-简介">简介</a> •
  <a href="#-系统架构">系统架构</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-配置说明">配置说明</a> •
  <a href="#-命令列表">命令列表</a> •
  <a href="#-支持-agents">支持 Agents</a>
</p>

---

## 📖 简介

**Lark-ACP** 是一个可插拔的桥接服务，将 **飞书(Feishu)** 与支持 **Agent Client Protocol (ACP)** 的 CLI Agent 连接起来。通过 Lark-ACP，你可以直接在飞书聊天中与各种 AI Agent（如 Kimi、Claude、Gemini、Codex 等）进行交互。

### ✨ 核心特性

- 🔌 **可插拔架构** - 支持多个 ACP 兼容的 CLI Agent，可随时切换
- 🚀 **WebSocket 长连接** - 无需公网 IP，通过 WebSocket 实时接收消息
- 🛡️ **自动权限处理** - 自动批准工具调用权限请求（适用于个人/可信环境）
- 📝 **消息格式化** - 自动将 Agent 响应格式化为飞书兼容的格式
- 🔄 **会话管理** - 支持重置会话、切换 Agent 等操作
- 📊 **工具调用追踪** - 实时显示 Agent 调用的工具及其状态

---

## 🏗️ 系统架构

<p align="center">
  <img src="architecture.png" alt="Lark-ACP Architecture" width="100%">
</p>

### 架构组件

| 组件 | 描述 |
|------|------|
| **Feishu Adapter** | 飞书适配器，通过 WebSocket 长连接接收消息，处理事件订阅 |
| **Bridge Core** | 桥接核心，负责消息路由、格式化、数据转码 |
| **ACP Client** | 基于 `@agentclientprotocol/sdk` 实现的 ACP 协议客户端，通过 stdio 与 Agent 进程通信 |
| **Pluggable Agents** | 可插拔的 Agent 集合，支持 Kimi、Claude、Gemini、Codex 等 |

### 数据流

```
┌─────────────┐     WebSocket      ┌─────────────────────────────────────┐
│   用户      │ ◄────────────────► │         Bridge Server Core          │
│ 飞书客户端   │                    │  ┌──────────┐  ┌──────────┐        │
└─────────────┘                    │  │ Feishu   │  │  Bridge  │        │
                                   │  │ Adapter  │  │  Core    │        │
                                   │  └────┬─────┘  └────┬─────┘        │
                                   │       │             │              │
                                   │  ┌────▼─────────────▼─────┐        │
                                   │  │      ACP Client        │        │
                                   │  │  (JSON-RPC over stdio) │        │
                                   │  └────┬───────────────────┘        │
                                   └───────┼────────────────────────────┘
                                           │
                              ┌────────────┼────────────┐
                              ▼            ▼            ▼
                        ┌─────────┐  ┌─────────┐  ┌─────────┐
                        │  kimi   │  │ claude  │  │  gemini │
                        │  -acp   │  │  -acp   │  │  -acp   │
                        └─────────┘  └─────────┘  └─────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- 飞书开发者账号（用于创建 Bot 应用）

### 1. 克隆项目

```bash
git clone https://github.com/yancy-coder/lark-acp.git
cd lark-acp
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app) 创建一个新应用
2. 获取 **App ID** 和 **App Secret**
3. 开启机器人功能，并订阅事件：`im.message.receive_v1`
4. 发布应用版本（需要先通过审核或开启调试模式）

### 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Feishu / Lark app credentials (from https://open.feishu.cn/app)
FEISHU_APP_ID=your_app_id_here
FEISHU_APP_SECRET=your_app_secret_here
```

### 5. 配置 Agents

编辑 `agents.config.json`：

```json
{
  "activeAgent": "kimi",
  "workingDirectory": ".",
  "agents": {
    "kimi": {
      "name": "Kimi Code CLI",
      "command": "kimi",
      "args": ["acp"],
      "env": {}
    },
    "claude": {
      "name": "Claude Code",
      "command": "claude",
      "args": ["--acp"],
      "env": {}
    }
  }
}
```

### 6. 运行

**开发模式：**

```bash
pnpm dev
```

**生产模式：**

```bash
pnpm build
pnpm start
```

---

## 📸 使用截图

<p align="center">
  <img src="test.png" alt="Lark-ACP Demo" width="70%">
</p>

<p align="center">
  <i>在飞书中与 Agent 对话，支持工具调用展示和格式化输出</i>
</p>

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 必填 | 描述 |
|--------|------|------|
| `FEISHU_APP_ID` | ✅ | 飞书应用的 App ID |
| `FEISHU_APP_SECRET` | ✅ | 飞书应用的 App Secret |

### agents.config.json

| 字段 | 类型 | 描述 |
|------|------|------|
| `activeAgent` | string | 默认启动的 Agent ID |
| `workingDirectory` | string | Agent 工作目录 |
| `agents` | Record<string, AgentConfig> | Agent 配置列表 |

#### AgentConfig

| 字段 | 类型 | 描述 |
|------|------|------|
| `name` | string | Agent 显示名称 |
| `command` | string | 启动命令 |
| `args` | string[] | 启动参数 |
| `env` | Record<string, string> | 环境变量 |

---

## 🎮 命令列表

在飞书聊天中，你可以使用以下命令：

| 命令 | 描述 | 示例 |
|------|------|------|
| `/switch <agent>` | 切换到指定的 Agent | `/switch claude` |
| `/reset` | 重置当前会话（清空上下文） | `/reset` |
| `/status` | 查看当前状态 | `/status` |
| `/help` | 显示帮助信息 | `/help` |

### 直接对话

除了命令外，你可以直接发送消息与当前 Agent 对话：

```
你好，请帮我写一个快速排序算法
```

---

## 🤖 支持 Agents

Lark-ACP 支持任何兼容 [Agent Client Protocol](https://github.com/AgentClientProtocol) 的 CLI Agent：

| Agent | 命令 | 状态 |
|-------|------|------|
| [Kimi Code CLI](https://www.moonshot.cn/) | `kimi acp` | ✅ 已支持 |
| [Claude Code](https://claude.ai/) | `claude --acp` | ✅ 已支持 |
| [Gemini CLI](https://deepmind.google/technologies/gemini/) | `gemini --acp` | ✅ 已支持 |
| [Codex CLI](https://openai.com/) | `codex-acp` | ✅ 已支持 |

---

## 📁 项目结构

```
lark-acp/
├── src/
│   ├── index.ts           # 入口文件
│   ├── bridge.ts          # 桥接核心
│   ├── config.ts          # 配置加载
│   ├── feishu/
│   │   ├── adapter.ts     # 飞书适配器
│   │   └── formatter.ts   # 消息格式化
│   └── acp/
│       ├── client.ts      # ACP 客户端
│       └── registry.ts    # Agent 注册表
├── .env.example           # 环境变量模板
├── agents.config.json     # Agent 配置
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔒 安全提示

> ⚠️ **注意**：本项目默认自动批准所有权限请求（`allow_always`），适用于个人或可信环境。在生产环境或共享环境中使用时，请谨慎配置权限策略。

---

## 📄 许可证

[MIT](LICENSE) © 2026

---

## 🙏 致谢

- [Feishu OpenAPI](https://open.feishu.cn/) - 飞书开放平台
- [Agent Client Protocol](https://github.com/AgentClientProtocol) - ACP 协议
- [TypeScript](https://www.typescriptlang.org/) - 编程语言
