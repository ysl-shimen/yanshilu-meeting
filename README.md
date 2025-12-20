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
- 运行后端项目，第一次启动：执行pm2 start ecosystem.config.js；否则执行：pm2 restart meeting-yanshilu;
## 6.项目配置
- 配置后端访问地址：修改src/config.json文件的APP_SERVER_DOMAIN值为后端部署的域名或者IP地址。
```json
{
  "env": "onertcOnline",
  "appId": "yat86lo5",
  "channelId": "",
  "userId": "",
  "userName": "",
  "token": "",
  "APP_SERVER_DOMAIN": "http://localhost:3001"
}
```
- 配置管理后台访问地址：修改server/config/config.json文件，backendHost值为管理后台的域名或者IP地址，port值为研师录会议项目后台的端口号。
```json
{
  "rtc": {
    "appId": "",
    "appKey": "",
    "templateId": "",
    "accessKeyId": "",
    "accessKeySecret": "",
    "storageConfig": {
      "vendor": 1,
      "region": 1,
      "bucket": "ysl-rtc"
    },
    "configType": "access_key"
  },
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "ysl-rtc",
    "domain": "https://oss.yanshilu.com"
  },
  "backendHost": "https://test.yanshilu.com",
  "port": 3001
}