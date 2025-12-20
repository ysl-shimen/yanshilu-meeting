'use strict';
// This file is auto-generated, don't edit it
// 依赖的模块可通过下载工程中的模块依赖文件或右上角的获取 SDK 依赖信息查看
const recordService = require('../rtc-service');

async function main(args) {
  try {
    const result = await recordService.stopCloudRecord({
      channelId: '265056',
      taskId: 'e82ee478-c469-4672-bf8e-a1bee26335e2',
    });
    console.log('录制停止成功:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('录制停止失败:', error);
  }
}

main(process.argv.slice(2));