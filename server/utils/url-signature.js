import OSS from 'ali-oss';

// 读取配置文件
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// 获取当前文件的目录路径（替代 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * 定义一个生成预签名 URL
 * @param {string} fileName 文件名
 * @return {string} 签名URL
 */
export async function generateSignatureUrl(fileName) {
  // 获取预签名URL
  const client = await new OSS({
      // 从环境变量中获取访问凭证。运行本代码示例之前，请确保已设置环境变量OSS_ACCESS_KEY_ID和OSS_ACCESS_KEY_SECRET。
      accessKeyId: config.rtc.accessKeyId,
      accessKeySecret: config.rtc.accessKeySecret,
      bucket: config.oss.bucket,
      // yourregion填写Bucket所在地域。以华东1（杭州）为例，Region填写为oss-cn-hangzhou。
      region: config.oss.region,
      // 设置secure为true，使用HTTPS，避免生成的下载链接被浏览器拦截
      secure: true,
      authorizationV4: true
  });

  return await client.signatureUrlV4('GET', 3600, {
      headers: {}, // 请根据实际发送的请求头设置此处的请求头
      queries: {
        "x-oss-process": "hls/sign" 
      }
  }, fileName);
}
