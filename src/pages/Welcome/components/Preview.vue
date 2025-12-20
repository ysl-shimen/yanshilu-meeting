<template>
  <Row class="previewWrap">
    <Col ref="refContainer" id="refContainer" :class="!deviceInfo.cameraEnable ? 'avatar' : 'camera'">
      <!-- <Avatar size="large">{{ currentUserInfo.userName }}</Avatar> -->
      <Avatar size="large" :src="userAvatar" class="user-avatar">{{ currentUserInfo.userName }}</Avatar>
    </Col>
    <Row class="devices">
      <Col class="deviceColumn">
      <Camera :click="onClickCamera" />
      </Col>
      <Divider type="vertical" />
      <Col class="deviceColumn">
      <Mic :click="onClickMic" />
      </Col>
    </Row>
  </Row>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Mic, Camera } from '~/components/Device';
import { Row, Col, Divider, Avatar } from 'ant-design-vue';
import { useDevice } from '~/hooks/device';
import { useChannelInfo, useCurrentUserInfo, useDeviceInfo, useGlobalFlag } from '~/store';

const currentUserInfo = useCurrentUserInfo();
const refContainer = ref(null);

// 状态管理
const cameraTrack = ref(null);

const globalFlag = useGlobalFlag();
const { userName } = useCurrentUserInfo();
const deviceInfo = useDeviceInfo();
const channelInfo = useChannelInfo();

const props = defineProps({
  meetingEnded: {
    type: Boolean,
    default: false
  }
});

// 设备操作
const { operateCamera, operateMic, openCamera, openMic } = useDevice('pre');
onMounted(async () => {
   await new Promise((resolve) => setTimeout(resolve, 2000));
  if (props.meetingEnded) {
    console.log("会议已结束，无需操作摄像头和麦克风...");
    return Promise.resolve();
  }
  if (globalFlag.isMobile) {
    return
  };
  const track = await openCamera();
  cameraTrack.value = track;
  if (!globalFlag.joined && refContainer.value) {
    track?.play(refContainer.value.$el, { fit: 'cover', mirror: true });
  }
});

const onClickCamera = () => {
  if (globalFlag.isMobile && !channelInfo.cameraTrack) {
    openCamera().then((track) => {
      if (refContainer.value) {
        track?.play(refContainer.value.$el, { fit: 'cover', mirror: true });
      }
    });
  } else {
    operateCamera();
  }
};

const onClickMic = () => {
  if (globalFlag.isMobile && !channelInfo.micTrack) {
    openMic();
  } else {
    operateMic();
  }
};

// 计算属性：用户头像URL
const userAvatar = computed(() => {
  // 如果有真实头像URL，则使用，否则返回undefined让Avatar组件显示用户名首字母
  return currentUserInfo.avatar && currentUserInfo.avatar !== '-' ? currentUserInfo.avatar : undefined;
});

</script>

<style lang="less" scoped>
@import url('../index.module.less');
</style>