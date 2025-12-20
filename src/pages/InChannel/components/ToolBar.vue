<template>
  <Row :class="['toolBarWrap', globalFlag.immersive ? 'hideBar' : '']">
    <!-- 1. 左侧占位符：用于平衡右侧按钮，使中间工具栏视觉居中 -->
    <div class="bar-placeholder"></div>

    <!-- 2. 中间工具栏：核心功能区 -->
    <div class="bar-tools">
      <Space :size="[0, 0]" class="tools-space">
        <!-- size设为0，间距由CSS控制 -->
        <div class="toolBtn" @click="onClickCamera">
          <Camera />
          <span>{{ deviceInfo.cameraEnable ? "关摄像头" : "开摄像头" }}</span>
        </div>
        <div class="toolBtn" @click="operateMic">
          <Mic />
          <span>{{ deviceInfo.micEnable ? "静音" : "解除静音" }}</span>
        </div>
        <div
          :class="['toolBtn', { stopShare: channelInfo.screenTrack }]"
          @click="operateScreen"
          v-if="!globalFlag.isMobile"
        >
          <Screen />
          <span>{{ channelInfo.screenTrack ? "结束共享" : "共享" }}</span>
        </div>
        <!-- <div class="toolBtn" @click="toggleRTM">
          <Icon type="icon-icon_XDS_FrameMessage" />
          <span style="margin-top: 4px">聊天</span>
        </div> -->
        <div class="toolBtn" @click="toggleWhiteboard">
          <Icon type="icon-whiteboard1" />
          <span style="margin-top: 4px">{{
            channelInfo.isWhiteboardOpen ? "关闭白板" : "白板"
          }}</span>
        </div>
        <div class="toolBtn" @click="toggleShowSettings">
          <Icon type="icon-icon_x_Settings" />
          <span style="margin-top: 4px">设置</span>
        </div>
      </Space>
    </div>

    <!-- 3. 右侧按钮组：离开/结束会议 -->
    <div class="bar-actions">
      <Space class="buttonGroup" :size="8">
        <Button type="primary" danger @click="onLeave" class="action-btn">
          退出
        </Button>
        <Button
          type="primary"
          danger
          @click="onEndMeeting"
          :loading="isEnding"
          :disabled="isEnding"
          v-if="currentUserInfo.teacherNickname === currentUserInfo.userName"
          class="action-btn"
        >
          结束会议
        </Button>
      </Space>
    </div>

    <Settings v-if="showSetting" :close="toggleShowSettings" />
  </Row>
</template>
<script lang="ts" setup>
import { Button, Row, Space, Col, message } from "ant-design-vue";
import {
  useClient,
  useCurrentUserInfo,
  useGlobalFlag,
  useChannelInfo,
  useDeviceInfo,
  useRTMInfo,
} from "~/store";
import { Camera, Mic, Screen } from "~/components/Device";
import { useDevice } from "~/hooks/device";
import Icon from "~/components/Icon";
import Settings from "./Settings/index.vue";
import { ref } from "vue";
import { useWhiteboardHooks } from "~/hooks/channel";
import { DEFAULT_WHITEBOARD_ID } from "~/constants";
// 引入录制服务
import {
  getRecordInfoByChannelId,
  updateRecordInfo,
  stopRecording,
  getRecordFiles,
  updateMeetingToken,
  stopChannel,
  updateCourseSessionByChannel,
  recordStatus
} from "~/services/recordService";


const props = defineProps<IProps>();
const channelInfo = useChannelInfo();
const deviceInfo = useDeviceInfo();
const globalFlag = useGlobalFlag();
const client = useClient();
const currentUserInfo = useCurrentUserInfo();
const showSetting = ref(false);
const { openWhiteboard, closeWhiteboard } = useWhiteboardHooks();
const { operateCamera, operateMic, operateScreen } = useDevice("in");
const rtmInfo = useRTMInfo();

// 添加结束会议加载状态
const isEnding = ref(false);

interface IProps {
  onLeave: () => void;
  clearRoom: () => void;
  setEndingMeeting: (val: boolean) => void; // 新增
}
const onClickCamera = () => {
  const noCamera = !channelInfo.cameraTrack;
  if (globalFlag.isMobile) {
    operateCamera().then(() => {
      if (!noCamera) return;
      channelInfo.updateTrackStats(currentUserInfo.userId);
      if (!channelInfo.mainViewUserId) {
        channelInfo.mainViewUserId = currentUserInfo.userId;
        channelInfo.mainViewPreferType = "camera";
      }
    });
  } else {
    operateCamera();
  }
};

const onLeave = async () => {
  client.leave();
  props.onLeave();
};

const toggleShowSettings = () => {
  showSetting.value = !showSetting.value;
};

const toggleRTM = () => {
  rtmInfo.enabled = !rtmInfo.enabled;
};

