const express = require('express');
const router = express.Router();
const crypto = require('crypto');
// 引入RTC服务
const { describeAppRecordingFiles } = require('../rtc-service');
const { generateSignatureUrl } = require('../utils/url-signature');

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 后端项目的基地址
const EXTERNAL_API_BASE = config.backendHost;



// ─────────────────────────────────────────────
// 工具函数：验证阿里云 RTC 回调签名
// 算法：HmacSHA256(requestBody + timestamp, callbackSecret)
// ─────────────────────────────────────────────
function verifyRtcSignature(rawBody, signatureHeader) {
  // 如果未配置回调密钥，跳过验证（开发环境）
  const callbackSecret = config.rtc.callbackSecret;
  if (!callbackSecret) {
    console.warn('[rtcCallback] 未配置 callbackSecret，跳过签名验证');
    return true;
  }

  if (!signatureHeader) {
    console.error('[rtcCallback] 缺少 DingRTC-Signature 请求头');
    return false;
  }

  // 格式：AppId.TimeStamp.Signature
  const parts = signatureHeader.split('.');
  if (parts.length !== 3) {
    console.error('[rtcCallback] DingRTC-Signature 格式错误');
    return false;
  }

  const [, timestamp, signature] = parts;
  const expected = crypto
    .createHmac('sha256', callbackSecret)
    .update(rawBody + timestamp)
    .digest('hex');

  return expected === signature;
}


// ─────────────────────────────────────────────
// 阿里云 RTC 事件回调接口
// 在阿里云 RTC 控制台 → 配置管理 → 事件通知 → 配置回调 URL 为：
//   https://你的域名/api/record/callback
// 建议订阅事件：2000（录制开始）、2001（录制成功）、2002（录制失败）
//
// eventType 说明：
//   001  - 回调验证（控制台配置 URL 时触发，直接返回 200 即可）
//   2000 - 录制开始：更新录制任务状态为 recording，记录开始时间
//   2001 - 录制成功：更新录制文件路径、时长、大小，状态改为 completed
//   2002 - 录制失败：更新录制状态为 failed，记录失败原因
// ─────────────────────────────────────────────
router.post('/callback', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. 获取原始 body 字符串用于签名验证
  const rawBody = req.body.toString('utf8');
  const signatureHeader = req.headers['dingrtc-signature'];

  // 2. 验证签名合法性
  if (!verifyRtcSignature(rawBody, signatureHeader)) {
    console.error('[rtcCallback] 签名验证失败，拒绝请求');
    return res.status(403).json({ code: 403, message: '签名验证失败' });
  }

  // 3. 解析 body
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error('[rtcCallback] body 解析失败:', e.message);
    return res.status(400).json({ code: 400, message: 'body 解析失败' });
  }

  const { eventType, eventData } = payload;
  console.log(`[rtcCallback] 收到回调事件 eventType=${eventType}, channelId=${eventData?.channelId}`);

  // 4. 必须立即返回 200，否则阿里云会以 10 秒间隔重试最多 3 次
  res.status(200).json({ code: 200, message: 'success' });

  // 5. 异步处理业务逻辑（不阻塞响应）
  setImmediate(async () => {
    try {
      // ── 001：回调验证，控制台配置 URL 时触发，直接忽略即可 ──
      if (eventType === '001') {
        console.log('[rtcCallback] 收到回调验证事件，忽略');
        return;
      }

      // ── 2000：录制开始 ──
      // 注意：数据库中的录制记录已由 POST /api/meeting/join（Step 5）提前用 POST 创建，
      // 状态为 recording，但 started_at 尚未写入（因为彼时 RTC 还未真正开始录制）。
      // 此处收到 2000 事件，说明 RTC 侧录制已真正启动，用 PUT 补充写入准确的 started_at。
      if (eventType === '2000') {
        const { channelId, taskId, recordState } = eventData;
        console.log(`[rtcCallback] 录制开始，channelId=${channelId}, taskId=${taskId}`);

        await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: taskId,
            status: 'recording',
            started_at: recordState?.startTs ?? Date.now(),
          }),
        });
        console.log(`[rtcCallback] 录制开始时间已更新，taskId=${taskId}`);
        return;
      }

      // ── 2001：录制成功，文件已生成 ──
      // recordState.fileInfo 中直接包含文件路径、时长、大小，无需再查询
      if (eventType === '2001') {
        const { channelId, taskId, recordState } = eventData;
        console.log(`[rtcCallback] 录制成功，channelId=${channelId}, taskId=${taskId}`);

        const fileInfoList = recordState?.fileInfo ?? [];
        // 过滤出成功的文件（status === 0 表示成功）
        const successFiles = fileInfoList.filter(f => f.status === 0);

        if (successFiles.length === 0) {
          console.warn(`[rtcCallback] 录制成功回调中无有效文件，taskId=${taskId}`);
          return;
        }

        const fileInfo = successFiles[0];
        const updateData = {
          task_id: taskId,
          status: 'completed',
          started_at: recordState?.startTs,
          ended_at: fileInfo.timestamp ?? Date.now(),
          duration: fileInfo.fileDuration,
          file_size: fileInfo.fileSize,
          file_path: fileInfo.filePath,
        };

        const response = await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          console.error(`[rtcCallback] 更新录制信息失败: HTTP ${response.status}`);
          return;
        }
        console.log(`[rtcCallback] 录制文件信息已更新，taskId=${taskId}, filePath=${fileInfo.filePath}`);
        return;
      }

      // ── 2002：录制失败 ──
      if (eventType === '2002') {
        const { channelId, taskId, recordState } = eventData;
        const reason = recordState?.reason ?? '未知原因';
        const code = recordState?.code;
        console.error(`[rtcCallback] 录制失败，channelId=${channelId}, taskId=${taskId}, reason=${reason}, code=${code}`);

        await fetch(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_id: taskId,
            status: 'failed',
            error: `录制失败(code=${code}): ${reason}`,
          }),
        });
        console.log(`[rtcCallback] 录制失败状态已更新，taskId=${taskId}`);
        return;
      }

      console.log(`[rtcCallback] 未处理的事件类型: ${eventType}`);
    } catch (error) {
      console.error(`[rtcCallback] 处理回调事件时出错，eventType=${eventType}:`, error.message);
    }
  });
});

