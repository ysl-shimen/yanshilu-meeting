<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

// 是否已挂载（DOM 就绪）
const isMounted = ref(false);

// 播放 track 到主视图容器
const doPlay = (track: any) => {
  if (!track || !viewRef.value?.$el) return;
  const el = viewRef.value.$el;
  try {
    logger.info("MainView doPlay: trackId=", track.getTrackId?.());
    track.play(el, { fit: "cover" });
    // 200ms 检查，如果 readyState=0 说明 video 元素是全新创建的，需要等待加载
    setTimeout(() => {
      const videos = el.querySelectorAll('video');
      if (videos.length > 0) {
        const v = videos[0] as HTMLVideoElement;
        logger.info(`MainView doPlay check: videos=${videos.length} currentTrack=${!!currentTrack.value}`);
        logger.info(`  video readyState= ${v.readyState} paused= ${v.paused} srcObject= ${!!v.srcObject} width= ${v.videoWidth} height= ${v.videoHeight}`);
        // readyState=0 且有 srcObject：浏览器未自动加载，手动重新触发播放
        if (v.readyState === 0 && v.srcObject) {
          logger.info("MainView: readyState=0 detected, forcing video replay");
          const stream = v.srcObject as MediaStream;
          v.srcObject = null;
          v.srcObject = stream;
          v.play().catch(err => logger.warn("MainView video.play() force replay error:", err));
        }
      } else {
        logger.info(`MainView doPlay check: videos=0`);
      }
    }, 200);
    // 1500ms 二次检查
    setTimeout(() => {
      const videos = el.querySelectorAll('video');
      if (videos.length > 0) {
        const v = videos[0] as HTMLVideoElement;
        logger.info(`MainView check @1500ms: readyState=${v.readyState} width=${v.videoWidth} height=${v.videoHeight}`);
        // 1500ms 后仍然 width=0，尝试再次 play
        if (v.videoWidth === 0 && v.srcObject) {
          logger.info("MainView: still width=0 @1500ms, re-playing track");
          try { track.play(el, { fit: "cover" }); } catch (e) {}
        }
      }
    }, 1500);
  } catch (e) {
    logger.warn("MainView doPlay error:", e);
  }
};

// 监听 currentTrack 变化：DOM 就绪后直接 play
// SDK 的 play(track, el) 内部会自动处理：
//   - 若该 el 上已有其他 track → 先 stop 旧 track，再 play 新 track
//   - 若该 el 上已有同一 track → 直接更新 srcObject
// 因此不需要手动 stop 旧 track
watch(
  () => currentTrack.value,
  (newTrack) => {
    logger.info("MainView watch currentTrack:", newTrack?.getTrackId?.());
    if (!newTrack || !isMounted.value) return;
    // nextTick 确保 DOM 已更新（SmallView 已卸载/挂载完毕）
    nextTick(() => doPlay(newTrack));
  }
);

onMounted(() => {
  isMounted.value = true;
  logger.info("MainView onMounted, currentTrack=", !!currentTrack.value);
  if (currentTrack.value) {
    nextTick(() => doPlay(currentTrack.value));
  }
});

onBeforeUnmount(() => {
  isMounted.value = false;
  if (currentTrack.value && viewRef.value?.$el) {
    try { currentTrack.value.stop(viewRef.value.$el); } catch (e) {}
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

