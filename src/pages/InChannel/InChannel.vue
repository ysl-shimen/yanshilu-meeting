<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch, watchEffect } from "vue";
import SmallView from "./components/SmallView.vue";
import MainView from "./components/MainView.vue";
import Whiteboard from "./components/Whiteboard.vue";
import ToolBar from "./components/ToolBar.vue";
import { NetworkDetector } from "./components/NetworkBar";
import Icon from "~/components/Icon";
import {
  useChannel,
  useNetworkStats,
  useWhiteboardHooks,
} from "~/hooks/channel";
import { parseTime, logger } from "~/utils/tools";
import {
  Divider,
  Col,
  message,
  Radio,
  RadioGroup,
  Row,
  Space,
  Tooltip,
} from "ant-design-vue";
import DingRTC from "dingrtc";
import {
  useClient,
  useGlobalFlag,
  useChannelInfo,
  useCurrentUserInfo,
  useDeviceInfo,
  useAsrInfo,
  useRTMInfo,
} from "~/store";
import Subtitle from "./components/Subtitle/SubtitleBar.vue";
import ChatRoom from "./components/ChatRoom/index.vue";
// 引入录制服务
import {
  getRecordInfoByChannelId,
  createRecordInfo,
  updateRecordInfo,
  stopRecording,
  getRecordFiles,
} from "~/services/recordService";
import {
  startRecording,
  getCourseSessionByChannel,
  updateCourseSessionByChannel,
  recordStatus,
} from "~/services/recordService";
import configJson from "~/config.json";

// 定义类型别名，避免直接从 dingrtc 导入不存在的类型
type Group = any;
type GroupPropertyUpdateTypes = any;
type GroupUser = any;
type LocalVideoTrack = any;
type NetworkQuality = any;

const rtcStatsTimer = ref(0);
const wrapRef = ref(null);
const timeLeftTimer = ref(0);
const fullscreen = ref(false);
const channelInfo = useChannelInfo();
const asrInfo = useAsrInfo();
const rtmInfo = useRTMInfo();
const client = useClient();
const globalFlag = useGlobalFlag();
const deviceInfo = useDeviceInfo();
const currentUserInfo = useCurrentUserInfo();
const { subscribe, checkMainview } = useChannel();
const { getRtcStats, getRemoteUserNetworkStats } = useNetworkStats();
const timeLeft = ref(channelInfo.timeLeft - 1);
const gridHeight = ref(0);

// 录制相关状态
const isRecording = ref(false);
const recordInfo = ref<any>(null);
const recordTimer = ref(0);

const immersiveTimer = ref(0);

// 添加结束会议标记
const isEndingMeeting = ref(false);

// 新增：设置结束会议状态的方法
const setEndingMeeting = (val: boolean) => {
  isEndingMeeting.value = val;
};

// 标记是否已经处理过离开逻辑，防止重复触发
const hasHandledLeave = ref(false);

