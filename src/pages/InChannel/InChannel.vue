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
import { joinMeeting, leaveMeeting } from "~/services/recordService";
import { getAppConfig } from '~/utils/appConfig';

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
  try {
    const result = await joinMeeting(currentUserInfo.channel);
    currentUserInfo.taskId = result.taskId;
    if (result.isRecording) {
      message.success("录制已开启");
    }
  } catch (error) {
    console.error("处理用户加入时出错:", error);
    message.error("处理录制功能时出错");
  } finally {
    // 设置默认主视频为当前用户（无论录制是否成功）
    channelInfo.$patch({
      mainViewUserId: currentUserInfo.userId,
      mainViewPreferType: "camera",
    });
  }
};

// 处理用户离开逻辑
// 注意：此函数在 connection-state-change reason==='leave' 时触发，
// 说明 client.leave() 已经执行完毕，此处只需通知后端，不需要再次调用 client.leave()
const handleUserLeave = async () => {
  console.log("开始执行用户正常退出逻辑...");
  if (hasHandledLeave.value) return; // 防止冲突

  hasHandledLeave.value = true;

  const isLastUser = channelInfo.allUsers.length <= 1;

  try {
    await leaveMeeting({
      channelId: currentUserInfo.channel,
      taskId: currentUserInfo.taskId,
      userId: currentUserInfo.userId,
      userCount: channelInfo.allUsers.length,
    });
    if (isLastUser && currentUserInfo.taskId) {
      message.success("停止录像成功");
    }
  } catch (error) {
    console.error("退出会议通知后端失败:", error);
  } finally {
    currentUserInfo.taskId = "";
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

  // 3. 转换为 Blob，使用 text/plain 而非 application/json
  // 原因：sendBeacon 发送 application/json 时浏览器会触发 CORS 预检，
  // 页面卸载时预检来不及完成导致请求被丢弃；text/plain 是简单请求，无需预检
  // 后端 server.js 已配置 express.text() 中间件将 text/plain body 解析为 JSON 对象
  const blob = new Blob([JSON.stringify(data)], { type: "text/plain" });

  // 4. 调用后端接口（Beacon保证请求发送成功）
  console.log("准备调用后端接口处理异常退出，参数：" + JSON.stringify(data));
  const baseUrl = getAppConfig().APP_SERVER_DOMAIN;
  const isSuccess = navigator.sendBeacon(`${baseUrl}/api/meeting/leave`, blob);
  console.log("Beacon 发送结果：" + isSuccess);

  // 5. 兜底：Beacon失败时用同步XHR
  if (!isSuccess) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/api/meeting/leave`, false); // 同步请求
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

// 顶部栏高度和底部工具栏高度（与 CSS 保持一致）
const TOP_BAR_HEIGHT = 24;
const BOTTOM_BAR_HEIGHT = 56;

// 判断当前是否为触摸设备（手机/平板）
const isTouchDevice = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// ── 桌面端：鼠标交互 ──

// 启动收起定时器（统一入口，方便各处调用）
const scheduleHide = (delay = 400) => {
  if (immersiveTimer.value) clearTimeout(immersiveTimer.value);
  immersiveTimer.value = window.setTimeout(() => {
    globalFlag.$patch({ immersive: true });
    immersiveTimer.value = 0;
  }, delay);
};

// 取消收起定时器并立即显示菜单栏
const cancelHideAndShow = () => {
  if (immersiveTimer.value) {
    clearTimeout(immersiveTimer.value);
    immersiveTimer.value = 0;
  }
  if (globalFlag.immersive) {
    globalFlag.$patch({ immersive: false });
  }
};

// 鼠标在中间视频区域移动：显示菜单栏
const onWrapperMouseMove = (e: MouseEvent) => {
  if (isTouchDevice()) return;
  const winH = window.innerHeight;
  const y = e.clientY;
  const inCenter = y > TOP_BAR_HEIGHT && y < winH - BOTTOM_BAR_HEIGHT;
  if (inCenter) cancelHideAndShow();
  // 鼠标在 fixed 工具栏上时 mousemove 不会触发，由工具栏自身的 mouseenter/mouseleave 接管
};

// 鼠标离开整个会议页面（含所有 fixed 子元素之外）：延迟收起
const onWrapperMouseLeave = () => {
  if (isTouchDevice()) return;
  scheduleHide(300);
};

// 鼠标进入顶部栏或底部工具栏：取消收起，保持显示
const onBarMouseEnter = () => {
  if (isTouchDevice()) return;
  cancelHideAndShow();
};

// 鼠标离开顶部栏或底部工具栏（移回中间区域或离开页面）：延迟收起
const onBarMouseLeave = () => {
  if (isTouchDevice()) return;
  scheduleHide(400);
};

// ── 触摸设备：点击中间区域切换显示/隐藏 ──

const onWrapperTap = (e: MouseEvent) => {
  if (!isTouchDevice()) return;
  const winH = window.innerHeight;
  const y = e.clientY;
  const inCenter = y > TOP_BAR_HEIGHT && y < winH - BOTTOM_BAR_HEIGHT;
  if (!inCenter) return;

  if (globalFlag.immersive) {
    // 当前已收起 → 展开，并在 4 秒后自动收起
    globalFlag.$patch({ immersive: false });
    if (immersiveTimer.value) clearTimeout(immersiveTimer.value);
    immersiveTimer.value = window.setTimeout(() => {
      globalFlag.$patch({ immersive: true });
      immersiveTimer.value = 0;
    }, 4000);
  } else {
    // 当前已展开 → 立即收起
    if (immersiveTimer.value) {
      clearTimeout(immersiveTimer.value);
      immersiveTimer.value = 0;
    }
    globalFlag.$patch({ immersive: true });
  }
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

  // 初始状态收起菜单栏，等鼠标移入中间区域再显示
  globalFlag.$patch({ immersive: true });
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
  // mouseenter/mouseleave 绑定在模板上，无需手动移除
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
    @mousemove="onWrapperMouseMove"
    @mouseleave="onWrapperMouseLeave"
    @click="onWrapperTap"
  >
    <!-- 顶部栏：鼠标悬停时保持显示，离开时延迟收起 -->
    <Row
      :class="globalFlag.immersive ? 'hideTopBar' : ''"
      @mouseenter="onBarMouseEnter"
      @mouseleave="onBarMouseLeave"
    >
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
      @mouseenter="onBarMouseEnter"
      @mouseleave="onBarMouseLeave"
    />
    <ChatRoom />
  </Row>
</template>

<style lang="less" scoped>
@import url("./index.module.less");
</style>