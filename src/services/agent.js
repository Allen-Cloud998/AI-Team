const {
  getTeamById, getRoleById, getTeamRoles,
  createMessage, createSubTask, updateSubTaskResult,
  updateTaskStatus, updateTaskResult, getMessagesByTaskId
} = require('../models');
const { getConfig } = require('../config');

let zaiInstance = null;

// 默认使用的模型（智谱 AI 免费模型）
const DEFAULT_MODEL = 'glm-4-flash';

/**
 * 创建 ZAI 实例，使用环境变量配置
 */
async function getZAI() {
  if (!zaiInstance) {
    // 加载配置（优先环境变量）
    const config = getConfig();
    
    // 动态导入 ZAI 类并手动创建实例
    const ZAIModule = await import('z-ai-web-dev-sdk');
    const ZAI = ZAIModule.default;
    
    // 直接使用配置创建实例，绕过配置文件检查
    zaiInstance = new ZAI(config);
  }
  return zaiInstance;
}

/**
 * Build system prompt for a role
 */
function buildSystemPrompt(role, context = '') {
  let prompt = `你是${role.name}${role.emoji}。\n\n`;
  
  if (role.identity) {
    prompt += `## 你的身份\n${role.identity}\n\n`;
  }

  const responsibilities = JSON.parse(role.responsibilities || '[]');
  if (responsibilities.length > 0) {
    prompt += `## 你的职责\n${responsibilities.map(r => `- ${r}`).join('\n')}\n\n`;
  }

  const personality = JSON.parse(role.personality || '{}');
  if (personality.tone || personality.style) {
    prompt += `## 你的风格\n`;
    if (personality.tone) prompt += `- 语气：${personality.tone}\n`;
    if (personality.style) prompt += `- 风格：${personality.style}\n`;
    prompt += '\n';
  }

  const constraints = JSON.parse(role.constraints || '[]');
  if (constraints.length > 0) {
    prompt += `## 你的约束\n${constraints.map(c => `- ${c}`).join('\n')}\n\n`;
  }

  if (context) {
    prompt += `## 当前上下文\n${context}\n\n`;
  }

  prompt += `## 重要规则\n`;
  prompt += `- 你必须严格遵守你的角色设定，不要扮演其他角色\n`;
  prompt += `- 发言要简洁有力，直接给出你的观点和建议\n`;
  prompt += `- 如果你有不同意见，请明确指出并说明理由\n`;
  prompt += `- 用中文回复\n`;

  return prompt;
}

/**
 * Call LLM with a role's system prompt
 */
async function callLLM(systemPrompt, userMessage, history = []) {
  try {
    const zai = await getZAI();
    const messages = [
      { role: 'assistant', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];

    const startTime = Date.now();
    const completion = await zai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      thinking: { type: 'disabled' }
    });
    const duration = Date.now() - startTime;

    const content = completion.choices[0]?.message?.content || '';
    const tokens = Math.ceil((systemPrompt.length + userMessage.length + content.length) / 4);

    if (!content) {
      throw new Error('API 返回空内容');
    }

    return { content, tokens, duration };
  } catch (error) {
    console.error('❌ LLM 调用失败:', error.message);
    return {
      content: `[AI 暂时无法响应，请继续讨论]`,
      tokens: 0,
      duration: 0
    };
  }
}

/**
 * 主持人进行开场发言
 */
async function facilitatorOpening(facilitator, userInput, taskId, wsBroadcast) {
  console.log(`🎯 主持人 ${facilitator.name} 正在进行开场发言...`);
  
  const facilitatorPrompt = buildSystemPrompt(facilitator, 
    `你是本次结构化讨论的主持人。你需要进行开场发言，明确讨论主题、目标及议程安排。`
  );
  
  const openingResult = await callLLM(
    facilitatorPrompt,
    `用户任务：${userInput}

作为主持人，请进行开场发言，包含以下内容：
1. 讨论主题和背景信息
2. 本次讨论的目标和预期成果
3. 三轮讨论的议程安排
4. 需要团队成员重点关注的问题

请用清晰、专业的语言进行开场，引导团队成员积极参与讨论。`
  );

  createMessage({
    task_id: taskId,
    role_id: facilitator.id,
    role_name: facilitator.name,
    role_emoji: facilitator.emoji,
    round: 0,
    type: 'opening',
    content: openingResult.content,
    tokens_used: openingResult.tokens,
    duration_ms: openingResult.duration
  });

  if (wsBroadcast) {
    wsBroadcast({
      type: 'message',
      taskId,
      message: {
        role_name: facilitator.name,
        role_emoji: facilitator.emoji,
        round: 0,
        type: 'opening',
        content: openingResult.content
      }
    });
  }

  console.log(`✅ 主持人开场完成`);
  return openingResult;
}

/**
 * 成员发言环节
 */
