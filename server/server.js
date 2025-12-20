const express = require('express');
const cors = require('cors');
const { produce } = require('@dingrtc/token-generator');
const recordRouter = require('./api/record');
const meetingTokenRouter = require('./api/meetingToken');
const channelRouter = require('./api/channel');
const userRouter = require('./api/user');
const courseSessionRouter = require('./api/course-session');

const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = express();
const PORT = config.port;

app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析JSON请求体

// 录制相关API
app.use('/api/record', recordRouter);
app.use('/api/meetingToken', meetingTokenRouter);
app.use('/api/channel', channelRouter);
app.use('/api/user', userRouter);
app.use('/api/course-session', courseSessionRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});