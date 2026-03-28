const dbModule = require('./db');
const { v4: uuidv4 } = require('uuid');

// 数据库包装器实例（初始化后设置）
let db = null;

// 预编译语句缓存
const preparedStatements = {};

// 获取数据库实例（确保已初始化）
function getDb() {
    if (!db) {
        db = dbModule.getDb();
    }
    return db;
}

// 获取预编译语句（带缓存）
function getPreparedStatement(sql) {
    const db = getDb();
    if (!preparedStatements[sql]) {
        preparedStatements[sql] = db.prepare(sql);
    }
    return preparedStatements[sql];
}

// ==================== Role CRUD ====================

function getAllRoles() {
    return getDb().all('SELECT * FROM roles ORDER BY created_at DESC');
}

function getRoleById(id) {
    return getDb().get('SELECT * FROM roles WHERE id = ?', [id]);
}

function getRoleTemplates() {
    return getDb().all('SELECT * FROM roles WHERE is_template = 1 ORDER BY name');
}

function createRole(data) {
    const id = uuidv4();
    const db = getDb();
    db.run(
        "INSERT INTO roles (id, name, emoji, identity, responsibilities, personality, constraints, tools, model_config, is_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, data.name, data.emoji || '🤖', data.identity || '', 
         JSON.stringify(data.responsibilities || []), 
         JSON.stringify(data.personality || {}), 
         JSON.stringify(data.constraints || []), 
         JSON.stringify(data.tools || []), 
         JSON.stringify(data.model_config || {}), 
         data.is_template ? 1 : 0]
    );
    return getRoleById(id);
}

function updateRole(id, data) {
    const existing = getRoleById(id);
    if (!existing) return null;
    if (existing.is_template && !data.allowEditTemplate) return null;

    const db = getDb();
    db.run(
        "UPDATE roles SET name = ?, emoji = ?, identity = ?, responsibilities = ?, personality = ?, constraints = ?, tools = ?, model_config = ?, is_template = ?, updated_at = datetime('now') WHERE id = ?",
        [
            data.name ?? existing.name,
            data.emoji ?? existing.emoji,
            data.identity ?? existing.identity,
            data.responsibilities !== undefined ? JSON.stringify(data.responsibilities) : existing.responsibilities,
            data.personality !== undefined ? JSON.stringify(data.personality) : existing.personality,
            data.constraints !== undefined ? JSON.stringify(data.constraints) : existing.constraints,
            data.tools !== undefined ? JSON.stringify(data.tools) : existing.tools,
            data.model_config !== undefined ? JSON.stringify(data.model_config) : existing.model_config,
            data.is_template !== undefined ? (data.is_template ? 1 : 0) : existing.is_template,
            id
        ]
    );
    return getRoleById(id);
}

function deleteRole(id) {
    const result = getDb().run('DELETE FROM roles WHERE id = ? AND is_template = 0', [id]);
    return result.changes > 0;
}

function getTeamRoles(teamId) {
    return getDb().all(
        "SELECT r.* FROM roles r JOIN team_roles tr ON r.id = tr.role_id WHERE tr.team_id = ? ORDER BY tr.added_at",
        [teamId]
    );
}

// ==================== Team CRUD ====================

function getAllTeams() {
    return getDb().all('SELECT * FROM teams ORDER BY created_at DESC');
}

function getTeamById(id) {
    const team = getDb().get('SELECT * FROM teams WHERE id = ?', [id]);
    if (team) {
        // 获取团队成员
        team.roles = getTeamRoles(id);
    }
    return team;
}

function getTeamTemplates() {
    return getDb().all('SELECT * FROM teams WHERE is_template = 1 ORDER BY name');
}

function createTeam(data) {
    const id = uuidv4();
    const db = getDb();
    
    db.run(
        "INSERT INTO teams (id, name, description, facilitator_id, speaking_order, max_rounds, is_template) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, data.name, data.description || '', data.facilitator_id || null, 
         JSON.stringify(data.speaking_order || []), data.max_rounds || 3, data.is_template ? 1 : 0]
    );

    // 添加团队成员
    if (data.role_ids && data.role_ids.length > 0) {
        for (const rid of data.role_ids) {
            db.run('INSERT OR IGNORE INTO team_roles (team_id, role_id) VALUES (?, ?)', [id, rid]);
        }
    }

    return getTeamById(id);
}

