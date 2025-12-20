'use strict';
// This file is auto-generated, don't edit it
// 依赖的模块可通过下载工程中的模块依赖文件或右上角的获取 SDK 依赖信息查看
const recordService = require('../rtc-service');

async function main(args) {
  try {
    const result = await recordService.startCloudRecord({
      channelId: '265056'
    });
    console.log('录制启动成功:', JSON.stringifyresult);
  } catch (error) {
    console.error('录制启动失败:', error);
  }
}

main(process.argv.slice(2));