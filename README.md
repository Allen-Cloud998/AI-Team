# AI Team System - AI员工群组讨论系统

一个基于多智能体协作的AI团队讨论系统，模拟真实团队的多轮结构化讨论流程，帮助用户获得更全面、更专业的解决方案。

## 🌟 项目特点

- **结构化三轮讨论**：主持人开场 → 三轮成员讨论 → 最终总结
- **多角色协作**：产品经理、前端工程师、后端工程师、测试工程师、数据分析师、UI设计师
- **实时讨论展示**：通过WebSocket实时显示讨论过程
- **任务管理**：支持创建、查看、删除讨论任务
- **团队管理**：灵活配置团队成员和发言顺序
- **环境变量配置**：API密钥通过环境变量管理，安全可靠

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/Allen-Cloud998/AI-Team.git
cd AI-Team
```

2. **安装依赖**
```bash
npm install
```

3. **配置API密钥**

复制环境变量模板：
```bash
cp .env.example .env  # Linux/Mac
# 或
copy .env.example .env  # Windows
```

编辑 `.env` 文件，填入你的智谱AI API密钥：
```env
Z_AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
Z_AI_API_KEY=your-api-key-here
```

> 💡 **获取API密钥**：访问 [智谱AI开放平台](https://open.bigmodel.cn/) 注册并创建API密钥

4. **启动服务**
```bash
npm start
```

5. **访问系统**

打开浏览器访问：http://localhost:3100

## 📖 使用指南

### 1. 创建团队

1. 点击"团队"标签
2. 点击"创建团队"
3. 选择团队成员（至少选择2个角色）
4. 设置主持人（通常是产品经理）
5. 保存团队

### 2. 发起讨论任务

1. 点击"新建任务"
2. 选择要使用的团队
3. 输入任务描述（如：设计一个电商网站的首页）
4. 点击"开始讨论"
5. 观察AI团队成员的多轮讨论过程

### 3. 查看讨论结果

- 实时查看每个角色的发言
- 主持人会进行每轮总结
- 最终获得完整的解决方案

## 🏗️ 项目架构

```
ai-team-system/
├── public/                 # 前端静态文件
│   └── index.html         # 主页面
├── src/
│   ├── config/            # 配置模块
│   │   └── index.js       # 环境变量配置加载
│   ├── models/            # 数据模型
│   │   ├── db.js          # 数据库连接(sql.js)
│   │   └── index.js       # CRUD操作
│   ├── routes/            # API路由
│   │   └── api.js         # RESTful API
│   ├── services/          # 业务逻辑
│   │   └── agent.js       # AI讨论编排
│   └── app.js             # Express应用入口
├── .env.example           # 环境变量模板
├── .gitignore             # Git忽略配置
├── package.json           # 项目配置
└── README.md              # 项目文档
```

## 🔄 讨论流程

系统实现了结构化的三轮讨论流程：

```
🎤 第一阶段：主持人开场
   - 明确讨论主题和目标
   - 介绍议程安排
   - 提出需要讨论的关键问题

🔄 第一轮讨论
   ├─ 各成员依次发表初始观点
   └─ 主持人总结共识和分歧

🔄 第二轮讨论
   ├─ 成员深入讨论，回应彼此观点
   └─ 主持人总结并引导方向

🔄 第三轮讨论
   ├─ 成员完善方案，解决分歧
   └─ 主持人总结本轮要点

🎯 最终总结
   - 整合三轮讨论结果
   - 形成可执行的方案
   - 明确后续行动建议
```

## 🛠️ 技术栈

- **后端**：Node.js + Express 5.x
- **数据库**：SQLite (sql.js - 纯JavaScript实现)
- **实时通信**：WebSocket (ws库)
- **前端**：原生HTML/CSS/JavaScript
- **AI接口**：智谱AI API (z-ai-web-dev-sdk)

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `Z_AI_BASE_URL` | 智谱AI API基础URL | `https://open.bigmodel.cn/api/paas/v4` |
| `Z_AI_API_KEY` | 智谱AI API密钥 | 必填 |
| `PORT` | 服务器端口 | `3100` |

### 支持的配置方式（优先级从高到低）

1. **环境变量**（推荐用于生产环境）
2. **.env文件**（推荐用于开发环境）
3. **.z-ai-config文件**（JSON格式，向后兼容）

## 📝 API文档

### 角色管理

- `GET /api/roles` - 获取所有角色
- `GET /api/roles/:id` - 获取角色详情
- `POST /api/roles` - 创建角色
- `PUT /api/roles/:id` - 更新角色
- `DELETE /api/roles/:id` - 删除角色

### 团队管理

- `GET /api/teams` - 获取所有团队
- `GET /api/teams/:id` - 获取团队详情
- `POST /api/teams` - 创建团队
- `PUT /api/teams/:id` - 更新团队
- `DELETE /api/teams/:id` - 删除团队

### 任务管理

- `GET /api/tasks` - 获取所有任务
- `GET /api/tasks/:id` - 获取任务详情
- `POST /api/tasks` - 创建任务
- `DELETE /api/tasks/:id` - 删除任务

### WebSocket事件

- `subscribe_task` - 订阅任务更新
- `start_task` - 开始任务讨论
- `message` - 新消息通知
- `status` - 状态更新
- `completed` - 任务完成

## 🔒 安全说明

- ✅ API密钥通过环境变量管理，不提交到代码仓库
- ✅ 数据库文件本地存储，数据隐私安全
- ✅ `.env`和`.z-ai-config`已添加到`.gitignore`
- ✅ 提供`.env.example`模板供参考

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

[MIT](LICENSE)

## 🙏 致谢

- [智谱AI](https://open.bigmodel.cn/) 提供的大模型API支持
- [sql.js](https://sql.js.org/) 提供的SQLite JavaScript实现

## 📧 联系方式

如有问题或建议，欢迎提交 Issue 或联系项目维护者。

---

**注意**：本项目仅供学习和研究使用，请遵守相关API服务条款。
