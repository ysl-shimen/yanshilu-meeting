<template>
  <!-- 
    修改说明:
    1. 绑定 mousedown/touchstart 启动拖拽
    2. 绑定 click.capture 拦截点击事件，区分拖拽和点击
    3. 动态绑定 style 实现位置跟随
    4. 添加 touch-action: none 防止移动端拖拽时页面滚动
  -->
  <Col 
    ref="containerRef" 
    :style="containerStyle" 
    :class="[
      'smallVideoItem',
      {
        avatar: !videoIsPlay,
        camera: videoIsPlay,
        speaking: channelInfo.speakers.includes(user.userId),
        'is-dragging': isDraggingState, // 拖拽中样式
        'is-fixed': isFixed // 悬浮样式
      },
    ]" 
    :span="span" 
    @mousedown="handleDragStart"
    @touchstart="handleDragStart"
    @click.capture="handleWrapperClick"
  >
  
  <component :is="ScoreMap(channelInfo.remoteUserNetworkQualitys[user.userId] || 0)?.icon" v-if="!isLocal && actualTrack" />
  
  <!-- 头像容器 -->
  <div v-if="!videoIsPlay" class="avatar-container">
    <Avatar size="large" class="custom-avatar">
      {{ user.userName }}
    </Avatar>
    
  </div>

  <div class="smallViewStatus">
    <Icon v-if="channelInfo.trackStatsMap.get(user.userId)?.screen" style="color: limegreen"
      type="icon-XDS_share_screen1" />
    <Icon v-if="!micIconEnable" type="icon-XDS_UnMute2Fill" />
    <Tooltip :title="user.userName">
      <span>{{ user.userName }}</span>
    </Tooltip>
  </div>
  
  <Tooltip :arrow="false" :overlay-inner-style="{ backgroundColor: 'rgba(245, 247, 250, 0.9)' }">
    <template #title>
      <List>
        <List.Item v-for="item in actions" :key="item.text" class="actionsItem" @click="item.onClick">
          {{ item.text }}
        </List.Item>
      </List>
    </template>
    <!-- 阻止冒泡，防止点击菜单时触发拖拽 -->
    <div class="smallViewActions" @mousedown.stop @touchstart.stop>
      <Icon type="icon-XDS_List" />
    </div>
  </Tooltip>
  </Col>
</template>

<script lang="ts">
// 使用额外的 script 块定义模块级变量，用于在组件销毁/创建间传递位置信息
// 当发生画面切换时，旧组件销毁，新组件创建，通过此变量保持位置
const globalSwapState = {
  active: false,
  x: 0,
  y: 0
};
</script>

<script lang="ts" setup>
import { Avatar, Col, Tooltip, List } from 'ant-design-vue';
import Icon from '~/components/Icon';
import { downloadFileByBase64, logger } from '~/utils/tools';
import { useClient, useChannelInfo, useCurrentUserInfo, useDeviceInfo } from '~/store';
import { ScoreMap } from './NetworkBar';
import { computed, onBeforeUnmount, ref, watch, reactive, onMounted } from 'vue';
import { useChannel, useWhiteboardHooks } from '~/hooks/channel';
import { VideoSourceInfo } from 'dingrtc';
import { AnnotationSourceType } from '@dingrtc/whiteboard';

const emit = defineEmits(['set-fullscreen', 'click', 'drag-start', 'drag-end']);

const props = defineProps(['user', 'span', 'style', 'track']);
const { subscribe, unsubscribe } = useChannel();

const user = computed(() => props.user);

const channelInfo = useChannelInfo();
const deviceInfo = useDeviceInfo();
const currentUserInfo = useCurrentUserInfo();
const client = useClient();
const streamType = ref(channelInfo.defaultRemoteStreamType);
const containerRef = ref(null);
const { openAnnotation, closeAnnotation } = useWhiteboardHooks();

const isLocal = computed(() => user.value.userId === currentUserInfo.userId);

const actualTrack = computed(() => {
  if (props.track) return props.track;
  if (isLocal.value) {
    return channelInfo.cameraTrack || channelInfo.screenTrack;
  }
  return null;
});

// ================= 拖拽与位置保持逻辑 =================