// 处理用户加入逻辑
const handleUserJoin = async () => {
  const channelId = currentUserInfo.channel;

  try {
    //查询课程课时信息
    console.log("开始查询课程课时信息...");
    const courseSession = await getCourseSessionByChannel(channelId);
    console.log("课程课时信息:", courseSession);
    if (courseSession.actual_started_at !== null) {
      console.log("已经有课时信息，不用更新课时开始信息...");
    } else {
      console.log("没有课时信息，开始更新课时开始信息...");
      await updateCourseSessionByChannel(channelId, {
        actualStartedAt: new Date(),
        status: "in_progress",
      });
      console.log("更新课时开始信息成功...");
    }

    //检查录制状态：如果正在录制，则不处理
    console.log("开始查询录制状态...");
    const records = await getRecordInfoByChannelId(channelId);
    const recordingTask = records?.find(
      (record: any) => record.status === "recording"
    );

    if (recordingTask) {
      console.log("本地已经存在录制视频任务,从RTC获取录制状态...");
      const rtcRecordStatus = await recordStatus({
        channelId,
        taskId: recordingTask.task_id,
      });

      if (rtcRecordStatus.body.status === 101) {
        message.success("已经存在录制视频任务");
        console.log("RTC正在录制中，本地状态也为录制中，无需启动录制任务...");
        currentUserInfo.taskId = recordingTask.task_id;
        return;
      } else {
        console.log("RTC已经停止录制，本地状态为录制中，说明上次录制后未更新录制信息...");
        const taskIds: string[] = [recordingTask.task_id];
        const taskFiles = await getRecordFiles(
          currentUserInfo.channel,
          taskIds,
          false
        );
        if (taskFiles?.body?.items?.length > 0) {
          console.log(
            "当前RTC有录制文件，说明上次录制后未更新录制信息，准备更新数据库..."
          );
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
          currentUserInfo.taskId = recordingTask.task_id;
          return;
        }
      }
    }
    //检查录制状态：如果没有录制，则新增录制任务，并开启录制
    console.log("录制任务未运行，准备启动录制...");
    // 启动阿里云RTC录制
    const result = await startRecording({
      channelId: channelId,
    });
    message.success("开启录制视频成功");
    console.log("启动录制成功...");

    //创建录像信息到数据库
    await createRecordInfo({
      channel_id: channelId,
      task_id: result.body.taskId,
      status: "recording",
    });
    console.log(
      "创建录制记录成功，channelId：" +
        channelId +
        "taskId:" +
        result.body.taskId
    );

    recordInfo.value = {
      channel_id: channelId,
      task_id: result.body.taskId,
      status: "recording",
    };
    isRecording.value = true;
    currentUserInfo.taskId = result.body.taskId;
  } catch (error) {
    console.error("处理用户加入时出错:", error);
    message.error("处理录制功能时出错");
  } finally {
    // 设置默认主视频为当前用户（无论录制是否成功）
    channelInfo.$patch({
      mainViewUserId: currentUserInfo.userId,
      mainViewPreferType: "camera", // 默认优先显示摄像头
    });
  }
};

// 处理用户离开逻辑
const handleUserLeave = async () => {
  console.log("开始执行用户正常退出逻辑...");
  if (hasHandledLeave.value) return; // 防止冲突

  //如果没有在录制，直接返回
  if (!currentUserInfo.taskId) {
    return;
  }

  console.log("当前用户个数：" + channelInfo.allUsers.length);
  // 检查是否是最后一个用户
  if (channelInfo.allUsers.length <= 1) {
    try {
      // 1. 停止阿里云RTC录制
      console.log(
        "最后一个用户离开，开始停止录制，频道ID：" +
          currentUserInfo.channel +
          "任务ID：" +
          currentUserInfo.taskId
      );
      await stopRecording({
        channelId: currentUserInfo.channel,
        taskId: currentUserInfo.taskId,
      });
      console.log("停止录制成功...");

      // 2. 获取录制文件信息
      console.log("准备获取录制文件信息...");
      const taskIds: string[] = [currentUserInfo.taskId];
      let tryCount = 0;
      let resCheck;
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
        await updateRecordInfo(currentUserInfo.taskId, updateData);
        message.success("录像信息已经保存");
      } else {
        console.log("未能获取到录制文件信息...");
      }

      // 4.重置状态
      // 在逻辑最后标记已处理
      hasHandledLeave.value = true;
      recordInfo.value = null;
      isRecording.value = false;
      currentUserInfo.taskId = "";
      client.leave();
    } catch (error) {
      console.error("停止录制或更新信息时出错:", error);
      // 更新录制状态为失败
      if (recordInfo.value && currentUserInfo.taskId) {
        console.log(
          "更新录制信息为失败状态，任务ID：" + currentUserInfo.taskId
        );
        await updateRecordInfo(currentUserInfo.taskId, {
          status: "failed",
          error: "停止录制出错" + error.message || "未知错误",
        });
      }
    }
  }
};