async function memberDiscussion(round, otherRoles, facilitator, userInput, taskId, wsBroadcast, context = '') {
  console.log(`🔄 第 ${round} 轮成员讨论开始`);
  
  const allMessages = getMessagesByTaskId(taskId);
  
  for (const role of otherRoles) {
    try {
      const recentHistory = allMessages.slice(-8).map(m => ({
        role: 'user',
        content: `${m.role_emoji} ${m.role_name}: ${m.content}`
      }));

      const rolePrompt = buildSystemPrompt(role, context);

      let userMsg;
      if (round === 1) {
        userMsg = `用户任务：${userInput}

主持人已经明确了讨论主题和议程。

请从${role.name}的专业角度，围绕主题发表你的观点。你需要：
1. 明确表达你对任务的理解
2. 提出你的专业建议和观点
3. 指出可能存在的问题或风险
4. 提出具体的解决方案或思路

请确保发言紧扣主题，内容具体且有建设性。`;
      } else {
        userMsg = `这是第 ${round} 轮讨论。

请基于之前的讨论内容，继续发表你的观点。你可以：
1. 对其他成员的观点进行回应或补充
2. 提出新的见解或建议
3. 深化之前的观点，提供更详细的方案
4. 指出需要进一步讨论的问题

请积极参与，推动讨论深入进行。`;
      }

      console.log(`🎭 ${role.name} 正在发言...`);
      const result = await callLLM(rolePrompt, userMsg, recentHistory);

      createMessage({
        task_id: taskId,
        role_id: role.id,
        role_name: role.name,
        role_emoji: role.emoji,
        round,
        type: 'opinion',
        content: result.content,
        tokens_used: result.tokens,
        duration_ms: result.duration
      });

      if (wsBroadcast) {
        wsBroadcast({
          type: 'message',
          taskId,
          message: {
            role_name: role.name,
            role_emoji: role.emoji,
            round,
            type: 'opinion',
            content: result.content
          }
        });
      }

      console.log(`✅ ${role.name} 发言完成`);
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`❌ ${role.name} 发言失败:`, error.message);
    }
  }
  
  console.log(`📊 第 ${round} 轮成员讨论结束`);
}

/**
 * 主持人进行轮次总结
 */
async function facilitatorRoundSummary(round, facilitator, userInput, taskId, wsBroadcast) {
  console.log(`📝 主持人进行第 ${round} 轮总结...`);
  
  const allMessages = getMessagesByTaskId(taskId);
  const roundMessages = allMessages.filter(m => m.round === round);
  
  const discussionText = roundMessages.map(m => `${m.role_emoji} ${m.role_name}: ${m.content}`).join('\n\n');
  
  const facilitatorPrompt = buildSystemPrompt(facilitator,
    `你是主持人，需要对第 ${round} 轮讨论进行总结。`
  );
  
  let summaryPrompt;
  if (round < 3) {
    summaryPrompt = `用户任务：${userInput}

第 ${round} 轮讨论记录：
${discussionText}

作为主持人，请对本轮讨论进行总结：
1. 提炼本轮形成的主要观点和共识
2. 指出存在的分歧和需要进一步讨论的问题
3. 明确下一轮讨论的重点方向和具体议题
4. 引导团队成员在下一轮中深入探讨

请给出清晰的总结，为下一轮讨论做好铺垫。`;
  } else {
    summaryPrompt = `用户任务：${userInput}

第三轮讨论记录：
${discussionText}

作为主持人，请对第三轮讨论进行总结：
1. 总结本轮讨论的核心观点
2. 整合三轮讨论的主要内容
3. 为最终总结做准备

请简明扼要地总结本轮要点。`;
  }
  
  const summaryResult = await callLLM(facilitatorPrompt, summaryPrompt);

  createMessage({
    task_id: taskId,
    role_id: facilitator.id,
    role_name: facilitator.name,
    role_emoji: facilitator.emoji,
    round,
    type: 'round_summary',
    content: summaryResult.content,
    tokens_used: summaryResult.tokens,
    duration_ms: summaryResult.duration
  });

  if (wsBroadcast) {
    wsBroadcast({
      type: 'message',
      taskId,
      message: {
        role_name: facilitator.name,
        role_emoji: facilitator.emoji,
        round,
        type: 'round_summary',
        content: summaryResult.content
      }
    });
  }

  console.log(`✅ 第 ${round} 轮总结完成`);
  return summaryResult;
}

/**
 * 主持人进行最终总结
 */
