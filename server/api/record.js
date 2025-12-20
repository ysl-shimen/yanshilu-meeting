const express = require('express');
const router = express.Router();
// 引入RTC服务
const { startCloudRecord, stopCloudRecord, describeCloudRecordStatus, describeAppRecordingFiles } = require('../rtc-service');
const { generateSignatureUrl } = require('../utils/url-signature');

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 后端项目的基地址
const EXTERNAL_API_BASE = config.backendHost;

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

// 创建录制信息
router.post('/create', async (req, res) => {
  try {
    const recordInfo = req.body;

    // 调用另一个项目的接口创建录制信息
    const targetUrl = `${EXTERNAL_API_BASE}/api/meeting/meeting-record`;
    const postData = JSON.stringify(recordInfo);
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: postData
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // 解析JSON响应
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('创建录制信息失败:', error);
    // 如果无法连接到服务，返回模拟数据
    res.json({
      code: 200,
      data: {
        id: Math.floor(Math.random() * 10000),
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      message: 'success'
    });
  }
});

// 更新录制信息
router.post('/update', async (req, res) => {
  try {
    const updateData = req.body;

    // 调用另一个项目的接口更新录制信息
    const targetUrl = `${EXTERNAL_API_BASE}/api/meeting/meeting-record`;
    const postData = JSON.stringify(updateData);
    
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: postData
    });

    // 检查响应状态
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    // 解析JSON响应
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('更新录制信息失败:', error);
    // 如果无法连接到服务，返回模拟数据
    res.json({
      code: 200,
      data: req.body,
      message: 'success'
    });
  }
});

// 开始录制
router.post('/start', async (req, res) => {
  try {
    const { channelId, ...otherParams } = req.body;

    // 调用阿里云RTC开始录制
    const result = await startCloudRecord({
      channelId,
      ...otherParams
    });

    res.json({
      code: 200,
      data: result,
      message: 'success'
    });
  } catch (error) {
    console.error('开始录制失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

// 停止录制
router.post('/stop', async (req, res) => {
  try {
    const { channelId, taskId } = req.body;

    // 调用阿里云RTC停止录制
    const result = await stopCloudRecord({
      channelId,
      taskId
    });

    res.json({
      code: 200,
      data: result,
      message: 'success'
    });
  } catch (error) {
    console.error('停止录制失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

// 查询录制状态
router.post('/status', async (req, res) => {
  try {
    const { channelId, taskId } = req.body;

    // 调用阿里云RTC查询录制状态
    const result = await describeCloudRecordStatus({
      channelId,
      taskId
    });

    res.json({
      code: 200,
      data: result,
      message: 'success'
    });
  } catch (error) {
    console.error('查询录制状态失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
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