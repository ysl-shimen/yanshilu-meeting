const express = require('express');
const router = express.Router();

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 后端项目的基地址
const EXTERNAL_API_BASE = config.backendHost;

// 查询meetingToken信息
router.get('/info', async (req, res) => {
  try {
    const { channelId } = req.query;
    
    // 调用另一个项目的接口获取会议信息
    const url = new URL(`${EXTERNAL_API_BASE}/api/meeting/meeting-token`);
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
    console.error('获取会议信息失败:', error);
    // 如果无法连接到端口服务，返回模拟数据
    res.json({
      code: 500,
      data: null,
      message: 'success'
    });
  }
});

module.exports = router;