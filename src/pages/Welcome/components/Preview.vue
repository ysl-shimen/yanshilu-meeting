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
import { ref, computed, onMounted } from 'vue';
import { Mic, Camera } from '~/components/Device';
import { Row, Col, Divider, Avatar, message, Modal } from 'ant-design-vue';
import { useDevice } from '~/hooks/device';
import { useChannelInfo, useCurrentUserInfo, useDeviceInfo, useGlobalFlag } from '~/store';

const currentUserInfo = useCurrentUserInfo();
const refContainer = ref(null);

const globalFlag = useGlobalFlag();
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

// 弹出引导用户去浏览器设置开启权限的提示
const showPermissionGuide = (deviceType: '摄像头' | '麦克风') => {
  Modal.warning({
    title: `${deviceType}权限被拒绝`,
    content: `浏览器已记录您拒绝了${deviceType}权限，无法再次弹出授权框。请查看浏览器地址栏中被禁止的${deviceType}图标（Chrome/Firefox 在地址栏左侧，Edge 在地址栏右侧），点击后将"${deviceType}"权限改为"允许"，然后刷新页面重试。`,
    okText: '我知道了',
  });
};

// 页面加载时自动请求摄像头权限，触发浏览器地址栏图标
onMounted(async () => {
  if (props.meetingEnded) return;
  try {
    const track = await openCamera();
    if (refContainer.value) {
      track?.play(refContainer.value.$el, { fit: 'cover', mirror: true });
    }
  } catch (error) {
    if (isPermissionDenied(error)) {
      showPermissionGuide('摄像头');
    }
    // 其他错误静默处理，用户可手动点击摄像头按钮重试
  }
});

const onClickCamera = async () => {
  if (props.meetingEnded) return;
  try {
    if (!channelInfo.cameraTrack) {
      const track = await openCamera();
      if (refContainer.value) {
        track?.play(refContainer.value.$el, { fit: 'cover', mirror: true });
      }
    } else {
      operateCamera();
    }
  } catch (error) {
    if (isPermissionDenied(error)) {
      showPermissionGuide('摄像头');
    } else {
      message.error('打开摄像头失败，请检查设备是否正常');
      console.error('[Preview] 打开摄像头失败:', error);
    }
  }
};

const onClickMic = async () => {
  if (props.meetingEnded) return;
  try {
    if (globalFlag.isMobile && !channelInfo.micTrack) {
      await openMic();
    } else {
      await operateMic();
    }
  } catch (error) {
    if (isPermissionDenied(error)) {
      showPermissionGuide('麦克风');
    } else {
      message.error('打开麦克风失败，请检查设备是否正常');
      console.error('[Preview] 打开麦克风失败:', error);
    }
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