/**
 * 配置加载模块
 * 优先级：环境变量 > .env 文件 > .z-ai-config 文件
 */

const fs = require('fs');
const path = require('path');

// 尝试加载 .env 文件
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过注释和空行
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // 去除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // 如果环境变量未设置，则设置它
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// 加载 .env 文件
loadEnvFile();

/**
 * 获取配置
 * 优先从环境变量读取，如果没有则尝试从配置文件读取
 */
function getConfig() {
  // 首先尝试环境变量
  const envBaseUrl = process.env.Z_AI_BASE_URL || process.env.ZAI_BASE_URL;
  const envApiKey = process.env.Z_AI_API_KEY || process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (envBaseUrl && envApiKey) {
    console.log('✅ 已从环境变量加载配置');
    return {
      baseUrl: envBaseUrl,
      apiKey: envApiKey
    };
  }
  
  // 尝试从 .z-ai-config 文件读取（为了向后兼容）
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(require('os').homedir(), '.z-ai-config'),
    '/etc/.z-ai-config'
  ];
  
  for (const filePath of configPaths) {
    try {
      if (fs.existsSync(filePath)) {
        const configStr = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(configStr);
        if (config.baseUrl && config.apiKey) {
          console.log(`✅ 已从配置文件加载: ${filePath}`);
          return config;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`读取配置文件出错 ${filePath}:`, error.message);
      }
    }
  }
  
  // 没有找到配置
  throw new Error(`
❌ 未找到 API 配置！

请通过以下方式之一配置：

1. 环境变量（推荐）：
   Z_AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
   Z_AI_API_KEY=your-api-key

2. 创建 .env 文件：
   Z_AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
   Z_AI_API_KEY=your-api-key

3. 创建 .z-ai-config 文件（JSON格式）：
   {
     "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
     "apiKey": "your-api-key"
   }
`);
}

module.exports = {
  getConfig,
  loadEnvFile
};