const isDraggingState = ref(false);
const hasMoved = ref(false); // 标记是否发生过位移
const isFixed = ref(false);  // 是否切换为悬浮模式
const dragPosition = reactive({ x: 0, y: 0, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

// 初始化时检查是否有待继承的坐标（解决切换后位置复位问题）
if (globalSwapState.active) {
  isFixed.value = true;
  dragPosition.x = globalSwapState.x;
  dragPosition.y = globalSwapState.y;
  // 消费一次后重置，避免影响其他无关组件
  globalSwapState.active = false;
}

// 计算最终样式
const containerStyle = computed(() => {
  const baseStyle = { 
    ...props.style, 
    cursor: 'move', 
    touchAction: 'none' // 关键：禁止移动端默认的滚动行为
  };
  
  if (isFixed.value) {
    return {
      ...baseStyle,
      position: 'fixed',
      left: `${dragPosition.x}px`,
      top: `${dragPosition.y}px`,
      zIndex: 1,
      margin: 0,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: isDraggingState.value ? 'none' : 'transform 0.2s',
    };
  }
  return baseStyle;
});

// 获取事件坐标的通用方法（兼容 MouseEvent 和 TouchEvent）
const getClientPos = (e: MouseEvent | TouchEvent) => {
  if (e instanceof MouseEvent) {
    return { x: e.clientX, y: e.clientY };
  }
  
  // 移动端 Touch 事件
  // 【关键修正】使用 ES6 解构赋值，完全避免使用方括号下标访问
  // 优先使用 touches，如果为空（如 touchend）则使用 changedTouches
  const touchList = e.touches.length > 0 ? e.touches : e.changedTouches;
  
  // 解构获取第一个元素
  const [touch] = touchList as unknown as Touch[]; 
  
  return { x: touch.clientX, y: touch.clientY };
};

// 拦截点击事件
const handleWrapperClick = (e: Event) => {
  // 如果发生过拖拽位移，则阻止点击事件（防止拖拽结束时误触切换）
  if (hasMoved.value) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  handleClick();
};

const handleClick = () => {
  // 关键：在切换前，如果当前是悬浮状态，保存当前位置到全局变量
  if (isFixed.value) {
    globalSwapState.active = true;
    globalSwapState.x = dragPosition.x;
    globalSwapState.y = dragPosition.y;
  }
  
  emit('set-fullscreen', user.value.userId);
  emit('click');
};

// 开始拖拽
const handleDragStart = (e: MouseEvent | TouchEvent) => {
  // 忽略鼠标右键
  if (e instanceof MouseEvent && e.button !== 0) return;

  isDraggingState.value = true;
  hasMoved.value = false;

  const { x, y } = getClientPos(e);
  dragPosition.startX = x;
  dragPosition.startY = y;

  // 如果还没悬浮，先获取当前元素在页面中的位置作为初始位置
  if (!isFixed.value && containerRef.value && containerRef.value.$el) {
    const rect = containerRef.value.$el.getBoundingClientRect();
    dragPosition.x = rect.left;
    dragPosition.y = rect.top;
  }
  
  dragPosition.initialLeft = dragPosition.x;
  dragPosition.initialTop = dragPosition.y;

  // 添加全局事件监听
  window.addEventListener('mousemove', handleDragMove);
  window.addEventListener('mouseup', handleDragEnd);
  window.addEventListener('touchmove', handleDragMove, { passive: false });
  window.addEventListener('touchend', handleDragEnd);
  
  emit('drag-start', e, user.value);
};

// 拖拽移动
const handleDragMove = (e: MouseEvent | TouchEvent) => {
  if (!isDraggingState.value) return;

  const { x, y } = getClientPos(e);
  const deltaX = x - dragPosition.startX;
  const deltaY = y - dragPosition.startY;

  // 防抖动判断
  if (!hasMoved.value && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
    hasMoved.value = true;
    isFixed.value = true;
  }

  if (hasMoved.value) {
    if (e.cancelable) e.preventDefault();
    
    // 1. 计算理论上的新位置
    let newX = dragPosition.initialLeft + deltaX;
    let newY = dragPosition.initialTop + deltaY;

    // --- 核心修改：防丢失边界限制 Start ---
    
    // 获取当前元素的实际宽高
    const elWidth = containerRef.value?.$el?.offsetWidth || 130;
    const elHeight = containerRef.value?.$el?.offsetHeight || 74;
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // 定义保留在屏幕内的最小像素值 (n)
    // 建议至少 30px，否则手指太粗可能捏不回来；如果你坚持要小，可以改成 5
    const minVisibleSize = 30; 

    // 计算 X 轴的可移动范围
    // 最小值：允许向左拖出，直到只剩 n 像素在屏幕左侧 (n - 宽度)
    const minX = minVisibleSize - elWidth;
    // 最大值：允许向右拖出，直到只剩 n 像素在屏幕右侧 (屏幕宽 - n)
    const maxX = windowWidth - minVisibleSize;

    // 计算 Y 轴的可移动范围
    // 最小值：允许向上拖出 (n - 高度)
    const minY = minVisibleSize - elHeight;
    // 最大值：允许向下拖出 (屏幕高 - n)
    const maxY = windowHeight - minVisibleSize;

    // 应用限制
    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;
    if (newY < minY) newY = minY;
    if (newY > maxY) newY = maxY;

    // --- 边界限制 End ---

    dragPosition.x = newX;
    dragPosition.y = newY;
  }
};

// 拖拽结束
const handleDragEnd = (e: Event) => {
  isDraggingState.value = false;
  
  // 移除监听
  window.removeEventListener('mousemove', handleDragMove);
  window.removeEventListener('mouseup', handleDragEnd);
  window.removeEventListener('touchmove', handleDragMove);
  window.removeEventListener('touchend', handleDragEnd);
  
  emit('drag-end', e);
};

// ================= 拖拽逻辑结束 =================

const micIconEnable = computed(() => {
  if (isLocal.value) return deviceInfo.micEnable;
  return channelInfo.trackStatsMap.get(user.value.userId)?.mic;
})

const videoIsPlay = computed(() => {
  if (isLocal.value) {
    const track = actualTrack.value;
    if (!track) return false;
    if (track === channelInfo.cameraTrack) {
      return deviceInfo.cameraEnable;
    }
    return true;
  }

  let track = actualTrack.value;
  if (!track) return false;

  const trackStats = channelInfo.trackStatsMap.get(user.value.userId);
  if (!trackStats) return false;

  if (track === user.value.videoTrack) return !!trackStats.camera;
  if (track === user.value.auxiliaryTrack) return !!trackStats.screen;
  
  return false;
});

const resolution = computed(() => {
  const map = channelInfo.rtcStats.resolutionMap;
  const uid = user.value.userId;
  if (!actualTrack.value) return;
  const type = actualTrack.value === user.value.auxiliaryTrack ? 'auxiliary' : 'camera'
  return map.get(`${uid}#${type}`);
})

// Watch 逻辑
watch(() => [containerRef.value, actualTrack.value, videoIsPlay.value], ([newContainer, newTrack, isPlaying], oldValues) => {
  const [oldContainer, oldTrack] = oldValues || [];

  if (oldTrack && oldContainer && oldContainer.$el) {
    try {
      oldTrack.stop(oldContainer.$el);
    } catch (e) {
      console.warn('Stop track error:', e);
    }
  }

  if (isPlaying && newTrack && newContainer && newContainer.$el) {
    setTimeout(() => {
      if (containerRef.value && containerRef.value.$el) {
        try {
          newTrack.play(containerRef.value.$el, {
            fit: 'contain',
          });
        } catch (error) {
          console.error('播放失败:', error);
        }
      }
    }, 200);
  } else if (!isPlaying && newTrack && newContainer && newContainer.$el) {
    try {
      newTrack.stop(newContainer.$el);
    } catch (e) {}
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleDragMove);
  window.removeEventListener('mouseup', handleDragEnd);
  window.removeEventListener('touchmove', handleDragMove);
  window.removeEventListener('touchend', handleDragEnd);

  if (actualTrack.value && containerRef.value?.$el) {
    try {
      actualTrack.value.stop(containerRef.value.$el);
    } catch (e) {}
  }
});

const encodeLayers = computed(() => {
  if (!actualTrack.value) return 0;
  return actualTrack.value?.source === VideoSourceInfo.SCREENCAST
    ? channelInfo.rtcStats.encodeScreenLayers
    : channelInfo.rtcStats.encodeCameraLayers;
});

const sendLayers = computed(() => {
  if (!actualTrack.value) return 0;
  return actualTrack.value?.source === VideoSourceInfo.SCREENCAST
    ? channelInfo.rtcStats.sendScreenLayers
    : channelInfo.rtcStats.sendCameraLayers;
});

const showStopAnnotation = computed(() => {
  const annotationId = channelInfo.annotationId;
  if (!annotationId) return false;
  const [originAnnotataionId] = annotationId.split('#');
  const [trackUserId, creator] = originAnnotataionId.split('_');
  if (creator !== currentUserInfo.userId || trackUserId !== user.value.userId) return false;
  return true;
})

const actions = computed(() => {
  const uid = user.value.userId;
  const currentTrack = actualTrack.value; 

  const buttons = [
    {
      text: '截图',
      show: currentTrack,
      onClick: () => {
        if (currentTrack) {
          downloadFileByBase64(currentTrack.getCurrentFrameData(), uid);
        }
      },
    },
    {
      text: '开启标注',
      show: currentTrack && !channelInfo.annotation,
      onClick: () => {
        const sourceType = currentTrack === user.value.auxiliaryTrack ? 'share' : 'video'
        openAnnotation(`${uid}_${currentUserInfo.userId}`, sourceType);
      },
    },
    {
      text: '结束标注',
      show: showStopAnnotation.value,
      onClick: () => {
        const [originAnnotataionId, sourceType] = channelInfo.annotationId.split('#');
        channelInfo.annotation.stop();
        closeAnnotation(originAnnotataionId, sourceType as AnnotationSourceType);
      },
    },
    {
      text: '订阅摄像头',
      show: !isLocal.value && channelInfo.trackStatsMap.get(uid)?.hasCamera && !channelInfo.trackStatsMap.get(uid)?.subscribedCamera,
      onClick: () => {
        subscribe(user.value, 'video');
      },
    },
    {
      text: '取消订阅摄像头',
      show: !isLocal.value && channelInfo.trackStatsMap.get(uid)?.subscribedCamera,
      onClick: () => {
        unsubscribe(user.value, 'video');
      },
    },
    {
      text: '订阅共享',
      show: !isLocal.value && channelInfo.trackStatsMap.get(uid)?.hasScreen && !channelInfo.trackStatsMap.get(uid)?.subscribedScreen,
      onClick: () => {
        subscribe(user.value, 'video', true);
      },
    },
    {
      text: '取消订阅共享',
      show: !isLocal.value && channelInfo.trackStatsMap.get(uid)?.subscribedScreen,
      onClick: () => {
        unsubscribe(user.value, 'video', true);
      },
    },
    {
      text: '切FHD',
      show: !isLocal.value && currentTrack && streamType.value !== 'FHD' && currentTrack === user.value.videoTrack,
      onClick: () => {
        client.setRemoteVideoStreamType(uid, 'FHD').then(() => {
          streamType.value = 'FHD';
        });
      },
    },
    {
      text: '切HD',
      show: !isLocal.value && currentTrack && streamType.value !== 'HD' && currentTrack === user.value.videoTrack,
      onClick: () => {
        client.setRemoteVideoStreamType(uid, 'HD').then(() => {
          streamType.value = 'HD';
        });
      },
    },
    {
      text: '切SD',
      show: !isLocal.value && currentTrack && streamType.value !== 'SD' && currentTrack === user.value.videoTrack,
      onClick: () => {
        client.setRemoteVideoStreamType(uid, 'SD').then(() => {
          streamType.value = 'SD';
        });
      },
    },
    {
      text: '切LD',
      show: !isLocal.value && currentTrack && streamType.value !== 'LD' && currentTrack === user.value.videoTrack,
      onClick: () => {
        client.setRemoteVideoStreamType(uid, 'LD').then(() => {
          streamType.value = 'LD';
        });
      },
    },
  ].filter((item) => item.show);
  return buttons;
});
</script>

<style lang="less" scoped>
@import url('../index.module.less');

.smallVideoItem {
  // 确保拖拽时有较高的层级
  &.is-fixed {
    border: 1px solid #1890ff; // 拖拽时加个高亮边框
  }

  &.avatar {
    
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    background-color: #dde1e5; // 确保拖拽出来后有背景色

    .avatar-container {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      z-index: 10;
      
      :deep(.ant-avatar) {
        background-color: #a5a9ac; 
        color: #fff;
        font-size: 24px;
        width: 50px;
        height: 50px;
        line-height: 50px;
      }
    }
  }
}
</style>