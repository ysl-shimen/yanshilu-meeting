'use strict';
// 公共RTC客户端模块
// 依赖的模块可通过下载工程中的模块依赖文件或右上角的获取 SDK 依赖信息查看
const rtc20180111 = require('@alicloud/rtc20180111');
const OpenApi = require('@alicloud/openapi-client');
const Credential = require('@alicloud/credentials');
const fs = require('fs');
const path = require('path');

// 读取配置文件
const configPath = path.join(__dirname, 'config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * 使用凭据初始化账号Client
 * @return Client
 * @throws Exception
 */
function createClient() {
  // 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378664.html。
  let credential = new Credential.default(
    {
    type: config.rtc.configType,
    accessKeyId: config.rtc.accessKeyId,
    accessKeySecret: config.rtc.accessKeySecret,
  }
);
  let openApiConfig = new OpenApi.Config({
    credential: credential,
  });
  // Endpoint 请参考 https://api.aliyun.com/product/rtc
  openApiConfig.endpoint = `rtc.aliyuncs.com`;
  return new rtc20180111.default(openApiConfig);
}

module.exports = {
  createClient
};