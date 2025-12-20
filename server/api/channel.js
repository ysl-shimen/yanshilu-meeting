const express = require('express');
const router = express.Router();
// 引入RTC服务
const { stopChannel } = require('../rtc-service');


// 关闭频道，结束会议
router.get('/stop', async (req, res) => {
  try {
    const { channelId } = req.query;
    // 调用阿里云RTC查询录制状态
    const result = await stopChannel(channelId);

    res.json({
      code: 200,
      data: result,
      message: 'success'
    });
  } catch (error) {
    console.error('结束会议失败:', error);
    res.status(500).json({
      code: 500,
      data: null,
      message: error.message
    });
  }
});

module.exports = router;