function updateTeam(id, data) {
    const existing = getTeamById(id);
    if (!existing) return null;

    const db = getDb();
    db.run(
        "UPDATE teams SET name = ?, description = ?, facilitator_id = ?, speaking_order = ?, max_rounds = ?, is_template = ?, updated_at = datetime('now') WHERE id = ?",
        [
            data.name ?? existing.name,
            data.description ?? existing.description,
            data.facilitator_id !== undefined ? data.facilitator_id : existing.facilitator_id,
            data.speaking_order !== undefined ? JSON.stringify(data.speaking_order) : existing.speaking_order,
            data.max_rounds ?? existing.max_rounds,
            data.is_template !== undefined ? (data.is_template ? 1 : 0) : existing.is_template,
            id
        ]
    );

    // 更新团队成员
    if (data.role_ids !== undefined) {
        db.run('DELETE FROM team_roles WHERE team_id = ?', [id]);
        if (data.role_ids.length > 0) {
            for (const rid of data.role_ids) {
                db.run('INSERT OR IGNORE INTO team_roles (team_id, role_id) VALUES (?, ?)', [id, rid]);
            }
        }
    }

    return getTeamById(id);
}

function deleteTeam(id) {
    const result = getDb().run('DELETE FROM teams WHERE id = ? AND is_template = 0', [id]);
    return result.changes > 0;
}

// ==================== Task CRUD ====================

function getAllTasks() {
    return getDb().all('SELECT * FROM tasks ORDER BY created_at DESC');
}

function getTaskById(id) {
    return getDb().get('SELECT * FROM tasks WHERE id = ?', [id]);
}

function createTask(data) {
    const id = uuidv4();
    getDb().run(
        "INSERT INTO tasks (id, user_input, team_id, status) VALUES (?, ?, ?, ?)",
        [id, data.user_input, data.team_id, 'pending']
    );
    return getTaskById(id);
}

function updateTaskStatus(id, status) {
    getDb().run("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
}

function updateTaskResult(id, data) {
    getDb().run(
        "UPDATE tasks SET status = ?, result = ?, context_summary = ?, total_tokens = ?, total_duration_ms = ?, updated_at = datetime('now') WHERE id = ?",
        [data.status, data.result || '', data.context_summary || '', data.total_tokens || 0, data.duration_ms || 0, id]
    );
}

function deleteTask(id) {
    const db = getDb();
    // 由于外键约束设置了 ON DELETE CASCADE，删除任务会自动删除关联的消息和子任务
    const result = db.run('DELETE FROM tasks WHERE id = ?', [id]);
    return result.changes > 0;
}

// ==================== Message CRUD ====================

function getMessagesByTaskId(taskId) {
    return getDb().all('SELECT * FROM messages WHERE task_id = ? ORDER BY created_at', [taskId]);
}

function createMessage(data) {
    const id = uuidv4();
    getDb().run(
        "INSERT INTO messages (id, task_id, role_id, role_name, role_emoji, round, type, content, tokens_used, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, data.task_id, data.role_id, data.role_name, data.role_emoji, data.round || 1, 
         data.type || 'opinion', data.content, data.tokens_used || 0, data.duration_ms || 0]
    );
    return id;
}

// ==================== Sub-task CRUD ====================

function getSubTasksByTaskId(taskId) {
    return getDb().all('SELECT * FROM sub_tasks WHERE task_id = ? ORDER BY created_at', [taskId]);
}

function createSubTask(data) {
    const id = uuidv4();
    getDb().run(
        "INSERT INTO sub_tasks (id, task_id, role_id, role_name, description, status) VALUES (?, ?, ?, ?, ?, ?)",
        [id, data.task_id, data.role_id, data.role_name, data.description, 'pending']
    );
    return id;
}

function updateSubTaskResult(id, status, result) {
    getDb().run(
        "UPDATE sub_tasks SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?",
        [status, result, id]
    );
}

// 导出初始化函数和所有 CRUD 函数
module.exports = {
    init: dbModule.init,
    isReady: dbModule.isReady,
    getAllRoles, getRoleById, getRoleTemplates, createRole, updateRole, deleteRole, getTeamRoles,
    getAllTeams, getTeamById, getTeamTemplates, createTeam, updateTeam, deleteTeam,
    getAllTasks, getTaskById, createTask, updateTaskStatus, updateTaskResult, deleteTask,
    getMessagesByTaskId, createMessage,
    getSubTasksByTaskId, createSubTask, updateSubTaskResult
};
