const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'ai-team.db');
const DB_DIR = path.dirname(DB_PATH);

// 确保数据目录存在
fs.mkdirSync(DB_DIR, { recursive: true });

// 用于保存数据库的辅助函数
function saveDatabase(db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// 创建数据库实例（异步初始化）
let db = null;
let dbReady = false;

// 初始化数据库的异步函数
async function initDatabase() {
    const SQL = await initSqlJs();
    
    // 如果数据库文件存在，则加载它
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }
    
    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');
    
    // 创建表结构
    db.run(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT DEFAULT '🤖',
        identity TEXT NOT NULL DEFAULT '',
        responsibilities TEXT NOT NULL DEFAULT '[]',
        personality TEXT NOT NULL DEFAULT '{}',
        constraints TEXT NOT NULL DEFAULT '[]',
        tools TEXT NOT NULL DEFAULT '[]',
        model_config TEXT NOT NULL DEFAULT '{}',
        is_template INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        facilitator_id TEXT,
        speaking_order TEXT NOT NULL DEFAULT '[]',
        max_rounds INTEGER DEFAULT 3,
        is_template INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS team_roles (
        team_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        added_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (team_id, role_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_input TEXT NOT NULL,
        team_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        context_summary TEXT DEFAULT '',
        result TEXT DEFAULT '',
        total_tokens INTEGER DEFAULT 0,
        total_duration_ms INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        role_emoji TEXT DEFAULT '🤖',
        round INTEGER NOT NULL DEFAULT 1,
        type TEXT DEFAULT 'opinion',
        content TEXT NOT NULL,
        tool_calls TEXT DEFAULT '[]',
        tokens_used INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    
    db.run(`
      CREATE TABLE IF NOT EXISTS sub_tasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    
    saveDatabase(db);
    
    // 执行种子数据
    seedTemplates();
    
    dbReady = true;
    console.log('✅ Database initialized');
    
    return db;
}

// 种子数据函数
function seedTemplates() {
    const result = db.exec("SELECT COUNT(*) as count FROM roles WHERE is_template = 1");
    const count = result.length > 0 ? result[0].values[0][0] : 0;
    if (count > 0) return;

    const { v4: uuidv4 } = require('uuid');

    const defaultRoles = [
        {
            id: uuidv4(), name: '产品经理', emoji: '📋',
            identity: '你是一位资深产品经理，擅长需求分析、优先级排序和方案设计。你习惯从用户角度思考问题，善于在技术和商业之间找到平衡。',
            responsibilities: JSON.stringify(['分析用户需求，明确目标和范围', '拆解任务，制定执行计划', '协调团队成员，把控项目进度', '汇总讨论结果，做出最终决策']),
            personality: JSON.stringify({ tone: '有条理、善于沟通', style: '喜欢用"从用户角度看"开头', catchphrases: ['让我们先明确需求', '这个优先级怎么排？'] }),
            constraints: JSON.stringify(['不能做纯技术决策', '必须考虑用户体验']),
            tools: JSON.stringify([]), is_template: 1
        },
        {
            id: uuidv4(), name: '前端工程师', emoji: '💻',
            identity: '你是一位经验丰富的前端工程师，精通 React/Vue、CSS 和性能优化。你注重代码质量和用户体验。',
            responsibilities: JSON.stringify(['实现 UI 界面和交互逻辑', '优化前端性能和用户体验', '编写可维护的前端代码', '评估前端技术方案的可行性']),
            personality: JSON.stringify({ tone: '务实、注重细节', style: '喜欢给出具体的技术方案', catchphrases: ['这个交互可以用XX实现', '性能上需要注意'] }),
            constraints: JSON.stringify(['不能修改后端代码', '必须考虑浏览器兼容性']),
            tools: JSON.stringify([]), is_template: 1
        },
        {
            id: uuidv4(), name: '后端工程师', emoji: '⚙️',
            identity: '你是一位资深后端工程师，擅长系统架构设计、API 设计和数据库优化。你追求高可用、高性能的系统设计。',
            responsibilities: JSON.stringify(['设计系统架构和技术方案', '实现 API 接口和业务逻辑', '数据库设计和优化', '评估技术方案的可行性']),
            personality: JSON.stringify({ tone: '严谨、技术导向', style: '喜欢讨论架构和性能', catchphrases: ['这个架构需要考虑扩展性', '数据库查询可以优化'] }),
            constraints: JSON.stringify(['不能修改前端代码', '必须考虑系统安全和性能']),
            tools: JSON.stringify([]), is_template: 1
        },
        {
            id: uuidv4(), name: 'QA 测试工程师', emoji: '🔍',
            identity: '你是一位严谨的 QA 测试工程师，擅长用例设计、边界测试和质量保障。你总能发现别人忽略的问题。',
            responsibilities: JSON.stringify(['设计测试用例和测试方案', '审查方案中的潜在问题', '检查边界条件和异常情况', '评估交付物的质量']),
            personality: JSON.stringify({ tone: '严谨、善于发现问题', style: '喜欢从反面思考', catchphrases: ['这里有个边界情况', '如果用户这样操作会怎样？'] }),
            constraints: JSON.stringify(['不能修改代码', '必须客观评价，不偏袒']),
            tools: JSON.stringify([]), is_template: 1
        },
        {
            id: uuidv4(), name: '数据分析师', emoji: '📊',
            identity: '你是一位资深数据分析师，擅长从数据中发现洞察，用数据驱动决策。你习惯用数据说话，不轻易下结论。',
            responsibilities: JSON.stringify(['分析数据集，提取关键指标', '生成数据可视化建议', '对结论提出数据层面的质疑', '提供数据驱动的建议']),
            personality: JSON.stringify({ tone: '严谨、客观', style: '喜欢引用数据和百分比', catchphrases: ['让我们看看数据怎么说', '这个结论有数据支撑吗？'] }),
            constraints: JSON.stringify(['不能在没有数据支撑的情况下给出结论']),
            tools: JSON.stringify([]), is_template: 1
        },
        {
            id: uuidv4(), name: 'UI 设计师', emoji: '🎨',
            identity: '你是一位有创意的 UI/UX 设计师，擅长视觉设计、交互设计和用户体验优化。你追求美观与实用的平衡。',
            responsibilities: JSON.stringify(['设计界面布局和视觉风格', '制定设计规范和组件库', '优化用户体验流程', '评审设计方案的可行性']),
            personality: JSON.stringify({ tone: '创意、注重美感', style: '喜欢用视觉化的方式表达想法', catchphrases: ['这个设计可以更简洁', '用户体验上可以优化'] }),
            constraints: JSON.stringify(['必须考虑实现的可行性', '不能脱离用户需求做设计']),
            tools: JSON.stringify([]), is_template: 1
        }
    ];

    // 插入角色数据
    for (const role of defaultRoles) {
        db.run(`
            INSERT INTO roles (id, name, emoji, identity, responsibilities, personality, constraints, tools, is_template)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [role.id, role.name, role.emoji, role.identity, role.responsibilities, role.personality, role.constraints, role.tools, role.is_template]);
    }

    // 创建默认团队模板
    const pmRole = defaultRoles[0];
    const feRole = defaultRoles[1];
    const beRole = defaultRoles[2];
    const qaRole = defaultRoles[3];

    const teamId = uuidv4();
    db.run(`
        INSERT INTO teams (id, name, description, facilitator_id, speaking_order, max_rounds, is_template)
        VALUES (?, '产品开发组', '标准的软件产品开发团队，包含产品、前端、后端和测试角色', ?, ?, 3, 1)
    `, [teamId, pmRole.id, JSON.stringify([pmRole.id, beRole.id, feRole.id, qaRole.id])]);

    // 插入团队角色关联
    const teamRoles = [
        [teamId, pmRole.id],
        [teamId, feRole.id],
        [teamId, beRole.id],
        [teamId, qaRole.id]
    ];

    for (const [tid, rid] of teamRoles) {
        db.run('INSERT INTO team_roles (team_id, role_id) VALUES (?, ?)', [tid, rid]);
    }

    saveDatabase(db);
    console.log('✅ Default templates seeded');
}

// 封装数据库操作方法，使其与 better-sqlite3 兼容
const dbWrapper = {
    // 执行 SQL 语句（无返回值）
    run: function(sql, params = []) {
        db.run(sql, params);
        saveDatabase(db);
        return { changes: db.getRowsModified() };
    },
    
    // 执行多条 SQL 语句
    exec: function(sql) {
        db.run(sql);
        saveDatabase(db);
    },
    
    // 查询单行
    get: function(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }
        stmt.free();
        return undefined;
    },
    
    // 查询所有行
    all: function(sql, params = []) {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },
    
    // 准备语句（返回一个封装对象）
    prepare: function(sql) {
        return {
            _sql: sql,
            _stmt: null,
            
            // 执行并返回结果
            run: function(params = {}) {
                const paramArray = this._bindParams(params);
                db.run(this._sql, paramArray);
                saveDatabase(db);
                return { changes: db.getRowsModified() };
            },
            
            // 查询单行
            get: function(params = {}) {
                const paramArray = this._bindParams(params);
                const stmt = db.prepare(this._sql);
                stmt.bind(paramArray);
                if (stmt.step()) {
                    const row = stmt.getAsObject();
                    stmt.free();
                    return row;
                }
                stmt.free();
                return undefined;
            },
            
            // 查询所有行
            all: function(params = {}) {
                const results = [];
                const paramArray = this._bindParams(params);
                const stmt = db.prepare(this._sql);
                stmt.bind(paramArray);
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                return results;
            },
            
            // 将命名参数转换为位置参数
            _bindParams: function(params) {
                if (Array.isArray(params)) {
                    return params;
                }
                // 从 SQL 中提取参数名，然后按顺序获取值
                const paramNames = [];
                const regex = /@(\w+)/g;
                let match;
                while ((match = regex.exec(this._sql)) !== null) {
                    paramNames.push(match[1]);
                }
                return paramNames.map(name => params[name] !== undefined ? params[name] : null);
            }
        };
    },
    
    // 事务封装
    transaction: function(fn) {
        return function(...args) {
            db.run('BEGIN TRANSACTION');
            try {
                const result = fn(...args);
                db.run('COMMIT');
                saveDatabase(db);
                return result;
            } catch (error) {
                db.run('ROLLBACK');
                throw error;
            }
        };
    },
    
    // pragma 命令
    pragma: function(pragmaStr) {
        db.run('PRAGMA ' + pragmaStr);
    },
    
    // 关闭数据库
    close: function() {
        if (db) {
            saveDatabase(db);
            db.close();
        }
    }
};

// 导出初始化函数和数据库包装器
module.exports = {
    init: initDatabase,
    getDb: () => dbWrapper,
    isReady: () => dbReady
};