// 用户异常退出逻辑：如果不点击离开按钮，而是直接关闭页面或刷新页面或关闭进程，则调用此方法
const triggerLeaveByBeacon = () => {
  console.log("开始执行用户异常退出逻辑...");
  if (hasHandledLeave.value) return;

  // 1. 校验必要参数（和原方法一致）
  if (!currentUserInfo.taskId || !currentUserInfo.channel) return;

  // 2. 准备参数（仅传递关键值，后端完成所有逻辑）
  const data = {
    channelId: currentUserInfo.channel,
    taskId: currentUserInfo.taskId,
    userId: currentUserInfo.userId, // 可选，用于后端校验用户
    userCount: channelInfo.allUsers.length,
  };

  // 3. 转换为Blob（支持JSON格式，适配Beacon）
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });

  // 4. 调用后端接口（Beacon保证请求发送成功）
  console.log("准备调用后端接口处理异常退出，参数：" + JSON.stringify(data));
  const baseUrl = configJson.APP_SERVER_DOMAIN;
  const isSuccess = navigator.sendBeacon(`${baseUrl}/api/user/leave`, blob);
  console.log("准备调用后端接口处理异常退出，参数：" + JSON.stringify(data));

  // 5. 兜底：Beacon失败时用同步XHR
  if (!isSuccess) {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", `${baseUrl}/api/user/leave`, false); // 同步请求
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));
  }

  hasHandledLeave.value = true;
  console.log("用户异常退出逻辑执行完成...");
};

const handlePageUnload = (event: Event) => {
  // 只有在没有正常结束会议，且没有点击离开按钮的情况下触发
  console.log("=======进入handlePageUnload方法=======");
  console.log(!isEndingMeeting.value);
  console.log(!hasHandledLeave.value);
  // if (event.type === "beforeunload") {
  //   event.preventDefault();
  //   (event as BeforeUnloadEvent).returnValue = "确定要离开会议吗？";
  // }
  if (!isEndingMeeting.value && !hasHandledLeave.value) {
    triggerLeaveByBeacon();
  }
};

const hideAfterStill = () => {
  if (immersiveTimer.value) clearTimeout(immersiveTimer.value);
  globalFlag.$patch({ immersive: false });
  immersiveTimer.value = window.setTimeout(() => {
    globalFlag.$patch({ immersive: true });
  }, 10000);
};

const onFullScreen = () => {
  if (!document.fullscreenElement) {
    fullscreen.value = true;
    document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) {
    fullscreen.value = false;
    document.exitFullscreen();
  }
};

const onExitFullScreen = () => {
  if (!document.fullscreenElement) fullscreen.value = false;
};

const clearTrack = () => {
  channelInfo.screenTrack.stop();
  client.unpublish([channelInfo.screenTrack as LocalVideoTrack]);
  channelInfo.$patch({ screenTrack: null });
};

const clearRoom = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
  if (channelInfo.cameraTrack) {
    channelInfo.cameraTrack.close();
  }
  if (channelInfo.micTrack) {
    channelInfo.micTrack.close();
  }
  if (channelInfo.screenTrack) {
    channelInfo.screenTrack.close();
  }
  if (channelInfo.mcuAudioTrack) {
    channelInfo.mcuAudioTrack.stop();
  }

  channelInfo.remoteUsers.forEach((user) => {
    if (user.auxiliaryTrack) {
      user.auxiliaryTrack.stop();
    }
    if (user.videoTrack) {
      user.videoTrack.stop();
    }
  });
  rtmInfo.rtm.detach();
  deviceInfo.$reset();
  channelInfo.whiteboardManager?.clear();
  channelInfo.$reset();
  globalFlag.$reset();
  asrInfo.$reset();
  rtmInfo.$patch({
    enabled: false,
    sessions: [],
    activeSessionId: "",
  });
};

