<template>
  <div class="video-player-container">
    <div
      class="video-wrapper"
      ref="videoWrapper"
      :class="{ 'fullscreen-active': isFullscreen }"
    >
      <video
        ref="videoElement"
        class="video-js vjs-big-play-centered vjs-fluid"
        playsinline
        muted
      ></video>

      <!-- 加载中遮罩 -->
      <div class="loading-overlay" v-if="!playerReady">
        <a-spin size="large" v-if="isLoading" />
        <p>{{ loadingText }}</p>
      </div>

      <!-- 自定义控制层 -->
      <div
        class="video-controls"
        :class="{ show: showControls || isTouchActive || volumeSliderHovered }"
      >
        <!-- 底部控制栏 -->
        <div class="bottom-controls">
          <!-- 进度条 -->
          <div class="progress-container">
            <a-slider
              v-model:value="progress"
              :min="0"
              :max="100"
              @change="handleProgressChange"
              :disabled="!playerReady"
            />
          </div>

          <!-- 功能按钮区域 -->
          <div class="controls-content">
            <!-- 左侧 -->
            <div class="left-controls">
              <!-- 播放/暂停 -->
              <a-button
                @click="togglePlay"
                v-if="!isPlayingLocal"
                size="large"
                :disabled="!playerReady"
                class="control-btn"
              >
                <CaretRightOutlined style="font-size: 25px" />
              </a-button>
              <a-button
                @click="togglePlay"
                v-else
                size="large"
                :disabled="!playerReady"
                class="control-btn"
              >
                <PauseOutlined style="font-size: 25px" />
              </a-button>

              <!-- 时间显示 -->
              <span class="time-display">
                {{ formatTime(currentTime) }} /
                {{ formatTime(getDurationInSeconds()) }}
              </span>
            </div>

            <!-- 右侧 -->
            <div class="right-controls">
              <!-- 全屏 -->
              <a-button
                @click="toggleFullscreen"
                size="large"
                :disabled="!playerReady"
                class="control-btn"
              >
                <FullscreenOutlined style="font-size: 25px" />
              </a-button>

              <!-- 倍速选择 -->
              <div class="playback-rate-container">
                <a-dropdown
                  v-model:open="playbackRateDropdownOpen"
                  :trigger="['click']"
                  :getPopupContainer="getPopupContainer"
                >
                  <a-button
                    size="large"
                    class="control-btn"
                    :disabled="!playerReady"
                  >
                    {{ playbackRate }}x
                  </a-button>
                  <template #overlay>
                    <a-menu @click="({ key }) => setPlaybackRate(Number(key))">
                      <a-menu-item
                        v-for="rate in playbackRates"
                        :key="rate"
                        :class="{ active: playbackRate === rate }"
                      >
                        {{
                          Number.isInteger(rate)
                            ? rate.toFixed(1)
                            : rate.toString()
                        }}x
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>

              <!-- 音量控制 -->
              <div class="volume-control">
                <span
                  class="volume-icon"
                  @mouseenter="showVolumeSlider = true"
                  @mouseleave="handleVolumeIconLeave"
                  @touchstart="toggleVolumeSlider"
                >
                  <template v-if="volumeLocal > 0">
                    <template v-if="volumeLocal > 50">
                      <SoundOutlined />
                    </template>
                    <template v-else>
                      <SoundOutlined />
                    </template>
                  </template>
                  <template v-else>
                    <SoundOutlined />
                  </template>
                </span>
                <div
                  class="volume-slider"
                  v-show="showVolumeSlider"
                  @mouseenter="volumeSliderHovered = true"
                  @mouseleave="handleVolumeSliderLeave"
                  @touchstart="volumeSliderHovered = true"
                  @touchend="handleVolumeSliderTouchEnd"
                  @touchcancel="handleVolumeSliderTouchEnd"
                >
                  <a-slider
                    v-model:value="volumeLocal"
                    :min="0"
                    :max="100"
                    @change="handleVolumeChange"
                    @touchend="handleVolumeChangeEnd"
                    @touchcancel="handleVolumeChangeEnd"
                    vertical
                    :tip-formatter="null"
                    style="height: 80px; margin: 0 auto"
                  />
                </div>
              </div>

              <!-- 截图功能 -->
              <a-button
                v-if="!isMobile()"
                @click="captureScreenshot"
                size="large"
                :disabled="!playerReady"
                class="control-btn"
              >
                <ScissorOutlined style="font-size: 20px" />
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/http-streaming";
import {
  CaretRightOutlined,
  PauseOutlined,
  ScissorOutlined,
  FullscreenOutlined,
  SoundOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";

// Props定义
const props = defineProps<{
  videoSrc: string;
  isPlaying: boolean;
  volume: number;
  fileDuration?: number;
}>();

// Emits定义
const emit = defineEmits<{
  (e: "playPause", value: boolean): void;
  (e: "progressChange", value: number): void;
  (e: "volumeChange", value: number): void;
  (e: "timeUpdate", currentTime: number, duration: number): void;
  (e: "screenshot", dataUrl: string): void;
}>();

// 核心引用
const videoElement = ref<HTMLVideoElement | null>(null);
const videoWrapper = ref<HTMLDivElement | null>(null);
let player: videojs.Player | null = null;
const playerReady = ref(false);

// 响应式数据
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);
const showControls = ref(true);
const isHovering = ref(false); // 鼠标悬浮（PC端）
const isTouchActive = ref(false); // 触屏激活（移动端）
const controlsTimer = ref<NodeJS.Timeout | null>(null);
const isPlayingLocal = ref(false);
const volumeLocal = ref(0);

