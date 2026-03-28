const express = require('express');
const router = express.Router();

const {
  // Roles
  getAllRoles, getRoleById, getRoleTemplates, createRole, updateRole, deleteRole,
  // Teams
  getAllTeams, getTeamById, getTeamTemplates, createTeam, updateTeam, deleteTeam,
  // Tasks
  getAllTasks, getTaskById, createTask, updateTaskStatus, updateTaskResult, deleteTask,
  // Messages
  getMessagesByTaskId,
  // Sub-tasks
  getSubTasksByTaskId
} = require('../models');

// ==================== Roles ====================

router.get('/roles', (req, res) => {
  const includeTemplates = req.query.templates !== 'false';
  const roles = includeTemplates ? getAllRoles() : getAllRoles().filter(r => !r.is_template);
  res.json({ success: true, data: roles });
});

router.get('/roles/templates', (req, res) => {
  res.json({ success: true, data: getRoleTemplates() });
});

router.get('/roles/:id', (req, res) => {
  const role = getRoleById(req.params.id);
  if (!role) return res.status(404).json({ success: false, error: '角色不存在' });
  res.json({ success: true, data: role });
});

router.post('/roles', (req, res) => {
  try {
    const role = createRole(req.body);
    res.json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/roles/:id', (req, res) => {
  try {
    const role = updateRole(req.params.id, req.body);
    if (!role) return res.status(404).json({ success: false, error: '角色不存在或无法编辑模板' });
    res.json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/roles/:id', (req, res) => {
  const deleted = deleteRole(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: '角色不存在或为系统模板' });
  res.json({ success: true });
});

// ==================== Teams ====================

router.get('/teams', (req, res) => {
  const includeTemplates = req.query.templates !== 'false';
  const teams = includeTemplates ? getAllTeams() : getAllTeams().filter(t => !t.is_template);
  res.json({ success: true, data: teams });
});

router.get('/teams/templates', (req, res) => {
  res.json({ success: true, data: getTeamTemplates() });
});

router.get('/teams/:id', (req, res) => {
  const team = getTeamById(req.params.id);
  if (!team) return res.status(404).json({ success: false, error: '团队不存在' });
  res.json({ success: true, data: team });
});

router.post('/teams', (req, res) => {
  try {
    const team = createTeam(req.body);
    res.json({ success: true, data: team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/teams/:id', (req, res) => {
  try {
    const team = updateTeam(req.params.id, req.body);
    if (!team) return res.status(404).json({ success: false, error: '团队不存在' });
    res.json({ success: true, data: team });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/teams/:id', (req, res) => {
  const deleted = deleteTeam(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: '团队不存在或为系统模板' });
  res.json({ success: true });
});

// ==================== Tasks ====================

router.get('/tasks', (req, res) => {
  res.json({ success: true, data: getAllTasks() });
});

router.get('/tasks/:id', (req, res) => {
  const task = getTaskById(req.params.id);
  if (!task) return res.status(404).json({ success: false, error: '任务不存在' });
  const messages = getMessagesByTaskId(req.params.id);
  const subTasks = getSubTasksByTaskId(req.params.id);
  res.json({ success: true, data: { ...task, messages, subTasks } });
});

router.post('/tasks', (req, res) => {
  try {
    const task = createTask(req.body);
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除任务
router.delete('/tasks/:id', (req, res) => {
  try {
    const deleted = deleteTask(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: '任务不存在' });
    res.json({ success: true, message: '任务已删除' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
