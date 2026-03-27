<template>
  <Row :class="['toolBarWrap', globalFlag.immersive ? 'hideBar' : '']">
    <!-- 1. 左侧占位符：用于平衡右侧按钮，使中间工具栏视觉居中 -->
    <div class="bar-placeholder"></div>

    <!-- 2. 中间工具栏：核心功能区 -->
    <div class="bar-tools">
      <Space :size="[0, 0]" class="tools-space">
        <!-- size设为0，间距由CSS控制 -->
        <div class="toolBtn" @click="onClickCamera">
          <Camera :inToolbar="true" />
          <span>{{ deviceInfo.cameraEnable ? "关摄像头" : "开摄像头" }}</span>
        </div>
        <div class="toolBtn" @click="onClickMic">
          <Mic :inToolbar="true" />
          <span>{{ deviceInfo.micEnable ? "静音" : "解除静音" }}</span>
        </div>
        <!-- 屏幕共享：触摸设备（手机/平板）均不支持，隐藏此按钮 -->
        <div
          :class="['toolBtn', { stopShare: channelInfo.screenTrack }]"
          @click="operateScreen"
          v-if="!globalFlag.isTouch"
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
import { Button, Row, Space, Col, message, Modal } from "ant-design-vue";
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
import { endMeeting } from "~/services/recordService";

// 判断是否是权限被拒绝的错误
const isPermissionDenied = (error: any): boolean => {
  const msg = error?.message?.toLowerCase() || '';
  const name = error?.name?.toLowerCase() || '';
  return (
    name === 'notallowederror' ||
    msg.includes('permission') ||
    msg.includes('no camera permission') ||
    msg.includes('no microphone permission')
  );
};

// 判断是否为移动/触摸设备（手机或平板）
const isMobileOrTablet = () => globalFlag.isIOS || globalFlag.isTouch;

// 弹出引导用户去浏览器设置开启权限的提示
const showPermissionGuide = (deviceType: '摄像头' | '麦克风') => {
  let content = '';
  if (isMobileOrTablet()) {
    content = `浏览器已记录您拒绝了${deviceType}权限，无法再次弹出授权框。\n请尝试以下方式重新开启：\n① 点击地址栏左侧的图标（锁形、"aA" 或网站名称）→ 选择"网站设置" → 将"${deviceType}"改为"允许"，然后刷新页面。\n② 前往设备【设置】→【隐私】或【应用权限】→ 找到浏览器 → 开启${deviceType}权限后重新打开页面。`;
  } else {
    content = `浏览器已记录您拒绝了${deviceType}权限，无法再次弹出授权框。请查看浏览器地址栏中被禁止的${deviceType}图标（Chrome/Firefox 在地址栏左侧，Edge 在地址栏右侧），点击后将"${deviceType}"权限改为"允许"，然后刷新页面重试。`;
  }
  Modal.warning({
    title: `${deviceType}权限被拒绝`,
    content,
    okText: '我知道了',
  });
};


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
const onClickCamera = async () => {
  const noCamera = !channelInfo.cameraTrack;
  try {
    await operateCamera();
    if (globalFlag.isMobile && noCamera) {
      channelInfo.updateTrackStats(currentUserInfo.userId);
      if (!channelInfo.mainViewUserId) {
        channelInfo.mainViewUserId = currentUserInfo.userId;
        channelInfo.mainViewPreferType = "camera";
      }
    }
  } catch (error) {
    if (isPermissionDenied(error)) {
      showPermissionGuide('摄像头');
    } else {
      message.error('打开摄像头失败，请检查设备是否正常');
      console.error('[ToolBar] 打开摄像头失败:', error);
    }
  }
};

const onClickMic = async () => {
  try {
    await operateMic();
  } catch (error) {
    if (isPermissionDenied(error)) {
      showPermissionGuide('麦克风');
    } else {
      message.error('打开麦克风失败，请检查设备是否正常');
      console.error('[ToolBar] 打开麦克风失败:', error);
    }
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
  isEnding.value = true;
  props.setEndingMeeting(true);
  try {
    await endMeeting(currentUserInfo.channel);
    message.success("结束会议成功");
    client.leave();
    props.onLeave();
    props.clearRoom();
  } catch (error) {
    console.error("结束会议失败：", error);
    message.error("结束会议失败：" + (error.message || "未知错误"));
  } finally {
    props.setEndingMeeting(false);
    isEnding.value = false;
  }
};
</script>
<style lang="less" scoped>
@import url("../index.module.less");
</style>