const toggleWhiteboard = () => {
  if (channelInfo.isWhiteboardOpen) {
    closeWhiteboard(DEFAULT_WHITEBOARD_ID);
  } else {
    openWhiteboard(DEFAULT_WHITEBOARD_ID);
  }
};

//结束会议
const onEndMeeting = async () => {
  try {
    // 开始执行时设置加载状态为true
    isEnding.value = true;

    // 标记为正在结束会议，避免触发离开会议逻辑
    props.setEndingMeeting(true);

    //1.从数据库中查询录制任务信息
    const records = await getRecordInfoByChannelId(currentUserInfo.channel);
    const recordingTask = records?.find(
      (record: any) => record.status === "recording"
    );

    //2.如果有录制任务，则停止录制任务，然后从阿里RTC查询录制文件信息，并更新录制文件信息、录制状态到数据库
    if (recordingTask) {
      console.log("本地已经存在录制视频任务,从RTC获取录制状态...");
      
      const rtcRecordStatus = await recordStatus({
        channelId: currentUserInfo.channel,
        taskId: recordingTask.task_id,
      });
      
      if (rtcRecordStatus.body.status === 101) {
        console.log("RTC正在录制中，本地状态也为录制中，准备停止录制任务...");
        await stopRecording({
          channelId: currentUserInfo.channel,
          taskId: recordingTask.task_id,
        });
        console.log("停止录制任务成功...");

        // 2. 获取录制文件信息
        console.log("准备获取录制文件信息...");
        let tryCount = 0;
        let resCheck;
        const taskIds: string[] = [recordingTask.task_id];
        while (tryCount < 5) {
          resCheck = await getRecordFiles(
            currentUserInfo.channel,
            taskIds,
            false
          );
          if (resCheck?.body?.items?.length > 0) {
            break;
          }
          console.log("录制文件未生成，等待1秒后重试...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          tryCount++;
        }
        //如果有录制文件信息，则更新相关字段
        if (resCheck?.body?.items?.length > 0) {
          console.log("获取录制文件信息成功...");
          // 准备更新数据
          let updateData: any = {
            status: "completed",
          };
          const fileInfo = resCheck.body.items[0]; // 取第一个文件信息
          updateData = {
            ...updateData,
            started_at: fileInfo.startTs,
            ended_at: Date.now(), // 结束时间设为当前时间
            duration: fileInfo.fileDuration,
            file_size: fileInfo.fileSize,
            file_path: fileInfo.filePath,
          };
          // 3. 更新数据库中的录制信息
          console.log("准备更新录制信息到后台...");
          await updateRecordInfo(recordingTask.task_id, updateData);
          message.success("录像信息已经保存");
        } else {
          console.log("未能获取到录制文件信息...");
        }
      }
      else {
        console.log("RTC已经停止录制，本地状态为录制中，说明上次录制后未更新录制信息...");
        const taskIds: string[] = [recordingTask.task_id];
        const taskFiles = await getRecordFiles(
          currentUserInfo.channel,
          taskIds,
          false
        );
        if (taskFiles?.body?.items?.length > 0) {
          console.log("当前RTC有录制文件，说明上次录制后未更新录制信息，准备更新数据库...");
          let updateData: any = {
            status: "completed",
          };
          const fileInfo = taskFiles.body.items[0]; // 取第一个文件信息
          updateData = {
            ...updateData,
            started_at: fileInfo.startTs,
            ended_at: Date.now(), // 结束时间设为当前时间
            duration: fileInfo.fileDuration,
            file_size: fileInfo.fileSize,
            file_path: fileInfo.filePath,
          };
          // 3. 更新数据库中的录制信息
          console.log("准备更新录制信息到后台...");
          await updateRecordInfo(recordingTask.task_id, updateData);
          console.log("更新录制信息到后台成功...");
        } else {
          console.log("未获取到录制文件信息...");
        }
      }
    }

    // 4.更新会议状态
    await updateMeetingToken(currentUserInfo.channel, { status: "completed" });
    console.log("会议状态已更新为完成...");

    // 5.更新课程课时信息
    console.log("开始更新课时结束信息...");
    await updateCourseSessionByChannel(currentUserInfo.channel, {
      teacherEndedAt: new Date(),
    });
    console.log("更新课时结束信息成功...");

    // 6.关闭频道，结束会议
    console.log("准备结束会议...");
    await stopChannel(currentUserInfo.channel);
    message.success("结束会议成功");
    console.log("会议已结束...");

    // 6.离开频道并清理数据
    client.leave();
    props.onLeave();
    props.clearRoom();
  } catch (error) {
    console.log("结束会议失败：" + error);
    message.error("结束会议失败：" + (error.message || "未知错误"));
  } finally {
    // 重置结束会议标记
    props.setEndingMeeting(false);
    // 重置加载状态
    isEnding.value = false;
  }
};
</script>
<style lang="less" scoped>
@import url("../index.module.less");
</style>