onMounted(() => {
  // 处理用户加入
  handleUserJoin();

  // 1. PC端刷新/关闭
  window.addEventListener("beforeunload", handlePageUnload);
  // 2. 移动端/部分浏览器关闭 (iOS Safari 核心依赖这个)
  window.addEventListener("pagehide", handlePageUnload);

  getRtcStats();
  getRemoteUserNetworkStats();
  document.addEventListener("fullscreenchange", onExitFullScreen);
  rtcStatsTimer.value = window.setInterval(() => {
    getRtcStats();
    getRemoteUserNetworkStats();
  }, 2000);
  timeLeftTimer.value = window.setInterval(() => {
    timeLeft.value = Math.max(timeLeft.value - 1, 0);
  }, 1000);
  client.on("user-unpublished", (user, mediaType, auxiliary) => {
    logger.info(
      `user ${user.userId} unpublished ${
        mediaType === "audio" ? "audio" : auxiliary ? "screenShare" : mediaType
      }`
    );
    channelInfo.updateTrackStats(user.userId);
    channelInfo.$patch({ remoteUsers: client.remoteUsers });
  });
  client.on("user-published", (user, mediaType, auxiliary) => {
    logger.info(
      `user ${user.userId} ${user.id} published ${
        mediaType === "audio" ? "audio" : auxiliary ? "screenShare" : mediaType
      }`
    );
    channelInfo.updateTrackStats(user.userId);
    channelInfo.$patch({ remoteUsers: client.remoteUsers });
    if (mediaType !== "video") {
      return;
    }
    if (channelInfo.subscribeAllVideo) {
      subscribe(user, "video", auxiliary);
    }
  });
  client.on("user-joined", (user) => {
    logger.info(`user ${user.userId} joined`, user);
    channelInfo.$patch({ remoteUsers: client.remoteUsers });
    channelInfo.updateTrackStats(user.userId);
  });
  client.on("stream-type-changed", (uid, streamType) => {
    logger.info(`user ${uid} streamType changeTo ${streamType}`);
  });

  client.on("connection-state-change", (current, _, reason) => {
    logger.info(`connection-state-change ${current} ${reason || ""}`);
    if (current === "disconnected") {
      if (reason !== "leave") {
        message.info(reason);
      }
      // 处理该用户离开:包括刷新页面，关闭页面，点击离开按钮
      if (reason === "leave") {
        //用户主动离开后，自己会收到leave消息
        //如果是自己主动离开会议，则执行离开逻辑
        if (!isEndingMeeting.value) {
          handleUserLeave();
        }
        //如果是自己主动结束会议，则执行结束逻辑
        else {
          client.leave();
          currentUserInfo.$reset();
        }
      }

      clearRoom();
    }
  });
  client.on("network-quality", (uplink, downlink) => {
    channelInfo.$patch({
      networkQuality: Math.max(uplink, downlink) as NetworkQuality,
    });
  });
  client.on("volume-indicator", (uids: string[]) => {
    if (uids.length) {
      logger.info(`${uids.join()} is speaking`);
    }
    channelInfo.$patch({ speakers: uids });
  });
  client.on("user-info-updated", (uid, msg) => {
    logger.info(`user ${uid}: ${msg}`);
    channelInfo.$patch({ remoteUsers: client.remoteUsers });
    channelInfo.updateTrackStats(uid);
  });
  client.on("user-left", (user) => {
    logger.info(`用户 ${user.userId} 离开了会议...`);
    checkMainview(user);
    channelInfo.updateTrackStats(user.userId);
    channelInfo.$patch({ remoteUsers: client.remoteUsers });
  });
  client.on("group-add", (group: Group) => {
    logger.info(`group add`, group);
    channelInfo.groups = client.groups;
  });
  client.on("group-remove", (group: Group) => {
    logger.info(`group remove`, group);
    if (channelInfo.subscribeAudio === group.id) {
      channelInfo.subscribeAudio = "";
    }
    channelInfo.$patch({ groups: client.groups });
  });
  client.on("group-user-join", (groupId: string, user: GroupUser) => {
    logger.info(`group-user-join`, groupId, user);
    channelInfo.$patch({ groups: client.groups });
  });
  client.on("group-user-leave", (groupId: string, user: GroupUser) => {
    logger.info(`group-user-leave`, groupId, user);
    channelInfo.$patch({ groups: client.groups });
  });
  client.on(
    "group-info-updated",
    (groupId: string, event: GroupPropertyUpdateTypes, value?: string) => {
      logger.info(`group-info-updated`, groupId, event, value);
      channelInfo.$patch({ groups: client.groups });
    }
  );

  document.addEventListener("mousemove", hideAfterStill);
});

watch(
  () => channelInfo.screenTrack,
  () => {
    channelInfo.updateTrackStats(currentUserInfo.userId);
  },
  {
    immediate: true,
  }
);

