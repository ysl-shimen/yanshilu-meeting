import { request } from '~/utils/request';
import configJson from '~/config.json';

// 录制状态类型
export interface RecordInfo {
  id?: number;
  channel_id: string;
  task_id?: string;
  status: 'recording' | 'completed' | 'failed';
  started_at?: string;
  ended_at?: string;
  duration?: number;
  file_size?: number;
  file_path?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

//会议token类型
export interface MeetingToken {
  id: number;
  user_id: number;
  channel_id: string;
  token: string;
  status: string;
}

//会议token类型
export interface CourseSession {
  channelId: string;
  actualStartedAt: Date;
  actualEndedAt: Date;
  teacherEndedAt: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

const API_BASE_URL = configJson.APP_SERVER_DOMAIN; // 后端服务端口

/**
 * 根据频道ID获取录制信息
 * @param channelId 频道ID
 * @returns 录制信息
 */
export const getRecordInfoByChannelId = async (channelId: string): Promise<RecordInfo[] | null> => {
  try {
    const result = await request('GET', `${API_BASE_URL}/api/record/info`, { channelId });
    return result as RecordInfo[];
  } catch (error) {
    console.error('获取录制信息失败:', error);
    return null;
  }
};

/**
 * 创建录制信息
 * @param recordInfo 录制信息
 * @returns 创建结果
 */
export const createRecordInfo = async (recordInfo: RecordInfo): Promise<RecordInfo> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/create`, recordInfo);
    return result as RecordInfo;
  } catch (error) {
    console.error('创建录制信息失败:', error);
    throw error;
  }
};

/**
 * 更新录制信息
 * @param id 录制ID
 * @param recordInfo 更新的录制信息
 * @returns 更新结果
 */
export const updateRecordInfo = async (task_id: string, recordInfo: Partial<RecordInfo>): Promise<RecordInfo> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/update`, { task_id: task_id, ...recordInfo });
    return result as RecordInfo;
  } catch (error) {
    console.error('更新录制信息失败:', error);
    throw error;
  }
};

/**
 * 更新会议token信息
 * @param channel_id 频道ID
 * @returns 更新结果
 */
export const updateMeetingToken = async (channel_id: string, meetingToken: Partial<MeetingToken>): Promise<MeetingToken> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/meetingToken/update`, { channel_id: channel_id, ...meetingToken });
    return result as any;
  } catch (error) {
    console.error('更新会议token信息失败:', error);
    return null;
  }
};

/**
 * 获取会议状态信息
 * @param channel_id 频道ID
 * @returns 更新结果
 */
export const getMeetingInfoByChannelId = async (channelId: string): Promise<MeetingToken[] | null> => {
  try {
    const result = await request('GET', `${API_BASE_URL}/api/meetingToken/info`, { channelId });
    return result as MeetingToken[];
  } catch (error) {
    console.error('获取会议信息失败:', error);
    return null;
  }
};

/**
 * 获取录制文件列表
 * @param channelId 频道ID
 * @returns 录制文件列表
 */
export const getRecordFiles = async (channelId: string, taskIds: string[], isEncrypt: boolean): Promise<any> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/files`, { channelId, taskIds, isEncrypt });
    return result as any;
  } catch (error) {
    console.error('获取录制文件列表失败:', error);
    return null;
  }
};

/**
 * 开始录制
 * @param params 录制参数
 * @returns 录制结果
 */
export const startRecording = async (params: { channelId: string; [key: string]: any }): Promise<any> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/start`, params);
    return result;
  } catch (error) {
    console.error('开始录制失败:', error);
    throw error;
  }
};

/**
 * 停止录制
 * @param params 停止录制参数
 * @returns 停止结果
 */
export const stopRecording = async (params: { channelId: string; taskId: string }): Promise<any> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/stop`, params);
    return result;
  } catch (error) {
    console.error('停止录制失败:', error);
    throw error;
  }
};

/**
 * 获取录制状态
 * @param params 获取录制状态参数
 * @returns 获取录制状态结果
 */
export const recordStatus = async (params: { channelId: string; taskId: string }): Promise<any> => {
  try {
    const result = await request('POST', `${API_BASE_URL}/api/record/status`, params);
    return result;
  } catch (error) {
    console.error('获取录制状态失败:', error);
    throw error;
  }
};

/**
 * 关闭频道，结束会议
 * @param params 停止录制参数
 * @returns 关闭结果
 */
export const stopChannel = async (channelId: string): Promise<any> => {
  try {
    return await request('GET', `${API_BASE_URL}/api/channel/stop`, { channelId });
  } catch (error) {
    console.error('结束会议失败:', error);
    throw error;
  }
};

/**
 * 根据channelId获取学生和老师信息
 * @param channelId 频道ID
 * @returns 学生和老师信息
 */
export const courseUserInfo = async (channelId: string): Promise<any> => {
  try {
    return await request('GET', `${API_BASE_URL}/api/user/course-user-info`, { channelId });
  } catch (error) {
    console.error('获取学生和老师信息失败:', error);
    throw error;
  }
};

/**
 * 根据userToken获取用户信息
 * @param userToken 用户令牌
 * @returns 用户信息
 */
export const getUserInfoByToken = async (userToken: string): Promise<any> => {
  try {
    return await request('GET', `${API_BASE_URL}/api/user/user-info`, { userToken });
  } catch (error) {
    console.error('根据token获取用户信息失败:', error);
    throw error;
  }
};

/**
 * 根据channelId获取课程课时信息
 * @param channelId 频道ID
 * @returns 课程课时信息
 */
export const getCourseSessionByChannel = async (channelId: string): Promise<any> => {
  try {
    return await request('GET', `${API_BASE_URL}/api/course-session/info`, { channelId });
  } catch (error) {
    console.error('根据channelId获取课程课时信息失败:', error);
    throw error;
  }
};

/**
 * 根据channelId更新课程课时信息
 * @param channelId 频道ID
 * @returns 更新结果
 */

export const updateCourseSessionByChannel = async (channelId: string, courseSession: Partial<CourseSession>): Promise<CourseSession> => {
  try {
    return await request('PUT', `${API_BASE_URL}/api/course-session/update`, { channelId, ...courseSession });
  } catch (error) {
    console.error('根据channelId更新课程课时信息失败:', error);
    throw error;
  }
};

export default {
  getRecordInfoByChannelId,
  createRecordInfo,
  updateRecordInfo,
  getRecordFiles,
  startRecording,
  stopRecording,
  stopChannel,
  courseUserInfo,
  getUserInfoByToken,
  getCourseSessionByChannel,
  updateCourseSessionByChannel,
};