// 根据频道ID获取录制信息
router.get('/info', async (req, res) => {
  try {
    const { channelId } = req.query;

    // 调用另一个项目的接口获取录制信息
    const url = new URL(`${EXTERNAL_API_BASE}/api/meeting/meeting-record`);
    url.searchParams.append('channelId', channelId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // 解析JSON响应
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('获取录制信息失败:', error);
    // 如果无法连接到服务，返回模拟数据
    res.json({
      code: 500,
      data: null,
      message: 'success'
    });
  }
});

// 获取录制文件列表
router.post('/files', async (req, res) => {
  try {
    const { channelId, taskIds, isEncrypt } = req.body;

    // 调用阿里云RTC获取录制文件列表
    const result = await describeAppRecordingFiles({
      channelId: channelId,
      taskIds: taskIds
    });

    const items = result?.body?.items;

    //如果需要利用阿里OSS工具类对回放文件地址进行加密
    if (isEncrypt) {
      if (items && items.length > 0) {
        // 为文件生成签名URL
        for (const item of items) {
          const downloadUrl = await generateSignatureUrl(item.filePath);
          const url = new URL(downloadUrl);
          item.filePath = downloadUrl.replace("https://", "").replace(url.host, config.oss.domain);
        }
      }
    }

    res.json({
      code: 200,
      data: result,
      message: 'success'
    });
  } catch (error) {
    console.error('获取录制文件列表失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

module.exports = router;