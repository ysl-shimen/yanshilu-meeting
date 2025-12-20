'use strict';
// 录制服务模块
const rtcClient = require('./rtc-client');
const rtc20180111 = require('@alicloud/rtc20180111');
const Util = require('@alicloud/tea-util');
const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * 开始云端录制
 * @param {Object} options - 录制参数
 * @param {string} options.appId - 应用ID
 * @param {string} options.channelId - 频道ID
 * @param {string} options.templateId - 模板ID
 * @param {Object} options.storageConfig - 存储配置
 */
async function startCloudRecord(options) {
  let client = rtcClient.createClient();
  let storageConfig = new rtc20180111.StartCloudRecordRequestStorageConfig({
    vendor: config.rtc.storageConfig.vendor,
    region: config.rtc.storageConfig.region,
    bucket: config.rtc.storageConfig.bucket,
    accessKey: config.rtc.accessKeyId,
    secretKey: config.rtc.accessKeySecret,
  });
  let startCloudRecordRequest = new rtc20180111.StartCloudRecordRequest({
    appId: config.rtc.appId,
    channelId: options.channelId,
    templateId: config.rtc.templateId,
    storageConfig: storageConfig,
  });
  let runtime = new Util.RuntimeOptions({});
  
  console.log('正在尝试启动云端录制...');
  console.log('AppId:', startCloudRecordRequest.appId);
  console.log('ChannelId:', startCloudRecordRequest.channelId);
  
  try {
    // 复制代码运行请自行打印 API 的返回值
    let result = await client.startCloudRecordWithOptions(startCloudRecordRequest, runtime);
    console.log('云端录制启动成功:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
    // 错误 message
    console.log('错误码:', error.code);
    console.log('错误信息:', error.message);
    console.log('请求ID:', error.data && error.data.requestId);
    // 诊断地址
    if (error.data && error.data["Recommend"]) {
      console.log('推荐解决方案:', error.data["Recommend"]);
    }
    
    console.log('\n解决方案:');
    console.log('1. 确保您的阿里云账号已开通实时音视频RTC服务');
    console.log('2. 确保使用的AccessKey具有RTC服务的操作权限');
    console.log('3. 如果是RAM用户，请联系主账号管理员为您分配AliyunRTCFullAccess权限');
    console.log('4. 更多信息请参考: https://help.aliyun.com/document_detail/378664.html');
    
    throw error;
  }
}

/**
 * 停止云端录制
 * @param {Object} options - 停止录制参数
 * @param {string} options.appId - 应用ID
 * @param {string} options.channelId - 频道ID
 * @param {string} options.taskId - 任务ID
 */
async function stopCloudRecord(options) {
  let client = rtcClient.createClient();
  let stopCloudRecordRequest = new rtc20180111.StopCloudRecordRequest({
    appId: config.rtc.appId,
    channelId: options.channelId,
    taskId: options.taskId,
  });
  let runtime = new Util.RuntimeOptions({});
  
  try {
    // 复制代码运行请自行打印 API 的返回值
    const res = await client.stopCloudRecordWithOptions(stopCloudRecordRequest, runtime);
    console.log(JSON.stringify(res, null, 2));
    return res;
  } catch (error) {
    // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
    // 错误 message
    console.log(error.message);
    // 诊断地址
    if (error.data && error.data["Recommend"]) {
      console.log(error.data["Recommend"]);
    }
    
    throw error;
  }
}

/**
 * 查询录制状态
 * @param {Object} options - 查询参数
 * @param {string} options.appId - 应用ID
 * @param {string} options.channelId - 频道ID
 * @param {string} options.taskId - 任务ID
 */
async function describeCloudRecordStatus(options) {
  let client = rtcClient.createClient();
  let describeCloudRecordStatusRequest = new rtc20180111.DescribeCloudRecordStatusRequest({
    appId: config.rtc.appId,
    channelId: options.channelId,
    taskId: options.taskId,
  });
  let runtime = new Util.RuntimeOptions({});
  
  try {
    // 复制代码运行请自行打印 API 的返回值
    const res = await client.describeCloudRecordStatusWithOptions(describeCloudRecordStatusRequest, runtime);
    console.log(JSON.stringify(res, null, 2));
    return res;
  } catch (error) {
    // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
    // 错误 message
    console.log(error.message);
    // 诊断地址
    if (error.data && error.data["Recommend"]) {
      console.log(error.data["Recommend"]);
    }
    
    throw error;
  }
}

/**
 * 列出录制文件
 * @param {Object} options - 查询参数
 * @param {string} options.appId - 应用ID
 */
async function describeAppRecordingFiles(options) {
  let client = rtcClient.createClient();
  let curTime = Date.now();
  
  let describeAppRecordingFilesRequest = new rtc20180111.DescribeAppRecordingFilesRequest({
    appId: config.rtc.appId,
    channelId: options.channelId,
    taskIds: options.taskId,
    pageNo: 1,
    pageSize: 100,// 最大100条
    startTs: curTime - 364 * 24 * 60 * 60 * 1000, // 364天前
    endTs: curTime,
  });
  let runtime = new Util.RuntimeOptions({});
  
  try {
    // 复制代码运行请自行打印 API 的返回值
    const res = await client.describeAppRecordingFilesWithOptions(describeAppRecordingFilesRequest, runtime);
    return res;
  } catch (error) {
    // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
    // 错误 message
    console.log(error.message);
    // 诊断地址
    if (error.data && error.data["Recommend"]) {
      console.log(error.data["Recommend"]);
    }
    
    throw error;
  }
}


/**
 * 关闭频道，结束会议
 * @param {Object} options - 参数
 * @param {string} options.channelId - 频道ID
 */
async function stopChannel(channelId) {
  console.log('进入关闭频道方法，参数：' + channelId);
  let client = rtcClient.createClient();
  let stopChannelRequest = new rtc20180111.StopChannelRequest({
    appId: config.rtc.appId,
    channelId: channelId
  });
  let runtime = new Util.RuntimeOptions({});
  
  try {
    // 复制代码运行请自行打印 API 的返回值
    console.log(JSON.stringify(stopChannelRequest));
    const res = await client.stopChannelWithOptions(stopChannelRequest, runtime);
    console.log(JSON.stringify(res, null, 2));
    return res;
  } catch (error) {
    // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
    // 错误 message
    console.log(error.message);
    // 诊断地址
    if (error.data && error.data["Recommend"]) {
      console.log(error.data["Recommend"]);
    }
    
    throw error;
  }
}

module.exports = {
  startCloudRecord,
  stopCloudRecord,
  describeCloudRecordStatus,
  describeAppRecordingFiles,
  stopChannel,
};