const express = require('express');
const router = express.Router();

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 后端项目的基地址
const EXTERNAL_API_BASE = config.backendHost;

// 更新meetingToken信息
router.put('/update', async (req, res) => {
    try {
        const updateData = req.body;

        // 调用另一个项目的接口更新录制信息
        const targetUrl = `${EXTERNAL_API_BASE}/api/meeting/course-sessions`;
        const postData = JSON.stringify(updateData);

        console.log('POST DATA:', postData);
        
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
        console.error('更新课程课时信息失败:', error);
        res.json({
            code: 500,
            data: req.body,
            message: 'failed'
        });
    }
});

// 查询课程课时信息
router.get('/info', async (req, res) => {
  try {
    const { channelId } = req.query;
    
    // 调用另一个项目的接口获取会议信息
    const url = new URL(`${EXTERNAL_API_BASE}/api/meeting/course-sessions`);
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
    console.error('获取课程课时信息失败:', error);
    // 如果无法连接到端口服务，返回模拟数据
    res.json({
      code: 500,
      data: null,
      message: 'success'
    });
  }
});

module.exports = router;