// 倍速相关
const playbackRate = ref(1);
const playbackRates = ref([4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.25, 1.0, 0.75, 0.5]);
const playbackRateDropdownOpen = ref(false);

// 音量控制相关
const showVolumeSlider = ref(false);
const volumeSliderHovered = ref(false);
let volumeHideTimer: NodeJS.Timeout | null = null;
let volumeTouchTimer: NodeJS.Timeout | null = null;

// 加载状态
const isLoading = ref(false);
const loadingText = ref("加载中...");
let errorReported = ref(false);
let errorTimer = ref<NodeJS.Timeout | null>(null);

// 进度更新定时器
let progressUpdateTimer: NodeJS.Timeout | null = null;

// 初始化本地状态
volumeLocal.value = props.volume;
isPlayingLocal.value = props.isPlaying;

// 获取统一时长（秒）
const getDurationInSeconds = () => {
  if (props.fileDuration) {
    return props.fileDuration / 1000;
  }
  return player?.duration() || duration.value || 0;
};

// 监听fileDuration变化
watch(
  () => props.fileDuration,
  (newDurationMs) => {
    if (newDurationMs) {
      duration.value = newDurationMs / 1000;
    }
  },
  { immediate: true }
);

// 切换音量滑块显示（适配触屏）
const toggleVolumeSlider = () => {
  showVolumeSlider.value = !showVolumeSlider.value;
  if (showVolumeSlider.value) {
    volumeSliderHovered.value = true;
    // 触屏时延长显示时间
    if (volumeTouchTimer) clearTimeout(volumeTouchTimer);
    volumeTouchTimer = setTimeout(() => {
      if (!volumeSliderHovered.value) {
        showVolumeSlider.value = false;
      }
    }, 3000);
  } else {
    volumeSliderHovered.value = false;
    if (volumeTouchTimer) clearTimeout(volumeTouchTimer);
  }
};

// 处理音量图标离开
const handleVolumeIconLeave = () => {
  if (volumeHideTimer) clearTimeout(volumeHideTimer);
  volumeHideTimer = setTimeout(() => {
    if (!volumeSliderHovered.value) {
      showVolumeSlider.value = false;
    }
  }, 100);
};

// 处理音量滑块离开
const handleVolumeSliderLeave = () => {
  volumeSliderHovered.value = false;
  setTimeout(() => {
    if (!volumeSliderHovered.value) {
      showVolumeSlider.value = false;
    }
  }, 200);
};

// 处理音量滑块触屏结束
const handleVolumeSliderTouchEnd = () => {
  volumeSliderHovered.value = false;
  setTimeout(() => {
    showVolumeSlider.value = false;
  }, 300);
};

// 处理音量调整结束
const handleVolumeChangeEnd = () => {
  volumeSliderHovered.value = false;
  if (volumeTouchTimer) clearTimeout(volumeTouchTimer);
  volumeTouchTimer = setTimeout(() => {
    showVolumeSlider.value = false;
  }, 500);
};

