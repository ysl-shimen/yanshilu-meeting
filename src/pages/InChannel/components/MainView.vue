<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Tooltip, Row, Avatar } from "ant-design-vue";
import {
  useGlobalFlag,
  useChannelInfo,
  useDeviceInfo,
  useCurrentUserInfo,
} from "~/store";
import Icon from "~/components/Icon";
import Annotation from "./Annotation.vue";
import { logger } from "~/utils/tools";

const props = defineProps({
  userId: {
    type: String,
    default: "",
  },
});

const viewRef = ref(null);

// 状态管理
const globalFlag = useGlobalFlag();
const channelInfo = useChannelInfo();
const deviceInfo = useDeviceInfo();
const currentUserInfo = useCurrentUserInfo();

// 计算当前显示的用户信息
const currentUserId = computed(() => {
  return props.userId || channelInfo.mainViewUserId;
});

const currentUser = computed(() => {
  if (props.userId) {
    return channelInfo.allUsers.find((user) => user.userId === props.userId);
  }
  return channelInfo.mainViewUserInfo;
});

const currentTrack = computed(() => {
  if (props.userId) {
    const user = channelInfo.allUsers.find(
      (user) => user.userId === props.userId
    );
    if (user) {
      // 检查轨道是否有效，避免返回无效的轨道对象
      const auxiliaryTrack =
        user.auxiliaryTrack && !user.auxiliaryMuted
          ? user.auxiliaryTrack
          : null;
      const videoTrack =
        user.videoTrack && !user.videoMuted ? user.videoTrack : null;
      return auxiliaryTrack || videoTrack;
    }
    return null;
  }

  // 对于主视图用户也进行同样的检查
  const mainUser = channelInfo.mainViewUserInfo;
  if (mainUser) {
    const auxiliaryTrack =
      mainUser.auxiliaryTrack && !mainUser.auxiliaryMuted
        ? mainUser.auxiliaryTrack
        : null;
    const videoTrack =
      mainUser.videoTrack && !mainUser.videoMuted ? mainUser.videoTrack : null;
    return channelInfo.mainViewPreferType === "camera"
      ? videoTrack || auxiliaryTrack
      : auxiliaryTrack || videoTrack;
  }

  return channelInfo.mainViewTrack;
});

const micIconEnable = computed(() => {
  const isLocal = currentUserId.value === currentUserInfo.userId;
  if (isLocal) return deviceInfo.micEnable;
  return channelInfo.trackStatsMap.get(currentUserId.value)?.mic;
});

const showName = computed(() => {
  if (currentUser.value) {
    return currentUser.value.userName;
  }
  return currentUserInfo.userName;
});

watch(
  () => [viewRef.value, currentTrack.value],
  (newValue, oldValue) => {
    logger.info("newValue, oldValue=====", newValue, oldValue);
    if (newValue[1]) {
      newValue[1].play(viewRef.value.$el, {
        fit: "cover",
      });
    }
    if (
      oldValue?.[0]?.$el &&
      oldValue?.[1] &&
      oldValue?.[0]?.$el !== oldValue?.[1]?.$el
    ) {
      oldValue[1].stop(oldValue?.[0]?.$el);
    }
  }
);

onBeforeUnmount(() => {
  if (currentTrack.value && viewRef.value?.$el) {
    logger.info("Stopping track play for mainview");
    currentTrack.value.stop(viewRef.value.$el);
  }
});
</script>

<template>
  <Row ref="viewRef" :class="['mainView', { avatar: !currentTrack }]">
    <Annotation v-if="channelInfo.annotation" />
    <div
      v-if="currentTrack"
      :class="[
        'smallViewStatus',
        { higherMainUserInfo: !globalFlag.immersive },
      ]"
    >
      <Icon
        v-if="channelInfo.trackStatsMap.get(currentUserId)?.screen"
        style="color: limegreen"
        type="icon-XDS_share_screen1"
      />
      <Icon v-if="!micIconEnable" type="icon-XDS_UnMute2Fill" />
      <Tooltip :title="showName">
        <span>{{ showName }}</span>
      </Tooltip>
    </div>
    <Avatar size="large">
      {{ showName }}
    </Avatar>
  </Row>
</template>

<style lang="less" scoped>
.mainView {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1; // 设置较低的z-index，确保不会遮挡顶部菜单

  & .higherMainUserInfo {
    bottom: 60px;
  }

  :deep(.ant-avatar) {
    display: none;
  }

  &.avatar {
    :deep(.ant-avatar) {
      width: 120px;
      height: 120px;
    }
  }
}
</style>

