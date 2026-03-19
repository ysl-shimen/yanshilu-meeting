# 研师录会议 

## 1 项目简介
研师录会议是一个基于阿里云音视频通信SDK的会议系统，基于Vue2.0开发，属于WEB端项目，通过访问会议链接使用，主要功能包括：实时会议、共享屏幕、共享白板、视频聊天、会议录制、视频回放等，目前不支持移动端共享屏幕。

## 2 项目架构
- 前端代码位于src目录下，后端代码位于server目录下，部署时分开部署；
- 业务相关的接口，调用研师录管理后台服务接口实现。

## 3 启动项目

```javascript
$ npm install
$ npm install vite -g
$ npm run start
```
## 4 打包项目

```javascript
$ npm run build
```
## 5 部署项目

1. 部署前端项目
- 备份/var/www/yanshilu-meeting/front目录下的旧文件，包括：assets文件和index.html文件；
- 将部署包上传至服务器，将解压后的assets文件和index.html放在/var/www/yanshilu-meeting/front目录下。
2. 部署后端项目
- 备份/var/www/yanshilu-meeting/backend目录下的旧文件；
- 将server目录下的代码上传到/var/www/yanshilu-meeting/backend文件夹；
- 执行npm install 下载依赖包；
- 运行后端项目，第一次启动：执行pm2 start ecosystem.config.js；否则执行：pm2 reload ecosystem.config.js --update-env（零宕机更新）;

## 6.项目配置
- 配置研师录会议后端访问地址：修改public/config.json文件的APP_SERVER_DOMAIN值为研师录会议后端部署的域名或者IP地址。
- 生产环境地址为：https://meeting.yanshilu.com，
- 测试版环境地址为：https://test.meeting.yanshilu.com
- 修改配置后无需重启

```json
{
  "env": "onertcOnline",
  "appId": "yat86lo5",
  "channelId": "",
  "userId": "",
  "userName": "",
  "token": "",
  "APP_SERVER_DOMAIN": "https://test.meeting.yanshilu.com"
}
```
- 配置管理后台访问地址：修改server/config/config.json文件，backendHost值为管理后台的域名或者IP地址，port值为研师录会议项目后台的端口号。
- 生产环境的backendHost值为：https://yanshilu.com
- 测试环境的backendHost值为：https://test.yanshilu.com
```json
{
  "rtc": {
    "appId": "yat86lo5",
    "appKey": "",
    "templateId": "Rkykv0rE",
    "accessKeyId": "",
    "accessKeySecret": "",
    "storageConfig": {
      "vendor": 1,
      "region": 1,
      "bucket": "ysl-rtc"
    },
    "configType": "access_key",
    "callbackSecret": ""
  },
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "ysl-rtc",
    "domain": "https://oss.yanshilu.com"
  },
  "backendHost": "https://test.yanshilu.com",
  "port": 3001,
  "enableRecording": true
}

## 7.注意事项
- 录像信息采用阿里云回调接口+主动查询来更新
  1.在阿里云配置录制回调接口信息，页面为：https://rtc.console.aliyun.com/?spm=5176.30275541.J_ZGek9Blx07Hclc3Ddt9dg.2.3bf82f3d4YeoKf&scm=20140722.S_card@@%E7%94%9F%E6%80%81%E5%90%88%E4%BD%9C@@586250._.ID_card@@%E7%94%9F%E6%80%81%E5%90%88%E4%BD%9C@@586250-RL_%E9%9F%B3%E8%A7%86%E9%A2%91%E9%80%9A%E4%BF%A1-LOC_2024SPSearchCard-OR_ser-PAR1_21056d4117738014501228332d0c1d-V_4-RE_new5-P0_0-P1_0#/notice/list , 接口地址为：https://test.meeting.yanshilu.com/api/record/callback
  2.结束会议后，阿里云会调用回调接口更新信息，配合主动查询录像信息实现录像信息更新；
  3.由于只能配置一个回调接口，所以配置为正式版的接口，https://meeting.yanshilu.com/api/record/callback， 测试版靠主动查询实现录像更新

- 接口文档：https://docs.yanshilu.com/files/%E7%A0%94%E5%8F%91%E6%96%87%E6%A1%A3/%E7%A0%94%E5%B8%88%E5%BD%95%E4%BC%9A%E8%AE%AE/%E4%BC%9A%E8%AE%AE%E6%96%87%E6%A1%A3.md  