watchEffect((cleanUp) => {
  if (!channelInfo.screenTrack) return;
  channelInfo.screenTrack?.on("track-ended", clearTrack);
  cleanUp(() => {
    channelInfo.screenTrack?.off("track-ended", clearTrack);
  });
});

onUnmounted(() => {
  clearInterval(rtcStatsTimer.value);
  clearInterval(timeLeftTimer.value);
  clearTimeout(immersiveTimer.value);
  document.removeEventListener("mousemove", hideAfterStill);
  client.removeAllListeners();

  // 移除RTM消息监听器
  rtmInfo.rtm.off("channel-message");

  document.removeEventListener("fullscreenchange", onExitFullScreen);

  // 移除监听器
  window.removeEventListener("beforeunload", handlePageUnload);
  window.removeEventListener("pagehide", handlePageUnload);
});

// 添加全屏用户状态
const fullscreenUser = ref("");

// 设置全屏用户的方法
const setFullscreenUser = (userId: string) => {
  fullscreenUser.value = userId;
};

// 清除全屏用户的方法
const clearFullscreenUser = () => {
  fullscreenUser.value = "";
};

// 计算小画面的显示方式
const smallViewDisplay = computed(() => {
  // 如果有全屏用户，则小画面放在右侧
  if (fullscreenUser.value) {
    return {
      position: "fixed",
      top: "60px",
      right: "80px",
      width: "300px",
      maxHeight: "calc(100vh - 160px)", // 给工具栏留出空间
      overflowY: "auto",
      zIndex: 1000,
    };
  }
  // 默认情况下按原有方式显示
  return {};
});

// 计算全屏视频的样式
const fullscreenVideoStyle = computed(() => {
  if (fullscreenUser.value) {
    return {
      position: "fixed",
      // top: '30px',
      left: "0",
      width: "100%",
      // height: 'calc(100% - 100px)',
      zIndex: "999",
    };
  }
  return {};
});

const spanNum = computed(() => {
  const userCount = channelInfo.allUsers.length;
  if (userCount > 9) return 6;
  else if (userCount > 4) return 8;
  else if (userCount > 1) return 12;
  return 24;
});

// 计算除主视频用户外的其他用户列表（用于小视频显示）
const otherUsers = computed(() => {
  // 小视频列表应该显示除主视频用户之外的所有用户
  const targetMainUserId = channelInfo.mainViewUserId || currentUserInfo.userId;
  return channelInfo.allUsers.filter(
    (user) => user.userId !== targetMainUserId
  );
});

// 添加切换主视频的方法
const switchMainView = (userId) => {
  console.log("切换主视图用户到：" + userId);
  if (channelInfo.isWhiteboardOpen) return;
  if (channelInfo.mode === "grid") {
    channelInfo.mode = "standard";
  }

  channelInfo.$patch((state) => {
    // 如果点击的是当前已经在大屏显示的用户，则不处理
    if (state.mainViewUserId === userId) return;

    const oldMainViewUserId = state.mainViewUserId;
    const oldMainViewType = state.mainViewPreferType;

    // 设置新的主视图用户
    state.mainViewUserId = userId;

    // 获取新主视图用户的信息
    const newUser = channelInfo.allUsers.find((u) => u.userId === userId);
    let preferType = oldMainViewType;

    // 确定首选类型
    if (newUser) {
      if (newUser.hasAuxiliary && preferType !== "auxiliary") {
        preferType = "auxiliary";
      } else if (newUser.hasCamera && preferType !== "camera") {
        preferType = "camera";
      }
    }

    state.mainViewPreferType = preferType;

    // 切换流类型
    if (newUser) {
      const hasValidTrack =
        (preferType === "auxiliary" && newUser.auxiliaryTrack) ||
        (preferType === "camera" && newUser.videoTrack);

      if (hasValidTrack) {
        client.setRemoteVideoStreamType(
          newUser.userId,
          "FHD",
          preferType === "auxiliary"
        );
      }
    }

    // 对旧的主视图用户也进行检查
    if (oldMainViewUserId) {
      const oldUser = channelInfo.allUsers.find(
        (u) => u.userId === oldMainViewUserId
      );
      if (oldUser) {
        const oldHasValidTrack =
          (oldMainViewType === "auxiliary" && oldUser.auxiliaryTrack) ||
          (oldMainViewType === "camera" && oldUser.videoTrack);

        if (oldHasValidTrack) {
          client.setRemoteVideoStreamType(
            oldMainViewUserId,
            "LD",
            oldMainViewType === "auxiliary"
          );
        }
      }
    }
  });
};

