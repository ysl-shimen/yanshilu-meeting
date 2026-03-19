import { request } from '~/utils/request';
import { getAppConfig } from '~/utils/appConfig';

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


const getApiBaseUrl = () => getAppConfig().APP_SERVER_DOMAIN;

/**
 * 根据频道ID获取录制信息
 * @param channelId 频道ID
 * @returns 录制信息
 */
export const getRecordInfoByChannelId = async (channelId: string): Promise<RecordInfo[] | null> => {
  try {
    const result = await request('GET', `${getApiBaseUrl()}/api/record/info`, { channelId });
    return result as RecordInfo[];
  } catch (error) {
    console.error('获取录制信息失败:', error);
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
    const result = await request('GET', `${getApiBaseUrl()}/api/meetingToken/info`, { channelId });
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
    const result = await request('POST', `${getApiBaseUrl()}/api/record/files`, { channelId, taskIds, isEncrypt });
    return result as any;
  } catch (error) {
    console.error('获取录制文件列表失败:', error);
    return null;
  }
};


/**
 * 根据channelId获取学生和老师信息
 * @param channelId 频道ID
 * @returns 学生和老师信息
 */
export const courseUserInfo = async (channelId: string): Promise<any> => {
  try {
    return await request('GET', `${getApiBaseUrl()}/api/user/course-user-info`, { channelId });
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
    return await request('GET', `${getApiBaseUrl()}/api/user/user-info`, { userToken });
  } catch (error) {
    console.error('根据token获取用户信息失败:', error);
    throw error;
  }
};


/**
 * 用户加入会议（编排接口：课时更新 + 录制启动）
 * @param channelId 频道ID
 * @returns { taskId, isRecording }
 */
export const joinMeeting = async (channelId: string): Promise<{ taskId: string; isRecording: boolean }> => {
  try {
    const result = await request('POST', `${getApiBaseUrl()}/api/meeting/join`, { channelId });
    return result as { taskId: string; isRecording: boolean };
  } catch (error) {
    console.error('加入会议失败:', error);
    throw error;
  }
};

/**
 * 用户退出会议（编排接口：停止录制 + 更新数据库）
 * @param params { channelId, taskId, userId, userCount }
 */
export const leaveMeeting = async (params: {
  channelId: string;
  taskId: string;
  userId: string;
  userCount: number;
}): Promise<void> => {
  try {
    await request('POST', `${getApiBaseUrl()}/api/meeting/leave`, params);
  } catch (error) {
    console.error('退出会议失败:', error);
    throw error;
  }
};

/**
 * 教师结束会议（编排接口：停录 + 更新会议状态 + 更新课时 + 关闭频道）
 * @param channelId 频道ID
 */
export const endMeeting = async (channelId: string): Promise<void> => {
  try {
    await request('POST', `${getApiBaseUrl()}/api/meeting/end`, { channelId });
  } catch (error) {
    console.error('结束会议失败:', error);
    throw error;
  }
};

export default {
  getRecordInfoByChannelId,
  getRecordFiles,
  courseUserInfo,
  getUserInfoByToken,
  getMeetingInfoByChannelId,
  joinMeeting,
  leaveMeeting,
  endMeeting,
};