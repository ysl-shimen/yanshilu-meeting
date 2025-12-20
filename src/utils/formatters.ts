/**
 * 时间单位转换工具类
 */
export class TimeFormatter {
  /**
   * 将毫秒转换为分钟，保留2位小数
   * @param ms 毫秒数（数字或字符串类型）
   * @param decimalPlaces 保留小数位数，默认2位
   * @returns 转换后的分钟数（保留指定小数位）
   */
  static msToMinutes(ms: number | string, decimalPlaces: number = 2): number {
    // 类型转换与校验
    const msNum = typeof ms === 'string' ? parseFloat(ms) : ms;

    // 边界处理：非数字或负数返回0
    if (isNaN(msNum) || msNum < 0) {
      return 0;
    }

    // 转换公式：毫秒 / 60000 = 分钟
    const minutes = msNum / 60000;

    // 保留指定小数位（四舍五入）
    return parseFloat(minutes.toFixed(decimalPlaces));
  }

  /**
 * 将毫秒转换为HH:MM:SS格式的时分秒字符串
 * @param milliseconds 毫秒数（非负数）
 * @returns 格式化的时分秒字符串，如：00:00:00、01:23:45
 */
  static formatMillisecondsToTime = (milliseconds: number): string => {
    // 确保输入为非负数
    const ms = Math.max(0, Math.floor(milliseconds));

    // 计算总秒数
    const totalSeconds = Math.floor(ms / 1000);

    // 计算小时、分钟、秒
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // 补零函数：确保两位数
    const padZero = (num: number): string => num.toString().padStart(2, '0');

    // 拼接成HH:MM:SS格式
    return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  };
}

/**
 * 文件大小单位转换工具类
 */
export class SizeFormatter {
  /**
   * 将字节(B)转换为兆(MB)，保留2位小数
   * @param bytes 字节数（数字或字符串类型）
   * @param decimalPlaces 保留小数位数，默认2位
   * @param useBinary 是否使用二进制换算（1MB=1024*1024B），默认true；false则用十进制（1MB=1000*1000B）
   * @returns 转换后的MB数（保留指定小数位）
   */
  static bytesToMB(bytes: number | string, decimalPlaces: number = 2, useBinary: boolean = true): number {
    // 类型转换与校验
    const bytesNum = typeof bytes === 'string' ? parseFloat(bytes) : bytes;

    // 边界处理：非数字或负数返回0
    if (isNaN(bytesNum) || bytesNum < 0) {
      return 0;
    }

    // 换算基数：二进制(1024) 或 十进制(1000)
    const base = useBinary ? 1024 : 1000;
    const mb = bytesNum / (base * base);

    // 保留指定小数位（四舍五入）
    return parseFloat(mb.toFixed(decimalPlaces));
  }

  /**
   * 将字节(B)转换为带单位的MB字符串（如："2.50 MB"）
   * @param bytes 字节数
   * @param decimalPlaces 保留小数位数
   * @param useBinary 是否使用二进制换算
   * @returns 带单位的格式化字符串
   */
  static bytesToMBString(bytes: number | string, decimalPlaces: number = 2, useBinary: boolean = true): string {
    const mb = this.bytesToMB(bytes, decimalPlaces, useBinary);
    return `${mb.toFixed(decimalPlaces)} MB`;
  }

}