// 初始化播放器
const initPlayer = async () => {
  try {
    await nextTick();
    if (!videoElement.value) return;

    // 销毁原有播放器
    if (player) {
      player.dispose();
      player = null;
      playerReady.value = false;
    }

    // 播放器配置
    const playerOptions: videojs.PlayerOptions = {
      autoplay: false,
      controls: false,
      responsive: true,
      fluid: true,
      inactivityTimeout: 0,
      muted: volumeLocal.value === 0,
      loadingSpinner: false,
      notSupportedMessage: "",

      // 禁用字幕显示组件，防止读取 videoHeight 报错
      textTrackDisplay: false,
      // 禁用字幕设置按钮
      textTrackSettings: false,
      // 确保不自动加载任何轨道
      tracks: [],

      techOrder: ["html5"],
      html5: {
        hls: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          withCredentials: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      preload: "metadata",
    };

    // 创建播放器
    player = videojs(videoElement.value, playerOptions);
    playerReady.value = false;

    // 初始配置
    player.volume(volumeLocal.value / 100);
    player.playbackRate(playbackRate.value);

    // 绑定事件
    bindPlayerEvents();

    // 设置视频源
    if (props.videoSrc) {
      setVideoSource(props.videoSrc);
    }
  } catch (error) {
    console.error("播放器初始化失败:", error);
    playerReady.value = false;
    isLoading.value = false;
    message.error("播放器初始化失败，请重试");
  }
};

// 设置视频源
const setVideoSource = (src: string) => {
  if (!player || !src) return;

  try {
    isLoading.value = true;
    loadingText.value = src.includes(".m3u8")
      ? "HLS流加载中..."
      : "视频加载中...";
    errorReported.value = false;

    // 清空现有源
    player.pause();
    player.src([]);

    // 设置新源
    const source = {
      src: src,
      type: src.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4",
    };
    player.src(source);

    // 自动播放
    if (isPlayingLocal.value) {
      player.play().catch((err) => {
        console.warn("自动播放失败:", err);
        isPlayingLocal.value = false;
        emit("playPause", false);
      });
    }
  } catch (error) {
    isLoading.value = false;
    if (!errorReported.value) {
      message.error("设置视频源失败");
    }
  }
};

// 设置播放倍速
const setPlaybackRate = (rate: number) => {
  if (!player || !playerReady.value) return;
  playbackRate.value = rate;
  player.playbackRate(rate);
  playbackRateDropdownOpen.value = false;

  // 触发控制栏显示
  startControlsTimer();
};

// 错误处理（防抖）
const handlePlayerError = () => {
  if (!player) return;
  const error = player.error();
  if (!error) return;

  if (errorTimer.value) clearTimeout(errorTimer.value);
  errorTimer.value = setTimeout(() => {
    const currentSrc = player.currentSrc();
    const readyState = player.readyState();

    if (currentSrc && readyState >= 1) {
      errorReported.value = false;
      playerReady.value = true;
      isLoading.value = false;
      return;
    }

    if (!errorReported.value) {
      errorReported.value = true;
      let errorMsg = "播放错误";
      switch (error.code) {
        case 4:
          errorMsg = "视频格式不支持或文件损坏";
          loadingText.value = "视频格式不支持或文件损坏";
          break;
        case 2:
          errorMsg = "网络错误，无法加载视频";
          loadingText.value = "网络错误，无法加载视频";
          break;
        case 1:
          errorMsg = "视频加载被中止";
          loadingText.value = "视频加载被中止";
          break;
        default:
          errorMsg = error.message || "未知播放错误";
          loadingText.value = "未知播放错误";
      }
      message.error(errorMsg);
    }

    playerReady.value = false;
    isLoading.value = false;
  }, 60000);
};

// 平滑更新进度
const updateProgressSmoothly = () => {
  if (!player || !playerReady.value) {
    progressUpdateTimer = setTimeout(updateProgressSmoothly, 100);
    return;
  }

  try {
    const currentTimeVal = player.currentTime();
    const durationVal = getDurationInSeconds();

    currentTime.value = currentTimeVal;
    duration.value = durationVal;

    // 同步播放状态
    if (player.paused() !== !isPlayingLocal.value) {
      isPlayingLocal.value = !player.paused();
    }

    // 播放结束处理
    if (durationVal > 0 && currentTimeVal >= durationVal - 0.5) {
      isPlayingLocal.value = false;
      player.pause();
      player.currentTime(0);
      currentTime.value = 0;
      progress.value = 0;
    }

    if (durationVal > 0) {
      const newProgress = (currentTimeVal / durationVal) * 100;
      progress.value = newProgress;
      emit("timeUpdate", currentTimeVal, durationVal);
      emit("progressChange", newProgress);
    }
  } catch (error) {
    console.error("更新进度失败:", error);
  }

  progressUpdateTimer = setTimeout(updateProgressSmoothly, 50);
};

// 绑定播放器事件
const bindPlayerEvents = () => {
  if (!player) return;

  player.on("play", () => {
    isPlayingLocal.value = true;
    isLoading.value = false;
    emit("playPause", true);
  });

  player.on("pause", () => {
    isPlayingLocal.value = false;
    emit("playPause", false);
  });

  player.on("timeupdate", () => {
    if (!player) return;
    currentTime.value = player.currentTime();
    const durationVal = getDurationInSeconds();
    duration.value = durationVal;
    progress.value =
      durationVal > 0 ? (currentTime.value / durationVal) * 100 : 0;
  });

  player.on("loadedmetadata", () => {
    if (!player) return;
    const durationVal = getDurationInSeconds();
    duration.value = durationVal;
    playerReady.value = true;
    isLoading.value = false;

    if (!progressUpdateTimer) {
      progressUpdateTimer = setTimeout(updateProgressSmoothly, 50);
    }
  });

  player.on("durationchange", () => {
    if (!player) return;
    const durationVal = getDurationInSeconds();
    if (Number.isFinite(durationVal) && durationVal > 0) {
      duration.value = durationVal;
    }
  });

  player.on("canplay", () => {
    playerReady.value = true;
    isLoading.value = false;
    errorReported.value = false;
    if (errorTimer.value) clearTimeout(errorTimer.value);

    if (!progressUpdateTimer) {
      progressUpdateTimer = setTimeout(updateProgressSmoothly, 50);
    }
  });

  player.on("ended", () => {
    isPlayingLocal.value = false;
    progress.value = 0;
    player.pause();
    player.currentTime(0);
    currentTime.value = 0;
    emit("playPause", false);
  });

  player.on("volumechange", () => {
    if (!player) return;
    const newVolume = Math.round(player.volume() * 100);
    volumeLocal.value = newVolume;
    emit("volumeChange", newVolume);
  });

  player.on("error", handlePlayerError);
  player.on("hlsManifestLoaded", () => {
    errorReported.value = false;
    if (errorTimer.value) clearTimeout(errorTimer.value);
    playerReady.value = true;
    isLoading.value = false;
  });

  player.on("hlsLevelLoaded", () => {
    errorReported.value = false;
    playerReady.value = true;
    isLoading.value = false;
  });

  player.on("hlsError", (event: any, data: any) => {
    console.error("HLS错误:", data);
    loadingText.value = "HLS流加载失败，重试中...";
  });
};

// 播放/暂停切换
const togglePlay = () => {
  if (!player || !playerReady.value) return;

  if (isPlayingLocal.value) {
    player.pause();
  } else {
    player.play().catch((err) => {
      console.warn("播放失败:", err);
      message.warning("播放失败，请检查视频源或网络");
    });
  }
  // 触发控制栏显示
  startControlsTimer();
};

// 进度调整
const handleProgressChange = (value: number) => {
  if (!player || !playerReady.value) return;

  const durationVal = getDurationInSeconds();
  if (durationVal === 0) return;

  const newTime = (value / 100) * durationVal;
  player.currentTime(newTime);
  currentTime.value = newTime;
  progress.value = value;
  emit("progressChange", value);
  // 触发控制栏显示
  startControlsTimer();
};

// 音量调整
const handleVolumeChange = (value: number) => {
  if (!player || !playerReady.value) return;

  volumeLocal.value = value;
  const newVolume = value / 100;
  player.volume(newVolume);
  player.muted(value === 0);
  emit("volumeChange", value);

  if (volumeTouchTimer) clearTimeout(volumeTouchTimer);
  volumeTouchTimer = setTimeout(() => {
    showVolumeSlider.value = false;
    volumeSliderHovered.value = false;
  }, 800);
};

// 截图功能
const captureScreenshot = () => {
  // 假设你用的是原生 video 标签或通过 player 获取
  const videoEl = videoWrapper.value?.querySelector("video");

  if (!videoEl) {
    message.error("未找到视频源");
    return;
  }

  // 2. 创建 Canvas
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  // 3. 绘制画面
  try {
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.error(err);
    message.error("截图失败：视频源存在跨域限制");
    return;
  }

  // 4. 导出并下载
  canvas.toBlob((blob) => {
    if (!blob) {
      message.error("生成图片失败");
      return;
    }

    const url = URL.createObjectURL(blob);

    // --- 针对移动端的特殊处理 ---
    if (isMobile()) {
      // 方案 A: 尝试自动下载（文件会进入“文件/下载”目录，不在相册）
      const link = document.createElement("a");
      link.href = url;
      link.download = `screenshot_${Date.now()}.png`;
      link.style.display = "none";
      document.body.appendChild(link); // 关键：必须挂载到 body
      link.click();
      document.body.removeChild(link);

      // 提示文案修改
      message.success("截图已保存，请在“文件”或“下载管理”中查看", 4);

      // 方案 B (推荐): 如果你想让用户存到相册，建议弹窗展示图片让用户长按
      // openImagePreviewModal(url); // 如果你有预览弹窗组件，这里调用最好
    } else {
      // PC 端正常下载
      const link = document.createElement("a");
      link.href = url;
      link.download = `screenshot_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success("截图已保存");
    }

    // 释放内存
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
};

// 全屏切换
const toggleFullscreen = () => {
  if (!videoWrapper.value || !playerReady.value) return;

  try {
    if (!document.fullscreenElement) {
      if (videoWrapper.value.requestFullscreen) {
        videoWrapper.value.requestFullscreen();
      } else if ((videoWrapper.value as any).webkitRequestFullscreen) {
        (videoWrapper.value as any).webkitRequestFullscreen();
      } else if ((videoWrapper.value as any).mozRequestFullScreen) {
        (videoWrapper.value as any).mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      }
    }
    // 触发控制栏显示
    startControlsTimer();
  } catch (error) {
    console.error("全屏切换失败:", error);
    message.warning("全屏切换失败");
  }
};

// 时间格式化
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
};

// 控制栏显示定时器（适配移动端+PC端）
const startControlsTimer = () => {
  // 1. 清除旧定时器
  if (controlsTimer.value) clearTimeout(controlsTimer.value);

  // 2. 立即显示控制栏
  showControls.value = true;
  isTouchActive.value = true;

  // 3. 开启3秒倒计时
  controlsTimer.value = setTimeout(() => {
    // 【核心修改】：移除了 !isHovering.value 的判断
    // 只要定时器走完，说明3秒内无操作，直接隐藏
    // 增加 !playbackRateDropdownOpen.value 防止在选倍速时菜单消失
    if (!volumeSliderHovered.value && !playbackRateDropdownOpen.value) {
      showControls.value = false;
      isTouchActive.value = false;

      // 关键：隐藏时强制将 hovering 设为 false
      // 这样下次用户稍微动一下鼠标，mousemove 就会触发并重新显示控制栏
      isHovering.value = false;
    }
  }, 3000);
};

// 判断是否是移动端
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// 获取弹出层容器，解决全屏模式下下拉菜单无法显示的问题
const getPopupContainer = (triggerNode: HTMLElement) => {
  // 如果当前在全屏模式下，使用document.body作为容器
  if (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement
  ) {
    return document.body;
  }
  // 否则使用默认容器
  return videoWrapper.value || document.body;
};

const isFullscreen = ref(false);
// 监听全屏变化
// --- 修改：监听全屏变化函数 ---
const handleFullscreenChange = () => {
  // 判断当前是否处于全屏状态（兼容各浏览器）
  const isFull = !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement
  );

  isFullscreen.value = isFull; // 更新状态

  // 当退出全屏时，关闭倍速下拉菜单（原有逻辑）
  if (!isFull) {
    playbackRateDropdownOpen.value = false;
  }
};

// 初始化事件监听
onMounted(() => {
  startControlsTimer();

  // 监听全屏变化
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);

  if (videoWrapper.value) {
    // 统一的点击/触屏处理函数
    const handlePlayPauseClick = (e: Event) => {
      const target = e.target as HTMLElement;
      // 扩展控制元素选择器，包含所有控制相关组件
      const isControlElement = target.closest(
        ".control-btn, .ant-slider, .volume-control, .ant-dropdown, .progress-container, .ant-dropdown-menu"
      );

      // 只有点击非控制区域时，才触发播放/暂停 + 阻止默认300ms延迟
      if (!isControlElement && playerReady.value) {
        togglePlay();
        if (isMobile()) e.preventDefault(); // 仅移动端阻止默认行为
      }
      // 无论是否触发播放，都显示控制栏
      startControlsTimer();
    };

    // 双击全屏监听
    document.addEventListener("dblclick", handleDoubleClick);

    // PC端鼠标事件
    videoWrapper.value.addEventListener("mousemove", () => {
      isHovering.value = true;
      startControlsTimer();
    });

    videoWrapper.value.addEventListener("mouseleave", () => {
      isHovering.value = false;
      if (controlsTimer.value) clearTimeout(controlsTimer.value);
      if (!volumeSliderHovered.value) {
        showControls.value = false;
        isTouchActive.value = false;
      }
    });

    // 移动端触屏事件（优先处理，避免300ms延迟）
    if (isMobile()) {
      videoWrapper.value.addEventListener("touchstart", handlePlayPauseClick, {
        passive: true,
      });
      // 单独处理click事件，避免重复触发
      videoWrapper.value.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement;
          const isControlElement = target.closest(
            ".control-btn, .ant-slider, .volume-control, .ant-dropdown, .progress-container, .ant-dropdown-menu"
          );
          if (!isControlElement) e.preventDefault();
        },
        { passive: false }
      );
    } else {
      // PC端点击事件
      videoWrapper.value.addEventListener("click", handlePlayPauseClick);
    }
  }

  // 初始化播放器
  setTimeout(initPlayer, 300);

  // 启动进度更新
  if (!progressUpdateTimer) {
    progressUpdateTimer = setTimeout(updateProgressSmoothly, 100);
  }
});

// 清理资源
onUnmounted(() => {
  if (controlsTimer.value) clearTimeout(controlsTimer.value);
  if (errorTimer.value) clearTimeout(errorTimer.value);
  if (progressUpdateTimer) clearTimeout(progressUpdateTimer);
  if (volumeHideTimer) clearTimeout(volumeHideTimer);
  if (volumeTouchTimer) clearTimeout(volumeTouchTimer);
  // 移除双击监听
  document.removeEventListener("dblclick", handleDoubleClick);

  // 移除全屏监听
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  document.removeEventListener(
    "webkitfullscreenchange",
    handleFullscreenChange
  );
  document.removeEventListener("mozfullscreenchange", handleFullscreenChange);

  if (player) {
    player.off("error", handlePlayerError);
    player.off();
    player.dispose();
    player = null;
  }

  // 移除事件监听
  if (videoWrapper.value) {
    const handlePlayPauseClick = (e: Event) => {};
    videoWrapper.value.removeEventListener("touchstart", handlePlayPauseClick);
    videoWrapper.value.removeEventListener("click", handlePlayPauseClick);
    videoWrapper.value.removeEventListener("mousemove", () => {});
    videoWrapper.value.removeEventListener("mouseleave", () => {});
  }

  playerReady.value = false;
  isLoading.value = false;
  errorReported.value = false;
});

// 双击处理函数
const handleDoubleClick = (e: Event) => {
  const target = e.target as HTMLElement;

  // 1. 基础安全检查
  if (!target.isConnected) return;

  // 2. 检查是否点击了控制组件（按钮、进度条等）
  // 如果双击的是音量条或按钮，不应该触发全屏
  const isControlElement = target.closest(
    ".control-btn, .ant-slider, .volume-control, .ant-dropdown, .progress-container, .ant-dropdown-menu, .playback-rate-container"
  );

  if (!isControlElement && playerReady.value) {
    e.preventDefault(); // 防止双击选中文字等默认行为
    toggleFullscreen();
  }
};
</script>

<style scoped>
.video-player-container {
  width: 100%;
  position: relative;
}

.video-wrapper {
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  touch-action: manipulation; /* 优化触屏体验 */
}

/* Video.js容器样式 */
:deep(.video-js) {
  position: absolute !important;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
  background-image: url("https://cdn.yanshilu.com/resources/111_1764125953293_IUTIO_Lrcy_1764125953294_tn0x5u.jpg");
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  background-position: center 5%;
}

:deep(.vjs-tech) {
  object-fit: contain !important;
}

/* 加载中遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  z-index: 5;
}

.loading-overlay p {
  margin-top: 16px;
  font-size: 16px;
}

/* 控制层 - 隐藏时允许指针事件穿透 */
.video-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  padding: 5px;
  color: white;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none; /* 隐藏时允许点击穿透到下层 */
  z-index: 999; /* 确保层级最高 */
  touch-action: manipulation;
}

.video-controls.show {
  opacity: 1;
  pointer-events: auto; /* 显示时拦截点击事件 */
}

/* 底部控制栏 */
.bottom-controls {
  width: 100%;
  margin-top: auto;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 进度条容器 */
.progress-container {
  width: 98%;
  margin: 0 auto;
  z-index: 1; /* 降低进度条的z-index */
}

/* 强制去除 Ant Design Slider 自带的巨大 margin */
:deep(.ant-slider) {
  margin: 4px 6px 2px 6px !important; /* 关键修改 */
}

/* 功能按钮区域 */
.controls-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
  width: 100%;
  flex-wrap: nowrap;
  gap: 2px;
  box-sizing: border-box;
  overflow: visible;
}

/* 左侧控制区 */
.left-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 1;
  flex-grow: 0;
  max-width: 45%;
}

/* 右侧控制区 */
.right-controls {
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  gap: 4px;
  flex-shrink: 1;
  flex-grow: 0;
  max-width: 55%;
}

/* 时间显示 */
.time-display {
  min-width: 80px;
  max-width: 100px;
  display: inline-block;
  white-space: nowrap;
  font-size: inherit;
}

/* 滑块样式 */
:deep(.ant-slider-rail) {
  background-color: rgba(255, 255, 255, 0.3);
}

:deep(.ant-slider-track) {
  background-color: #1890ff;
}

:deep(.ant-slider-handle) {
  border-color: #1890ff;
}

/* 确保所有控制相关元素的指针事件不被拦截 */
:deep(.ant-dropdown),
:deep(.ant-dropdown-trigger),
:deep(.ant-slider),
:deep(.volume-control),
:deep(.progress-container) {
  pointer-events: auto !important;
  z-index: 1001 !important; /* 确保控制元素层级最高 */
}

/* 控制按钮样式（强化触屏可点击区域） */
.control-btn {
  border: none !important;
  background: transparent !important;
  color: white !important;
  padding: 0 8px !important; /* 扩大点击区域 */
  min-width: 40px !important; /* 增大最小点击宽度 */
  height: 44px !important; /* 增大点击高度 */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  pointer-events: auto !important;
  z-index: 1002 !important; /* 按钮层级高于其他控制元素 */
  touch-action: manipulation !important; /* 优化触屏响应 */
}

:deep(.control-btn:hover) {
  color: white !important;
  border-color: white !important;
  background: rgba(0, 0, 0, 0.5) !important;
}

/* 倍速选择容器 */
.playback-rate-container {
  position: relative;
  z-index: 1005 !important;
}

/* 倍速菜单样式 - 修复滚动条问题 */
:deep(.ant-dropdown-menu) {
  background-color: rgba(0, 0, 0, 0.8) !important;
  border-color: rgba(255, 255, 255, 0.2) !important;
  z-index: 1007 !important;
  /* 移除固定高度和滚动条，让菜单自适应 */
  max-height: none !important;
  overflow-y: visible !important;
}

/* 全屏模式下的特殊处理 */
.video-wrapper.fullscreen-active .playback-rate-container {
  z-index: 100000 !important; /* 全屏时更高 */
}

.video-wrapper.fullscreen-active :deep(.ant-dropdown) {
  z-index: 100001 !important;
}

:deep(.ant-dropdown-menu-item) {
  color: white !important;
  pointer-events: auto !important;
}

:deep(.ant-dropdown-menu-item-active),
:deep(.ant-dropdown-menu-item:hover) {
  background-color: rgba(24, 144, 255, 0.3) !important;
}

:deep(.ant-dropdown-menu-item.active) {
  background-color: rgba(24, 144, 255, 0.5) !important;
  color: white !important;
}

/* 全屏模式下确保下拉菜单可见 */
:fullscreen :deep(.ant-dropdown),
:-webkit-full-screen :deep(.ant-dropdown),
:-moz-full-screen :deep(.ant-dropdown) {
  z-index: 1007 !important;
}

:deep(.ant-dropdown) {
  z-index: 1006 !important; /* 确保在下拉时位于最顶层 */
}

:fullscreen :deep(.ant-dropdown-menu),
:-webkit-full-screen :deep(.ant-dropdown-menu),
:-moz-full-screen :deep(.ant-dropdown-menu) {
  z-index: 1006 !important;
}

/* 在小屏幕设备上，如果菜单内容过多，才显示滚动条 */
@media (max-height: 600px) {
  :deep(.ant-dropdown-menu) {
    max-height: 250px !important;
    overflow-y: auto !important;
  }
}

/* 音量控制 */
.volume-control {
  position: relative;
  display: flex;
  align-items: center;
  z-index: 1000;
  pointer-events: auto;
}

.volume-icon {
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  z-index: 1001;
}

.volume-slider {
  position: absolute;
  left: 50%;
  top: -90px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 100px;
  touch-action: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .controls-content {
    padding: 0 1px;
    gap: 1px;
  }

  .left-controls {
    gap: 2px;
    max-width: 40%;
  }

  .right-controls {
    gap: 2px;
    max-width: 60%;
  }

  .time-display {
    min-width: 70px;
    max-width: 90px;
  }

  .control-btn {
    min-width: 32px !important;
    padding: 0 2px !important;
  }

  .volume-slider {
    top: -85px;
    height: 90px;
    width: 36px;
  }
}

@media (max-width: 480px) {
  .left-controls {
    max-width: 35%;
  }

  .right-controls {
    max-width: 65%;
  }

  .time-display {
    min-width: 65px;
    max-width: 80px;
  }

  .volume-slider {
    top: -80px;
    height: 80px;
    width: 32px;
  }
}

/* 隐藏Video.js默认错误信息 */
:deep(.vjs-error .vjs-error-display) {
  display: none;
}

:deep(.vjs-error-display) {
  display: none !important;
}

/* 1. 强制重置容器：去掉原本的 padding-bottom 占位 */
.video-wrapper.fullscreen-active {
  width: 100vw !important;
  height: 100vh !important;
  padding-bottom: 0 !important; /* 核心：去掉 56.25% 的撑开高度 */
  margin: 0 !important;
  background: #000;
  overflow: visible !important; /* 允许子元素溢出（双重保险） */
}

/* 2. 强制控制层定位：直接相对于屏幕视口定位 */
.video-wrapper.fullscreen-active .video-controls {
  position: fixed !important; /* 改为 fixed，脱离父容器流 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 99999 !important; /* 确保在最上层 */
}

/* 3. 底部控制栏适配：增加安全距离 */
.video-wrapper.fullscreen-active .bottom-controls {
  /* 确保底部紧贴屏幕底部 */
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;

  /* 适配 iPhone X 等全面屏底部的横条 */
  padding-bottom: calc(15px + env(safe-area-inset-bottom)) !important;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.9),
    rgba(0, 0, 0, 0)
  ); /* 加深底部背景，让按钮更清晰 */
}

/* ============================================================
   【Web端全屏画面修复】
   解决 vjs-fluid 导致的画面无法铺满、背景图透出、四周留白问题
   ============================================================ */

/* 1. 针对 Video.js 容器本身 */
.video-wrapper.fullscreen-active :deep(.video-js) {
  /* 强制占满全屏容器 */
  width: 100% !important;
  height: 100% !important;

  /* 关键：覆盖 vjs-fluid 的 padding 设置 */
  /* vjs-fluid 靠 padding 撑开高度，全屏时必须归零，否则画面会"悬浮" */
  padding-top: 0 !important;
  padding-bottom: 0 !important;

  /* 隐藏原本的封面背景图，防止视频比例不符时露出背景 */
  background-image: none !important;
  background-color: #000 !important; /* 留白部分变黑 */
}

/* 2. 针对视频画面元素 (vjs-tech) */
.video-wrapper.fullscreen-active :deep(.vjs-tech) {
  /* 确保视频元素本身也是 100% */
  width: 100% !important;
  height: 100% !important;

  /* 保持比例，最大化显示 */
  /* 如果视频比屏幕宽，上下留黑边；如果视频比屏幕高，左右留黑边 */
  object-fit: contain !important;

  /* 确保绝对居中 */
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
}

/* 3. 隐藏 Video.js 默认的控制条背景（如果有的话） */
.video-wrapper.fullscreen-active :deep(.vjs-control-bar) {
  display: none !important; /* 我们用了自定义控制栏，隐藏原生的 */
}

/* 全屏且控制栏隐藏时，隐藏鼠标光标 */
.video-wrapper.fullscreen-active {
  cursor: none;
}

/* 当控制栏显示时，恢复鼠标光标 */
.video-wrapper.fullscreen-active .video-controls.show {
  cursor: default;
}

/* =======================测试样式===================== */
</style>