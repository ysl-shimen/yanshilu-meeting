/**
 * 运行时配置加载器
 *
 * 配置文件位于 public/config.json，打包后原样输出到 dist/config.json，
 * 部署时可直接修改该文件而无需重新打包。
 *
 * 使用方式：
 *   在 main.tsx 中 await loadAppConfig() 后再挂载 Vue 应用，
 *   其他文件通过 getAppConfig() 同步获取配置。
 */

export interface AppConfig {
  env: string;
  appId: string;
  channelId: string;
  userId: string;
  userName: string;
  token: string;
  APP_SERVER_DOMAIN: string;
}

let _config: AppConfig | null = null;

export async function loadAppConfig(): Promise<AppConfig> {
  const response = await fetch('/config.json');
  if (!response.ok) {
    throw new Error(`加载配置文件失败: HTTP ${response.status}`);
  }
  _config = await response.json();
  return _config;
}

export function getAppConfig(): AppConfig {
  if (!_config) {
    throw new Error('配置尚未加载，请先在 main.tsx 中调用 loadAppConfig()');
  }
  return _config;
}
