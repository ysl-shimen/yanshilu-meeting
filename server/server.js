const express = require('express');
const cors = require('cors');
const { produce } = require('@dingrtc/token-generator');
const recordRouter = require('./api/record');
const meetingTokenRouter = require('./api/meetingToken');
const userRouter = require('./api/user');
const meetingRouter = require('./api/meeting');

const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = express();
const PORT = config.port;

app.use(cors()); // 允许跨域请求

// /api/record/callback 需要原始 body 做签名验证，必须在 express.json() 之前注册
// express.raw() 在路由内部单独处理，这里跳过该路径的全局 JSON 解析
app.use((req, res, next) => {
  if (req.path === '/api/record/callback') return next();
  express.json()(req, res, next);
});

// sendBeacon 在页面卸载时发送的请求 Content-Type 为 text/plain
// express.json() 不会解析 text/plain，req.body 会是空对象 {}
// 用 Object.keys 判断是否为空对象，而非 !req.body（空对象是 truthy）
app.use((req, res, next) => {
  const isTextPlain = req.headers['content-type']?.startsWith('text/plain');
  const isEmptyBody = !req.body || Object.keys(req.body).length === 0;
  if (isTextPlain && isEmptyBody) {
    express.text({ type: 'text/plain' })(req, res, (err) => {
      if (err) return next(err);
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          // body 不是合法 JSON，保持原样
        }
      }
      next();
    });
  } else {
    next();
  }
});

// 录制相关API
app.use('/api/record', recordRouter);
app.use('/api/meetingToken', meetingTokenRouter);
app.use('/api/user', userRouter);
app.use('/api/meeting', meetingRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});