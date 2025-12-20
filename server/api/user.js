const express = require('express');
const router = express.Router();
const { produce } = require('@dingrtc/token-generator');

//读取配置文件
const path = require('path');
const fs = require('fs');
const configPath = path.join(__dirname, '../config/config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const EXTERNAL_API_BASE = config.backendHost;

const {describeAppRecordingFiles, stopCloudRecord } = require('../rtc-service');


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


// 处理用户异常离开
router.post('/leave', async (req, res) => {
  try {
    console.log("收到用户异常退出请求...");
    const { channelId, taskId, userId, userCount } = req.body;

    console.log("频道ID：" + channelId + "任务ID：" + taskId + "用户ID：" + userId + "当前用户数：" + userCount);
    //参数校验
    if (!channelId || !taskId || !userId || !userCount) {
      return;
    }

    console.log("当前用户个数：" + userCount);

    // 检查是否是最后一个用户
    if (userCount <= 1) {
      try {
        // 1. 停止阿里云RTC录制
        console.log("最后一个用户离开，开始停止录制，频道ID：" + channelId + "任务ID：" + taskId);
        await stopCloudRecord({ channelId, taskId });
        console.log("停止录制成功...");

        // 2. 获取录制文件信息
        console.log("准备获取录制文件信息...");
        const taskIds = [taskId];
        let tryCount = 0;
        let resCheck;
        while (tryCount < 5) {
          resCheck = await describeAppRecordingFiles({
            channelId: channelId,
            taskId: taskIds
          });
          if (resCheck?.body?.items?.length > 0) {
            break;
          }
          console.log("录制文件未生成，等待1秒后重试...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          tryCount++;
        }
        console.log("录制文件信息获取结果：" + JSON.stringify(resCheck));
        //如果有录制文件信息，则更新相关字段
        if (resCheck?.body?.items?.length > 0) {
          console.log("获取录制文件信息成功...");

          const fileInfo = resCheck.body.items[0]; // 取第一个文件信息
          const updateData = {
            status: "completed",
            started_at: fileInfo.startTs,
            ended_at: Date.now(), // 结束时间设为当前时间
            duration: fileInfo.fileDuration,
            file_size: fileInfo.fileSize,
            file_path: fileInfo.filePath,
            task_id: taskId
          };
          // 3. 更新数据库中的录制信息
          console.log("准备更新录制信息到后台...");
          const targetUrl = `${EXTERNAL_API_BASE}/api/meeting/meeting-record`;
          const postData = JSON.stringify(updateData);

          const response = await fetch(targetUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: postData
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }
          console.log("成功更新录制信息到后台...");
          res.json("成功更新录制信息到后台");
        } else {
          console.log("未能获取到录制文件信息...");
          res.json("未能获取到录制文件信息ok");
        }
      } catch (error) {
        console.error("停止录制或更新信息时出错:", error);
        res.json({
            code: 500,
            data: req.body,
            message: error.message
        });
      }
    }

  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      data: req.body,
      message: error.message
    });
  }
});

module.exports = router;