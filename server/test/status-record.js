'use strict';
// This file is auto-generated, don't edit it
// 依赖的模块可通过下载工程中的模块依赖文件或右上角的获取 SDK 依赖信息查看
const recordService = require('../rtc-service');

async function main(args) {
  try {
    const result = await recordService.describeCloudRecordStatus({
      channelId: '265056',
      taskId: '0fc28772-d59c-4474-9cf6-fba3f29fd65f',
    });
    console.log('录制状态查询成功:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('录制状态查询失败:', error);
  }
}

main(process.argv.slice(2));