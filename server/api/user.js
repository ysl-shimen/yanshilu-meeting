const express = require('express');
const router = express.Router();
const { produce } = require('@dingrtc/token-generator');

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const EXTERNAL_API_BASE = config.backendHost;


// 用户登录获取token
router.get('/login', (req, res) => {
  const { appId, channelId, userId } = req.query
  res.json({
    data: {
      token: produce(appId, config.rtc.appKey, channelId, userId),
    }
  });
});

// 根据channelId获取学生和老师信息
router.get('/course-user-info', async (req, res) => {
  try {
    const { channelId } = req.query;

    // 构建目标URL
    const targetUrl = `${EXTERNAL_API_BASE}/api/meeting/user-info`;

    // 准备要发送的数据
    const postData = JSON.stringify({ channelId });

    // 使用fetch发起POST请求
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
    console.error('获取学生和老师信息失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

// 根据userToken获取用户信息
router.get('/user-info', async (req, res) => {
  try {

    const { userToken } = req.query;

    const fullUrl = `${EXTERNAL_API_BASE}/api/meeting/user-info/${userToken}`;

    // 使用fetch发起请求
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 解析JSON响应
    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

module.exports = router;