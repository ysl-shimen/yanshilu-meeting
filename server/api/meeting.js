const express = require('express');
const router = express.Router();

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 后端项目的基地址
const EXTERNAL_API_BASE = config.backendHost;

const {
  startCloudRecord,
  stopCloudRecord,
  describeCloudRecordStatus,
  describeAppRecordingFiles,
  stopChannel,
} = require('../rtc-service');



// ─────────────────────────────────────────────
// 内部公共函数：停止 RTC 录制 + 异步兜底查询
//
// 主路径：阿里云 Webhook 回调（2001/2002）自动更新数据库
// 兜底路径：回调未到达时（如测试环境域名未配回调），指数退避重试主动查询文件
//
// 重试间隔：15s → 30s → 60s → 120s → 120s，总覆盖约 6 分钟
// 每次重试前先查数据库，若回调已更新（completed/failed）则立即退出
// ─────────────────────────────────────────────
async function stopRecordAndSave(channelId, taskId) {
  console.log(`[stopRecord] 停止录制，channelId: ${channelId}, taskId: ${taskId}`);
  await stopCloudRecord({ channelId, taskId });
  console.log('[stopRecord] 停止录制指令已发送，启动兜底查询任务...');

  // 异步执行，不阻塞调用方
  setImmediate(() => pollRecordFileWithFallback(channelId, taskId));
}

// 指数退避重试间隔（毫秒）
const RETRY_DELAYS = [15000, 30000, 60000, 120000, 120000];

