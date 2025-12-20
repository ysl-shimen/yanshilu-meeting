<template>
  <a-layout style="min-height: 100vh; width: 100%;">
    <!-- 头部 -->
    <a-layout-header
      style="
        background: linear-gradient(135deg, #1e6fff, #5a8bff);
        padding: 0 24px;
        height: 64px;
        line-height: 64px;
        position: relative;
        z-index: 1;
      "
    >
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
        "
      >
        <a-space align="center">
          <video-camera-outlined style="font-size: 24px" />
          <span style="font-size: 20px; font-weight: 600">研师录会议</span>
        </a-space>
        <a-space align="center">
          <a-avatar size="small" :src="currentUserInfo.avatar" icon="用" />
          <span>{{ currentUserInfo.userName || "用户" }}</span>
        </a-space>
      </div>
    </a-layout-header>

    <!-- 内容区域 -->
    <a-layout-content
      style="
        padding: 8px;
        background: #f5f7fa;
        min-height: calc(100vh - 64px - 69px);
        overflow: visible;
      "
    >
      <!-- 外层容器 - 增大最大宽度 -->
      <div
        style="max-width: 1920px; margin: 0 auto; width: 100%; "
      >
        <!-- API测试区域 -->
        <!-- <a-card
          title="课程信息"
          style="margin-bottom: 24px; width: 100%"
          v-if="channelId"
        > -->
        <!-- <a-space direction="vertical" layout="vertical" style="width: 100%" > -->
        <!-- 使用Descriptions组件展示信息 -->
        <!-- <a-descriptions bordered column="7" size="middle" layout="vertical">
              <a-descriptions-item label="课程">
                {{ currentUserInfo.courseName }}（{{
                  currentUserInfo.courseCode
                }}）
              </a-descriptions-item>
              <a-descriptions-item label="老师">
                {{ currentUserInfo.teacherNickname }}
              </a-descriptions-item>
              <a-descriptions-item label="学生">
                {{ currentUserInfo.studentNickname }}
              </a-descriptions-item>
              <a-descriptions-item label="进度">
                {{ currentUserInfo.lessonNumber }}/{{
                  currentUserInfo.totalLessons
                }}
              </a-descriptions-item>
            </a-descriptions>

            <a-alert
              v-if="error"
              :message="error"
              type="error"
              show-icon
              closable
              @close="error = null"
            />
          </a-space>
        </a-card> -->

        <!-- 主内容区 - 使用Flex布局替代栅格 -->
        <template v-if="recordFiles.length > 0">
          <div style="display: flex; gap: 24px; width: 100%;">
            <!-- 左侧：播放器和信息 - 占据剩余空间 -->
            <div style="flex: 1; min-width: 0">
              <!-- 播放器（新增file-duration传递） -->
              <a-card title="视频播放" style="width: 100%; margin-bottom: 8px">
                <div v-if="currentFile?.filePath">
                  <VideoPlayer
                    :key="currentFile.filePath"
                    :ref="videoPlayerRef"
                    :video-src="currentFile.filePath"
                    :is-playing="isPlaying"
                    :volume="volume"
                    :file-duration="currentFile.fileDuration"
                    @playPause="handlePlayPause"
                    @progressChange="handleProgressChange"
                    @volumeChange="handleVolumeChange"
                    @timeUpdate="handleTimeUpdate"
                    @screenshot="handleScreenshot"
                  />
                </div>
                <div v-else style="text-align: center; padding: 40px 0">
                  <a-empty description="视频文件路径不存在" />
                </div>
              </a-card>

              <!-- 视频信息 -->
              <a-card title="视频信息" style="width: 100%" v-if="currentFile">
                <a-descriptions
                  :column="{ xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 4 }"
                  bordered
                  size="small"
                >
                  <a-descriptions-item label="视频标题">
                    {{ currentUserInfo.courseName}} - 回放视频{{currentFile.index}}
                  </a-descriptions-item>
                  <a-descriptions-item label="开始时间">
                    {{
                      formatTime(currentFile.startTs || currentFile.startTime)
                    }}
                  </a-descriptions-item>
                  <a-descriptions-item label="结束时间">
                    {{ formatEndTime(currentFile) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="文件大小">
                    {{ formatFileSize(currentFile.fileSize) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="视频时长">
                    {{ formatDuration(currentFile) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="创建时间">
                    {{
                      formatTime(
                        currentFile.fileCreateTs || currentFile.createTime
                      )
                    }}
                  </a-descriptions-item>
                  <a-descriptions-item label="分辨率">
                    {{ currentFile.resolution || "1920x1080" }}
                  </a-descriptions-item>
                  <a-descriptions-item label="文件格式">
                    {{
                      currentFile.filePath?.includes(".m3u8")
                        ? "HLS(m3u8)"
                        : "MP4"
                    }}
                  </a-descriptions-item>
                </a-descriptions>
              </a-card>
            </div>

            <!-- 右侧：回放列表 - 增加宽度，保持对齐 -->
            <div style="width: 420px; flex-shrink: 0">
              <a-card
                :title="`回放列表 (${recordFiles.length})`"
                :bordered="false"
                class="video-list-card"
                style="height: fit-content; width: 100%"
              >
                <a-list
                  :data-source="recordFiles"
                  :loading="loadingRecordFiles"
                  size="middle"
                  bordered
                  class="video-list"
                  style="width: 100%"
                >
                  <template #renderItem="{ item, index }">
                    <a-list-item
                      class="video-list-item"
                      @click="playVideo(item)"
                      :class="{ active: currentFile?.taskId === item.taskId }"
                    >
                      <a-list-item-meta>
                        <template #title>
                          <span
                            >{{ currentUserInfo.courseName || "未命名课程" }} -
                            回放视频{{ index + 1 }}</span
                          >
                        </template>
                        <template #description>
                          <a-space size="small">
                            <span>{{ formatDuration(item) }}</span>
                            <span>{{ formatFileSize(item.fileSize) }}</span>
                            <span>{{
                              formatTime(item.startTs || item.startTime).slice(
                                0,
                                16
                              )
                            }}</span>
                          </a-space>
                        </template>
                      </a-list-item-meta>
                    </a-list-item>
                  </template>
                </a-list>
              </a-card>
            </div>
          </div>
        </template>

        <!-- 空状态 -->
        <a-empty
          v-else-if="!loadingRecordFiles"
          description="暂无回放内容"
          style="
            background: white;
            padding: 60px 0;
            border-radius: 8px;
            width: 100%;
            margin-top: 24px;
          "
        >
          <template #image>
            <video-camera-outlined style="font-size: 64px; color: #d9d9d9" />
          </template>
        </a-empty>
      </div>
    </a-layout-content>

    <!-- 底部 -->
    <a-layout-footer
      style="
        text-align: center;
        background: #f0f2f5;
        padding: 16px;
        color: #666;
        height: 69px;
      "
    >
      研师录 ©2025 版权所有
    </a-layout-footer>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { VideoCameraOutlined } from "@ant-design/icons-vue";
import {
  Layout,
  Card,
  Button,
  Avatar,
  List,
  Alert,
  Empty,
  Descriptions,
  Space,
  message,
} from "ant-design-vue";
import { useCurrentUserInfo } from "~/store";
import VideoPlayer from "~/components/Playback/VideoPlayer.vue"; // 引入播放器组件
import { getRecordFiles } from "~/services/recordService"; // 引入录制服务
import { TimeFormatter, SizeFormatter } from "~/utils/formatters";
import { useChannelInfo } from '~/store';

// 模拟数据（完善字段）
const mockVideoData = [
  {
    id: 1,
    title: "课程介绍与复习",
    taskId: "lesson-001",
    startTime: "2023-10-15T09:00:00",
    startTs: "2023-10-15T09:00:00",
    endTime: "2023-10-15T09:45:00",
    fileDuration: 2700000, // 毫秒（45分钟）
    duration: "45:00",
    fileSize: 450000000, // 字节
    filePath:
      "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    createTime: "2023-10-15T10:00:00",
    fileCreateTs: "2023-10-15T10:00:00",
    resolution: "1920x1080",
  },
  {
    id: 2,
    title: "新概念讲解 - 微积分基础",
    taskId: "lesson-002",
    startTime: "2023-10-15T09:45:00",
    startTs: "2023-10-15T09:45:00",
    endTime: "2023-10-15T10:30:00",
    fileDuration: 2700000, // 毫秒（45分钟）
    duration: "45:00",
    fileSize: 480000000, // 字节
    filePath: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    createTime: "2023-10-15T10:45:00",
    fileCreateTs: "2023-10-15T10:45:00",
    resolution: "1920x1080",
  },
  {
    id: 3,
    title: "例题分析与练习",
    taskId: "lesson-003",
    startTime: "2023-10-15T10:30:00",
    startTs: "2023-10-15T10:30:00",
    endTime: "2023-10-15T11:00:00",
    fileDuration: 1800000, // 毫秒（30分钟）
    duration: "30:00",
    fileSize: 320000000, // 字节
    filePath:
      "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_5MB.mp4",
    createTime: "2023-10-15T11:15:00",
    fileCreateTs: "2023-10-15T11:15:00",
    resolution: "1920x1080",
  },
];

const currentUserInfo = useCurrentUserInfo();
const videoPlayerRef = ref<any>(null);

// 组件属性
const props = defineProps<{ channelId: string }>();
const channelId = props.channelId;

// 响应式数据
const loadingRecordFiles = ref(false);
const error = ref<string | null>(null);
const recordFiles = ref<any[]>([]);
const currentFile = ref<any>(null);
const isPlaying = ref(false);
const progress = ref(0);
const currentTime = ref("00:00");
const volume = ref(70);

// 格式化工具函数
const formatTime = (timeString: any) => {
  if (!timeString) return "未知时间";

  try {
    // 如果是数字，视为时间戳
    const timestamp =
      typeof timeString === "number" ? timeString : Date.parse(timeString);
    if (isNaN(timestamp)) return String(timeString);

    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    return String(timeString);
  }
};

const formatEndTime = (file: any) => {
  if (file.endTime) return formatTime(file.endTime);

  if (file.startTs && file.fileDuration) {
    try {
      const startTimestamp =
        typeof file.startTs === "number"
          ? file.startTs
          : Date.parse(file.startTs);
      if (!isNaN(startTimestamp)) {
        const endTimestamp = startTimestamp + file.fileDuration;
        return formatTime(endTimestamp);
      }
    } catch (e) {
      console.warn("计算结束时间失败:", e);
    }
  }

  return "未知时间";
};

const formatFileSize = (fileSize: any) => {
  if (!fileSize) return "未知大小";

  if (typeof fileSize === "number") {
    return SizeFormatter.bytesToMBString(fileSize);
  }

  return String(fileSize);
};

const formatDuration = (file: any) => {
  if (file.fileDuration) {
    // 将毫秒转换为秒，再处理小时、分钟、秒
    const totalSeconds = Math.floor(file.fileDuration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}小时${mins}分钟${secs}秒`; // 或格式化显示为 1:05:30
    } else {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  }

  return file.duration || "未知时长";
};

// 方法
const testGetRecordFiles = async () => {
  try {
    loadingRecordFiles.value = true;
    error.value = null;

    // 检查channel是否存在
    if (!currentUserInfo.channel && !channelId) {
      throw new Error("Channel ID不存在");
    }

    console.log(
      "准备获取录制文件信息: " + (currentUserInfo.channel || channelId)
    );

    // 实际接口调用（注释掉使用模拟数据）
    const resObj = await getRecordFiles(
      currentUserInfo.channel || channelId,
      [],
      true
    );
    console.log("返回数据: ", resObj);
    const res = resObj?.body?.items || [];
    recordFiles.value = Array.isArray(res) ? res : [];
    //设置title
    recordFiles.value.forEach((item, index) => {
      item.index = index + 1;
    });

    // 使用模拟数据测试
    // await new Promise(resolve => setTimeout(resolve, 1000));
    // recordFiles.value = mockVideoData;

    if (recordFiles.value.length > 0 && !currentFile.value) {
      currentFile.value = recordFiles.value[0];
      // isPlaying.value = false;
    }

    message.success(`成功加载${recordFiles.value.length}个视频文件`);
  } catch (err: any) {
    console.error("获取录制文件失败:", err);
    const errorMsg = "获取录制文件失败: " + (err.message || err);
    error.value = errorMsg;
    message.error(errorMsg);
  } finally {
    loadingRecordFiles.value = false;
  }
};

const playVideo = (item: any) => {
  if (!item?.filePath) {
    error.value = "视频文件路径不存在";
    message.warning("视频文件路径不存在");
    return;
  }

  // 重置播放器状态
  isPlaying.value = false;
  progress.value = 0;
  currentTime.value = "00:00";

  // 设置当前播放文件
  currentFile.value = item;

  // 延迟播放，确保组件更新
  setTimeout(() => {
    isPlaying.value = true;
  }, 100);
};

// 播放器事件处理
const handlePlayPause = (value: boolean) => {
  isPlaying.value = value;
};

const handleProgressChange = (value: number) => {
  progress.value = value;
};

const handleVolumeChange = (value: number) => {
  volume.value = value;
};

const handleTimeUpdate = (currentTimeSec: number, durationSec: number) => {
  const mins = Math.floor(currentTimeSec / 60);
  const secs = Math.floor(currentTimeSec % 60);
  currentTime.value = `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const handleScreenshot = (dataUrl: string) => {
  console.log("截图成功:", dataUrl);
  message.success("截图已保存");
};

const channelInfo = useChannelInfo();
// 监听currentFile变化
watch(
  () => currentFile.value,
  (newVal) => {
    if (newVal && newVal.filePath) {
      isPlaying.value = true;
    }
  }
);

// 组件挂载时自动获取录制文件
onMounted(() => {
  if (channelId || currentUserInfo.channel) {
    testGetRecordFiles();
  } else {
    error.value = "Channel ID未配置";
  }

  // 确保摄像头和麦克风已关闭
  if (channelInfo.cameraTrack) {
    channelInfo.cameraTrack.setEnabled(false);
    channelInfo.cameraTrack.stop();
    channelInfo.cameraTrack.close();
    channelInfo.cameraTrack = null;
  }
  
  if (channelInfo.micTrack) {
    channelInfo.micTrack.setEnabled(false);
    channelInfo.micTrack.stop();
    channelInfo.micTrack.close();
    channelInfo.micTrack = null;
  }
});
</script>

<style>
/* 全局样式重置 */
* {
  box-sizing: border-box;
}

body,
html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
}

#app {
  width: 100%;
  height: 100%;
}

/* 布局样式 */
.ant-layout {
  width: 100%;
  min-height: 100vh;
}

.ant-layout-content {
  width: 100%;
  flex: 1;
}

/* 回放列表样式 */
.video-list-card {
  background-color: #fff;
  border: 1px solid #f5f5f5;
}

.video-list {
  border-color: #f5f5f5 !important;
}

.video-list-item {
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5 !important;
}

.video-list-item:hover {
  background-color: #fafafa;
}

.video-list-item.active {
  background-color: #e6f7ff;
  border-left: 3px solid #1890ff;
}

/* 最后一个列表项去掉下边框 */
.video-list .ant-list-item:last-child {
  border-bottom: none !important;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  div[style*="width: 420px; flex-shrink: 0;"] {
    width: 380px !important;
  }
}

@media (max-width: 1024px) {
  div[style*="display: flex; gap: 24px;"] {
    flex-direction: column;
  }

  div[style*="width: 420px; flex-shrink: 0;"] {
    width: 100% !important;
  }
}

@media (max-width: 768px) {
  .ant-layout-header {
    padding: 0 16px !important;
  }

  .ant-layout-content {
    padding: 0px !important;
  }

  div[style*="max-width: 1920px;"] {
    padding: 0 0px !important;
  }
}

@media (max-width: 576px) {
  .ant-layout-header {
    padding: 0 12px !important;
  }

  .ant-layout-content {
    padding: 0px !important;
  }
}
</style>