async function facilitatorFinalSummary(facilitator, userInput, taskId, wsBroadcast) {
  console.log(`🎯 主持人进行最终总结...`);
  
  const allMessages = getMessagesByTaskId(taskId);
  const discussionText = allMessages.map(m => `${m.role_emoji} ${m.role_name}: ${m.content}`).join('\n\n');
  
  const facilitatorPrompt = buildSystemPrompt(facilitator,
    `你是主持人，需要进行最终总结发言。`
  );
  
  const finalSummaryResult = await callLLM(
    facilitatorPrompt,
    `用户任务：${userInput}

完整讨论记录：
${discussionText}

作为主持人，请进行最终总结发言，包含以下内容：
1. 讨论达成的主要共识和结论
2. 关键分歧点（如有）
3. 可实施的结论性意见和方案
4. 明确的后续行动建议和决策方案
5. 各成员的责任分工（如适用）

请给出全面、清晰的最终总结，为任务执行提供明确指导。`
  );

  createMessage({
    task_id: taskId,
    role_id: facilitator.id,
    role_name: facilitator.name,
    role_emoji: facilitator.emoji,
    round: 4,
    type: 'final_summary',
    content: finalSummaryResult.content,
    tokens_used: finalSummaryResult.tokens,
    duration_ms: finalSummaryResult.duration
  });

  if (wsBroadcast) {
    wsBroadcast({
      type: 'message',
      taskId,
      message: {
        role_name: facilitator.name,
        role_emoji: facilitator.emoji,
        round: 4,
        type: 'final_summary',
        content: finalSummaryResult.content
      }
    });
  }

  console.log(`✅ 最终总结完成`);
  return finalSummaryResult;
}

/**
 * Main orchestration function with structured 3-round discussion
 */
async function orchestrateTask(taskId, teamId, userInput, wsBroadcast) {
  const startTime = Date.now();
  let totalTokens = 0;

  try {
    console.log(`🚀 开始执行任务 ${taskId}，团队 ${teamId}`);
    
    // 1. Load team and roles
    const team = getTeamById(teamId);
    if (!team) throw new Error('团队不存在');
    
    console.log(`📋 团队信息: ${team.name}, 成员数: ${team.roles?.length || 0}`);

    const roles = team.roles;
    if (!roles || roles.length === 0) throw new Error('团队中没有角色');
    
    console.log(`👥 团队成员: ${roles.map(r => r.name).join(', ')}`);

    const facilitator = roles.find(r => r.id === team.facilitator_id) || roles[0];
    
    // 获取非主持人的角色列表
    const otherRoles = roles.filter(r => r.id !== facilitator.id);
    
    if (otherRoles.length === 0) {
      console.warn('⚠️ 团队中没有其他成员可以参与讨论');
    }

    // 2. Update task status
    updateTaskStatus(taskId, 'discussing');
    if (wsBroadcast) wsBroadcast({ type: 'status', taskId, status: 'discussing' });

    // 3. Phase 1: 主持人开场发言
    console.log(`🎤 === 第一阶段：主持人开场 ===`);
    const openingResult = await facilitatorOpening(facilitator, userInput, taskId, wsBroadcast);
    totalTokens += openingResult.tokens;
    await new Promise(r => setTimeout(r, 1000));

    // 4. Phase 2-4: 三轮结构化讨论
    for (let round = 1; round <= 3; round++) {
      console.log(`\n🔄 === 第 ${round} 轮讨论 ===`);
      
      // 成员讨论
      await memberDiscussion(round, otherRoles, facilitator, userInput, taskId, wsBroadcast);
      
      // 主持人总结
      const summaryResult = await facilitatorRoundSummary(round, facilitator, userInput, taskId, wsBroadcast);
      totalTokens += summaryResult.tokens;
      
      await new Promise(r => setTimeout(r, 800));
    }

    // 5. Phase 5: 主持人最终总结
    console.log(`\n🎯 === 最终总结阶段 ===`);
    const finalSummaryResult = await facilitatorFinalSummary(facilitator, userInput, taskId, wsBroadcast);
    totalTokens += finalSummaryResult.tokens;

    // 6. 完成任务
    const totalDuration = Date.now() - startTime;
    
    console.log(`\n✅ 任务 ${taskId} 完成！`);
    console.log(`📊 总耗时: ${(totalDuration/1000).toFixed(1)}s, 总token: ${totalTokens}`);

    updateTaskResult(taskId, {
      status: 'completed',
      result: finalSummaryResult.content,
      context_summary: '',
      total_tokens: totalTokens,
      total_duration_ms: totalDuration
    });

    if (wsBroadcast) {
      wsBroadcast({
        type: 'completed',
        taskId,
        totalTokens,
        totalDuration
      });
    }

    return { success: true, taskId, totalTokens, totalDuration };

  } catch (error) {
    console.error('❌ 任务执行失败:', error);
    updateTaskStatus(taskId, 'failed');
    if (wsBroadcast) {
      wsBroadcast({
        type: 'error',
        taskId,
        message: error.message
      });
    }
    return { success: false, taskId, error: error.message };
  }
}

module.exports = {
  buildSystemPrompt,
  callLLM,
  orchestrateTask,
  getZAI
};