async function pollRecordFileWithFallback(channelId, taskId) {
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    const delay = RETRY_DELAYS[i];
    console.log(`[pollRecord] 第 ${i + 1} 次兜底查询将在 ${delay / 1000} 秒后执行，taskId: ${taskId}`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      // ── 1. 先查数据库当前状态，若回调已处理则退出 ──
      const recordUrl = new URL(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`);
      recordUrl.searchParams.append('channelId', channelId);
      const recordResp = await fetch(recordUrl.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const recordData = await recordResp.json();
      const records = recordData?.data;
      const task = Array.isArray(records)
        ? records.find((r) => r.task_id === taskId)
        : null;

      if (!task) {
        console.warn(`[pollRecord] 未找到 taskId=${taskId} 的录制记录，停止重试`);
        return;
      }

      if (task.status === 'completed' || task.status === 'failed') {
        console.log(`[pollRecord] 回调已处理，当前状态: ${task.status}，退出兜底查询，taskId: ${taskId}`);
        return;
      }

      console.log(`[pollRecord] 数据库状态仍为 ${task.status}，主动查询 RTC 录制文件...`);

      // ── 2. 主动查询 RTC 录制文件 ──
      const fileResult = await describeAppRecordingFiles({ channelId, taskId: [taskId] });
      const items = fileResult?.body?.items;

      if (!items || items.length === 0) {
        console.log(`[pollRecord] 第 ${i + 1} 次查询：录制文件尚未生成，继续等待...`);
        continue;
      }

      // ── 3. 查到文件，更新数据库 ──
      const fileInfo = items[0];
      const updateData = {
        task_id: taskId,
        status: 'completed',
        started_at: fileInfo.startTs,
        ended_at: Date.now(),
        duration: fileInfo.fileDuration,
        file_size: fileInfo.fileSize,
        file_path: fileInfo.filePath,
      };

      const updateResp = await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (updateResp.ok) {
        console.log(`[pollRecord] 兜底查询成功，录制文件信息已更新，taskId: ${taskId}, filePath: ${fileInfo.filePath}`);
      } else {
        console.error(`[pollRecord] 更新录制信息失败: HTTP ${updateResp.status}`);
      }
      return;

    } catch (error) {
      console.error(`[pollRecord] 第 ${i + 1} 次兜底查询出错:`, error.message);
    }
  }

  // 所有重试耗尽，标记为 failed
  console.error(`[pollRecord] 兜底查询已重试 ${RETRY_DELAYS.length} 次仍未获取到文件，标记为 failed，taskId: ${taskId}`);
  try {
    await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId,
        status: 'failed',
        error: '录制文件超时未生成（兜底查询已耗尽）',
      }),
    });
  } catch (error) {
    console.error('[pollRecord] 标记 failed 状态时出错:', error.message);
  }
}

// ─────────────────────────────────────────────
// 接口一：用户加入会议
// 对应前端：InChannel.vue → handleUserJoin()
// 合并了：GET /api/course-session/info、PUT /api/course-session/update、
//         GET /api/record/info、POST /api/record/status、
//         POST /api/record/files、POST /api/record/update、
//         POST /api/record/start、POST /api/record/create
// ─────────────────────────────────────────────
router.post('/join', async (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    return res.status(400).json({ code: 400, data: null, message: 'channelId 不能为空' });
  }

  try {
    // ── Step 1：查询课时信息，若未开始则更新开始时间 ──
    console.log('[join] 查询课程课时信息...');
    const courseSessionUrl = new URL(`${EXTERNAL_API_BASE}/api/meeting/course-sessions`);
    courseSessionUrl.searchParams.append('channelId', channelId);
    const courseSessionResp = await fetch(courseSessionUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const courseSessionData = await courseSessionResp.json();
    const courseSession = courseSessionData?.data;

    if (courseSession && courseSession.actual_started_at === null) {
      console.log('[join] 课时未开始，更新课时开始信息...');
      await fetch(`${EXTERNAL_API_BASE}/api/meeting/course-sessions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          actualStartedAt: new Date(),
          status: 'in_progress',
        }),
      });
      console.log('[join] 更新课时开始信息成功');
    } else {
      console.log('[join] 课时已有开始记录，跳过更新');
    }

    // ── Step 2：查询数据库中的录制任务 ──
    console.log('[join] 查询录制任务信息...');
    const recordInfoUrl = new URL(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`);
    recordInfoUrl.searchParams.append('channelId', channelId);
    const recordInfoResp = await fetch(recordInfoUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const recordInfoData = await recordInfoResp.json();
    const records = recordInfoData?.data;
    // pending：已启动 RTC 但 2000 回调尚未到达；recording：2000 回调已到达
    const recordingTask = Array.isArray(records)
      ? records.find((r) => r.status === 'pending' || r.status === 'recording')
      : null;

    if (recordingTask) {
      // ── Step 3：查询 RTC 侧实际录制状态 ──
      // 目的：判断 RTC 是否真的还在录制，避免重复启动
      console.log('[join] 本地存在录制任务，查询 RTC 实际录制状态...');
      const rtcStatus = await describeCloudRecordStatus({
        channelId,
        taskId: recordingTask.task_id,
      });

      if (rtcStatus?.body?.status === 101) {
        // RTC 录制中，直接复用，无需重新启动
        console.log('[join] RTC 正在录制中，无需重新启动录制');
        return res.json({
          code: 200,
          data: { taskId: recordingTask.task_id, isRecording: true },
          message: 'success',
        });
      }

      // RTC 已停止但数据库状态仍为 recording（上次回调未到达或处理失败）
      // 不在此处主动补查文件，等阿里云 2001/2002 回调自动修正，或下次会议时已是新任务
      console.log('[join] RTC 已停止，本地状态将由回调自动修正，继续启动新录制...');
    }

    // ── Step 4：启动新的云端录制（由 config.json 的 enableRecording 控制）──
    // 每次动态读取配置文件，修改 config.json 后无需重启服务即可生效
    const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!currentConfig.enableRecording) {
      console.log('[join] 录制功能已关闭（enableRecording=false），跳过录制启动');
      return res.json({
        code: 200,
        data: { taskId: null, isRecording: false },
        message: 'success',
      });
    }

    console.log('[join] 启动云端录制...');
    const startResult = await startCloudRecord({ channelId });
    const taskId = startResult?.body?.taskId;
    console.log(`[join] 云端录制启动成功，taskId: ${taskId}`);

    // ── Step 5：将录制任务信息写入数据库（status 初始为 pending，等待 2000 回调更新为 recording）──
    console.log('[join] 写入录制任务到数据库...');
    await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId,
        task_id: taskId,
        status: 'pending',
      }),
    });
    console.log('[join] 录制任务写入成功，等待阿里云 2000 回调更新为 recording 状态');

    res.json({
      code: 200,
      data: { taskId, isRecording: true },
      message: 'success',
    });
  } catch (error) {
    console.error('[join] 处理用户加入会议失败:', error);
    res.status(500).json({ code: 500, data: null, message: error.message });
  }
});


// ─────────────────────────────────────────────
// 接口二：用户退出会议（正常退出 + 异常退出 统一入口）
// 对应前端：InChannel.vue → handleUserLeave() 和 triggerLeaveByBeacon()
// 合并了：POST /api/record/stop、POST /api/record/files（轮询）、POST /api/record/update
// ─────────────────────────────────────────────
router.post('/leave', async (req, res) => {
  console.log('[leave] 收到请求，Content-Type:', req.headers['content-type'], 'body:', req.body);
  const { channelId, taskId, userId, userCount } = req.body;

  if (!channelId || !userId) {
    return res.status(400).json({ code: 400, data: null, message: 'channelId 和 userId 不能为空' });
  }

  // 没有录制任务，直接返回
  if (!taskId) {
    console.log('[leave] 无录制任务，直接返回');
    return res.json({ code: 200, data: null, message: 'success' });
  }

  console.log(`[leave] 用户 ${userId} 退出会议，当前频道人数: ${userCount}`);

  // 立即响应前端，后续录制处理异步完成
  res.json({ code: 200, data: null, message: 'success' });

  // 只有最后一个用户离开时才停止录制
  // 停止后文件生成和数据库更新由阿里云 2001/2002 回调负责
  if (userCount <= 1) {
    console.log('[leave] 最后一个用户离开，停止录制...');
    try {
      await stopRecordAndSave(channelId, taskId);
    } catch (error) {
      console.error('[leave] 停止录制失败:', error);
    }
  } else {
    console.log(`[leave] 频道内还有 ${userCount - 1} 人，不停止录制`);
  }
});


// ─────────────────────────────────────────────
// 接口三：教师结束会议
// 对应前端：ToolBar.vue → onEndMeeting()
// 合并了：GET /api/record/info、POST /api/record/status、
//         POST /api/record/stop、POST /api/record/files（轮询）、
//         POST /api/record/update、POST /api/meetingToken/update、
//         PUT /api/course-session/update、GET /api/channel/stop
// ─────────────────────────────────────────────
router.post('/end', async (req, res) => {
  const { channelId } = req.body;

  if (!channelId) {
    return res.status(400).json({ code: 400, data: null, message: 'channelId 不能为空' });
  }

  try {
    // ── Step 1：查询数据库中的录制任务 ──
    console.log('[end] 查询录制任务信息...');
    const recordInfoUrl = new URL(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`);
    recordInfoUrl.searchParams.append('channelId', channelId);
    const recordInfoResp = await fetch(recordInfoUrl.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const recordInfoData = await recordInfoResp.json();
    const records = recordInfoData?.data;
    // pending：已启动 RTC 但 2000 回调尚未到达；recording：2000 回调已到达
    const recordingTask = Array.isArray(records)
      ? records.find((r) => r.status === 'pending' || r.status === 'recording')
      : null;

    if (recordingTask) {
      // ── Step 2：停止 RTC 录制，文件生成后由阿里云 2001/2002 回调更新数据库 ──
      console.log(`[end] 发现进行中的录制任务: ${recordingTask.task_id}，停止录制...`);
      await stopRecordAndSave(channelId, recordingTask.task_id);
      console.log('[end] 停止录制指令已发送');
    } else {
      console.log('[end] 无进行中的录制任务，跳过录制处理');
    }

    // ── Step 3：更新会议 token 状态为 completed ──
    console.log('[end] 更新会议状态为 completed...');
    await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-token`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, status: 'completed' }),
    });
    console.log('[end] 更新会议状态成功');

    // ── Step 4：更新课时结束时间 ──
    console.log('[end] 更新课时结束时间...');
    await fetch(`${EXTERNAL_API_BASE}/api/meeting/course-sessions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, teacherEndedAt: new Date() }),
    });
    console.log('[end] 更新课时结束时间成功');

    // ── Step 5：关闭阿里 RTC 频道 ──
    console.log('[end] 关闭 RTC 频道...');
    await stopChannel(channelId);
    console.log('[end] RTC 频道已关闭');

    res.json({ code: 200, data: null, message: 'success' });
  } catch (error) {
    console.error('[end] 结束会议失败:', error);
    res.status(500).json({ code: 500, data: null, message: error.message });
  }
});


module.exports = router;
