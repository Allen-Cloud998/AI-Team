const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const apiRouter = require('./routes/api');
const { orchestrateTask } = require('./services/agent');
const db = require('./models');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3100;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api', apiRouter);

// WebSocket for real-time task updates
const activeConnections = new Map(); // taskId -> Set<ws>

wss.on('connection', (ws) => {
  console.log('🔗 Client connected');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'subscribe_task') {
        // Subscribe to task updates
        if (!activeConnections.has(msg.taskId)) {
          activeConnections.set(msg.taskId, new Set());
        }
        activeConnections.get(msg.taskId).add(ws);
        ws._subscribedTaskId = msg.taskId;
        console.log(`📡 Client subscribed to task ${msg.taskId}`);
      }

      if (msg.type === 'start_task') {
        // Start task orchestration
        const { taskId, teamId, userInput } = msg;
        console.log(`🚀 Starting task ${taskId} with team ${teamId}`);

        // Broadcast function for this task
        const broadcast = (event) => {
          const connections = activeConnections.get(taskId);
          if (connections) {
            const payload = JSON.stringify(event);
            for (const client of connections) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            }
          }
        };

        // Run orchestration asynchronously
        orchestrateTask(taskId, teamId, userInput, broadcast).then(result => {
          console.log(`✅ Task ${taskId} completed:`, result.success ? 'success' : 'failed');
        }).catch(err => {
          console.error(`❌ Task ${taskId} error:`, err);
          broadcast({ type: 'error', taskId, message: err.message });
        });
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (ws._subscribedTaskId) {
      const connections = activeConnections.get(ws._subscribedTaskId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) activeConnections.delete(ws._subscribedTaskId);
      }
    }
    console.log('🔌 Client disconnected');
  });
});

// SPA fallback - 所有非 API 路由返回 index.html
app.use((req, res, next) => {
  // 跳过 API 路由和静态文件
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 先初始化数据库，再启动服务器
async function startServer() {
  try {
    // 初始化数据库
    console.log('📦 正在初始化数据库...');
    await db.init();
    console.log('✅ 数据库初始化完成');
    
    // 启动服务器
    server.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║   🤖 AI 员工群组系统已启动               ║
  ║   📍 http://localhost:${PORT}              ║
  ╚══════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

startServer();