watch(
  () => [wrapRef.value, otherUsers.value],
  (newValue) => {
    let clientHeight = newValue[0].$el.clientHeight - 12;
    const userCount = newValue[1].length;
    if (userCount > 9) clientHeight = clientHeight / 4;
    else if (userCount > 4) clientHeight = clientHeight / 3;
    else if (userCount > 1) clientHeight = clientHeight / 2;
    gridHeight.value = clientHeight;
  }
);
</script>


<template>
  <Row
    class="blockWrapper"
    :class="channelInfo.mode === 'standard' ? 'standardMode' : ''"
    ref="wrapRef"
  >
    <Row :class="globalFlag.immersive ? 'hideBar' : ''">
      <span v-if="channelInfo.timeLeft"
        >上课时长：{{ parseTime(86400 - timeLeft) }}</span
      >
      <NetworkDetector />
      <Row class="fullscreen">
        <Tooltip
          :arrow="false"
          placement="bottomLeft"
          overlayClassName="viewConfigContainer"
          :overlay-inner-style="{ backgroundColor: 'rgba(245, 247, 250, 0.9)' }"
        >
          <Col class="viewConfigHot">
            <Icon
              :type="
                channelInfo.mode === 'grid'
                  ? 'icon-gallery_20'
                  : 'icon-speaker_top_20'
              "
            />
            视图
          </Col>
          <template #title>
            <Row class="viewConfig">
              <RadioGroup
                v-model:value="channelInfo.mode"
                :disabled="channelInfo.isWhiteboardOpen"
              >
                <Radio value="standard">
                  <Icon type="icon-speaker_top_20" />
                  标准
                </Radio>
                <Radio value="grid">
                  <Icon type="icon-gallery_20" />
                  宫格
                </Radio>
              </RadioGroup>
              <Divider />
              <Col @click="onFullScreen">
                {{ fullscreen ? "退出全屏" : "全屏" }}
              </Col>
            </Row>
          </template>
        </Tooltip>
        <Divider type="vertical" v-if="fullscreen" />
        <Icon
          class="viewConfigHot"
          v-if="fullscreen"
          @click="onFullScreen"
          type="icon-XDS_Minimize"
        />
      </Row>
    </Row>
    <Space
      v-if="channelInfo.mode === 'standard' && !channelInfo.isWhiteboardOpen"
      :class="['smallVideoItems', channelInfo.mode]"
    >
      <SmallView
        v-for="user in otherUsers"
        :key="user.userId"
        :user="user"
        :track="channelInfo.getTrack(user)"
        @click="switchMainView(user.userId)"
      />
    </Space>
    <Row
      v-else-if="
        channelInfo.mode !== 'standard' && !channelInfo.isWhiteboardOpen
      "
      :class="['smallVideoItems', channelInfo.mode]"
    >
      <SmallView
        v-for="user in channelInfo.allUsers"
        :span="spanNum"
        :style="{ height: gridHeight + 'px' }"
        :key="user.userId"
        :user="user"
        :track="channelInfo.getTrack(user)"
        @click="switchMainView(user.userId)"
      />
    </Row>
    <MainView
      v-if="channelInfo.mode === 'standard' && !channelInfo.isWhiteboardOpen"
    />
    <Whiteboard
      v-if="channelInfo.mode === 'standard' && channelInfo.isWhiteboardOpen"
    />
    <Subtitle v-if="asrInfo.enabled" />
    <ToolBar
      @leave="clearRoom"
      :clear-room="clearRoom"
      :set-ending-meeting="setEndingMeeting"
    />
    <ChatRoom />
  </Row>
</template>

<style lang="less" scoped>
@import url("./index.module.less");
</style>