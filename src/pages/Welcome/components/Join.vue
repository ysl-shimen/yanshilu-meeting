<template>
  <Card class="joinPanel" title="课程信息">
    <Form layout="vertical" :model="formData">
      <FormItem label="应用Id" name="appId" required v-if="false">
        <Input v-model:value="formData.appId" placeholder="请输入appId" />
      </FormItem>
      <FormItem label="用户Id" name="userId" required v-if="false">
        <Input v-model:value="formData.userId" placeholder="请输入uid" />
      </FormItem>
      <FormItem label="用户名" name="userName" required v-if="false">
        <Input v-model:value="formData.userName" placeholder="请输入userName" />
      </FormItem>
      <FormItem label="状态" name="status" required v-if="false">
        <Input v-model:value="formData.status" placeholder="请输入状态" />
      </FormItem>
      <FormItem label="频道Id" name="channelName" required v-if="false">
        <Input
          v-model:value="formData.channelName"
          placeholder="请输入channelId"
        />
      </FormItem>

      <!-- 使用 Descriptions 组件展示信息 -->
      <FormItem>
        <a-descriptions :column="1" bordered size="middle">
          <a-descriptions-item label="课程">
            {{ formData.courseName }}（{{ formData.courseCode }}）
          </a-descriptions-item>

          <a-descriptions-item label="进度">
            {{ formData.lessonNumber }}/{{ formData.totalLessons }}
          </a-descriptions-item>

          <a-descriptions-item label="时长">
            {{ formData.durationMinutes }}分钟
          </a-descriptions-item>

          <a-descriptions-item label="老师">
            <a-space>
              <a-avatar :src="formData.teacherAvatarUrl" size="small" />
              <span>{{ formData.teacherNickname }}</span>
            </a-space>
          </a-descriptions-item>

          <a-descriptions-item label="学生">
            <a-space>
              <a-avatar :src="formData.studentAvatarUrl" size="small" />
              <span>{{ formData.studentNickname }}</span>
            </a-space>
          </a-descriptions-item>
        </a-descriptions>
      </FormItem>

      <FormItem class="joinButton">
        <Button type="primary" size="large" :loading="joining" @click="onJoin">
          加入课堂
        </Button>
      </FormItem>

      <FormItem class="notice">
        加入课堂前请仔细检查设备信息和课程信息
      </FormItem>
    </Form>
  </Card>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import {
  message,
  Form,
  Input,
  Button,
  Card,
  FormItem,
  Alert,
} from "ant-design-vue";
import { getAppToken } from "~/utils/request";
import { parseSearch, logger } from "~/utils/tools";
import DingRTC, {
  CameraVideoTrack,
  LocalTrack,
  MicrophoneAudioTrack,
  RemoteAudioTrack,
  SubscribeParam,
} from "dingrtc";
import ASR from "dingrtc-asr";
import {
  useClient,
  useGlobalFlag,
  useChannelInfo,
  useCurrentUserInfo,
  useAsrInfo,
  useRTMInfo,
} from "~/store";
import { useRTMInfoHooks } from "~/hooks/channel";
import { useRouter } from "vue-router";
import { courseUserInfo, getUserInfoByToken } from "~/services/recordService";

// 定义组件属性
const props = defineProps<{
  channelId?: string;
  userToken?: string;
}>();

const disableTransportCC = parseSearch("disableTransportCC") === "true";

DingRTC.setClientConfig({
  disableTransportCC,
  simulcast: true,
  highStartBitrate: false,
});

const joining = ref(false);
const router = useRouter();

const channelInfo = useChannelInfo();
const globalFlag = useGlobalFlag();
const asrInfo = useAsrInfo();
const rtmInfo = useRTMInfo();
const { initSessions } = useRTMInfoHooks();
const currentUserInfo = useCurrentUserInfo();

const formData = reactive({
  appId: currentUserInfo.appId,
  userId: currentUserInfo.userId,
  channelName: currentUserInfo.channel,
  userName: currentUserInfo.userName,
  token: currentUserInfo.token,
  gslb: "",
  duration: "",
  delay: "",

  lessonNumber: "0",
  totalLessons: "0",
  durationMinutes: "0",
  studentNickname: "",
  studentAvatarUrl: "-",
  teacherNickname: "",
  teacherAvatarUrl: "-",
  courseName: "未知",
  courseCode: "0",
  status: "-",
});

// 获取URL中的channelId参数和token参数
const channelId = ref("");
const userToken = ref("");

// 监听 channelId, userToken 属性变化并自动填入表单
watch(
  () => [props.channelId, props.userToken],
  ([newChannelId, newUserToken]) => {
    if (newChannelId && newUserToken) {
      formData.channelName = newChannelId;
      currentUserInfo.channel = newChannelId;
      // 可以在这里调用获取用户信息的接口
      fetchUserInfo(newChannelId, newUserToken);
    }
  },
  { immediate: true }
);

const client = useClient();

const onJoin = async () => {
  joining.value = true;

  // 先验证用户信息是否获取成功
  const userInfoSuccess = await fetchUserInfo(
    formData.channelName,
    props.userToken || ""
  );
  if (!userInfoSuccess) {
    joining.value = false;
    return;
  }

  const {
    userId: uid,
    appId: app,
    channelName,
    userName: name,
    duration: newDuration,
    delay: newDelay,
    gslb,
    token,
  } = formData;

  if (!uid || !app || !channelName || !name) {
    message.error("请检查参数填写");
    joining.value = false;
    return;
  }
  logger.info("localJoinChannel");
  joining.value = true;
  try {
    let appTokenResult;
    // const appTokenResult = await getAppToken(uid, app, channelName);
    if (token) {
      appTokenResult = { token, gslb: gslb ? [gslb] : [] };
    } else {
      console.log("get video token");
      appTokenResult = await getAppToken(uid, app, channelName);
      console.log("appTokenResult", appTokenResult);
    }
    const loginParam = {
      appId: app,
      userId: uid,
      userName: name,
      channelName,
      appToken: appTokenResult.token,
    };
    if (appTokenResult?.gslb?.length) {
      DingRTC.setClientConfig({ gslb: gslb || appTokenResult.gslb });
    }
    try {
      const joinParam = {
        appId: loginParam.appId,
        token: loginParam.appToken,
        uid: loginParam.userId,
        channel: loginParam.channelName,
        userName: loginParam.userName,
      };
      const result = await client.join(joinParam);

      joining.value = false;
      currentUserInfo.$patch({
        userId: uid,
        appId: app,
        userName: name,
        channel: channelName,
        duration: newDuration,
        delay: newDelay,
      });
      channelInfo.$patch({ timeLeft: result.timeLeft });
      message.success("加入房间成功");
      channelInfo.$patch({ remoteUsers: result.remoteUsers });
      const subParams: SubscribeParam[] = [
        { uid: "mcu", mediaType: "audio", auxiliary: false },
      ];
      for (const user of result.remoteUsers) {
        if (user.hasAuxiliary) {
          subParams.push({
            uid: user.userId,
            mediaType: "video",
            auxiliary: true,
          });
        }
        if (user.hasVideo) {
          subParams.push({
            uid: user.userId,
            mediaType: "video",
            auxiliary: false,
          });
        }
      }
      const tasks = [];
      const subTask = client
        .batchSubscribe(subParams)
        .then((batchSubscribeResult) => {
          for (const {
            error,
            track,
            uid: usrId,
            auxiliary,
          } of batchSubscribeResult) {
            if (error) {
              message.info(
                `subscribe user ${usrId} ${
                  auxiliary ? "screenShare" : "camera"
                } failed: ${JSON.stringify(error)}`
              );
              logger.info(
                `subscribe user ${usrId} ${
                  auxiliary ? "screenShare" : "camera"
                } failed: ${JSON.stringify(error)}`
              );
              continue;
            }
            if (track.trackMediaType === "audio") {
              logger.info(`subscribe ${usrId} audio`);
              const audioTrack = track as RemoteAudioTrack;
              channelInfo.$patch({
                mcuAudioTrack: audioTrack,
                subscribeAudio: "mcu",
              });
              audioTrack.play();
            } else {
              if (
                !channelInfo.mainViewUserId &&
                !channelInfo.isWhiteboardOpen
              ) {
                channelInfo.$patch({
                  mainViewUserId: usrId,
                  mainViewPreferType: auxiliary ? "auxiliary" : "camera",
                });
              }
              logger.info(
                `subscribe user ${usrId} ${
                  auxiliary ? "screenShare" : "camera"
                }`
              );
              channelInfo.$patch({ remoteUsers: [...client.remoteUsers] });
            }
          }
          if (
            channelInfo.cameraTrack &&
            !channelInfo.mainViewUserId &&
            !channelInfo.isWhiteboardOpen
          ) {
            channelInfo.$patch({
              mainViewUserId: uid,
              mainViewPreferType: "camera",
            });
          }
        });
      tasks.push(subTask);
      const asr = new ASR();
      // @ts-ignore
      window.asr = asr;
      // @ts-ignore
      client.register(asr);
      asrInfo.$patch({
        asr,
        enabled: false,
        originLang: asr.currentSpeakLanguage,
        transLang: asr.currentTranslateLanguages[0],
      });
      client.register(rtmInfo.rtm);
      initSessions();
      const localTracks: LocalTrack[] = [
        channelInfo.cameraTrack as CameraVideoTrack,
        channelInfo.micTrack as MicrophoneAudioTrack,
      ].filter((item) => !!item);
      if (localTracks.length) {
        channelInfo.updateTrackStats(uid);
        const pubTask = client
          .publish(localTracks)
          .then(() => {
            channelInfo.updatePublishedTracks(
              localTracks.map((item) => item.getTrackId()),
              "add"
            );
            logger.info(
              `publish ${localTracks.map((item) => item.trackMediaType)} tracks`
            );
          })
          .catch((e) => {
            message.info(
              `publish ${localTracks.map(
                (item) => item.trackMediaType
              )} tracks failed: ${JSON.stringify(e)}`
            );
            logger.info(
              `publish ${localTracks.map(
                (item) => item.trackMediaType
              )} tracks failed: ${JSON.stringify(e)}`
            );
            throw e;
          });
        tasks.push(pubTask);
      }
      Promise.all(tasks).finally(() => {
        subParams.forEach(({ mediaType, uid }) => {
          if (mediaType === "video") {
            channelInfo.updateTrackStats(uid);
          }
        });
        globalFlag.$patch({ joined: true });
        // 不再需要路由跳转，App.vue会根据状态自动切换组件
      });
    } catch (e: any) {
      logger.info(e);
      joining.value = false;
      globalFlag.$patch({ joined: false });
      message.error(
        `加入房间失败${e?.reason || e?.message || JSON.stringify(e)}`
      );
    }
  } catch (error) {
    globalFlag.$patch({ joined: false });
    joining.value = false;
    message.error(`访问appServer失败${JSON.stringify(error)}`);
    logger.info("error to join", error);
  }
};

/**
 * 根据channelId获取用户信息的函数
 *
 */
async function fetchUserInfo(channelId: string, userToken: string) {
  if (!channelId || !userToken) {
    console.log("参数错误:", channelId, userToken);
    message.error("会议链接有误，请检查会议链接是否正确");
    return false;
  }

  console.log("开始获取用户信息...");

  try {
    console.log("当前用户身份信息:", userToken);
    const resp = await getUserInfoByToken(userToken);
    if (!resp) {
      message.error("获取当前用户信息失败，请检查会议链接是否正确");
      return false;
    }
    
    if (resp.status !== "active") {
      message.error("会议链接token无效，请检查会议链接是否正确");
      return false;
    }

    const currentUser = resp;
    const currentUserId = currentUser.id;
    const currentUserRole = currentUser.current_role;
    const currentUserNickname = currentUser.nickname;
    const currentUserAvatarUrl = currentUser.avatar_url;
    const currentUserStatus = currentUser.status;

    //请求老师学生信息
    console.log("请求老师和学生信息接口:", channelId);
    const response = await courseUserInfo(channelId);

    if (response && response.length !== 0) {
      // 处理返回的用户信息
      const result = response[0];

      // 根据返回的数据更新表单
      formData.userId = currentUserId;
      formData.userName = currentUserNickname;
      currentUserInfo.userId = currentUserId;
      currentUserInfo.userName = currentUserNickname;
      currentUserInfo.avatar = currentUserAvatarUrl;

      if (result.lessonNumber && result.totalLessons) {
        formData.lessonNumber = result.lessonNumber;
        formData.totalLessons = result.totalLessons;
        currentUserInfo.lessonNumber = result.lessonNumber;
        currentUserInfo.totalLessons = result.totalLessons;
      }
      if (result.durationMinutes) {
        formData.durationMinutes = result.durationMinutes;
      }
      if (result.courseName && result.courseCode) {
        formData.courseName = result.courseName;
        formData.courseCode = result.courseCode;
        currentUserInfo.courseName = result.courseName;
        currentUserInfo.courseCode = result.courseCode;
      }
      if (result.teacherNickname) {
        formData.teacherNickname = result.teacherNickname;
        currentUserInfo.teacherNickname = result.teacherNickname;
      }
      if (result.studentNickname) {
        formData.studentNickname = result.studentNickname;
        currentUserInfo.studentNickname = result.studentNickname;
      }
      if (result.teacherAvatarUrl) {
        formData.teacherAvatarUrl = result.teacherAvatarUrl;
      }
      if (result.studentAvatarUrl) {
        formData.studentAvatarUrl = result.studentAvatarUrl;
      }

      return true; // 获取信息成功
    } else {
      console.error("获取用户信息失败:", response.status);
      message.error("获取用户信息失败，请检查会议链接是否正确");
      return false;
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
    message.error("获取用户信息失败，请检查会议链接是否正确");
    return false;
  }
};
</script>

<style lang="less" scoped>
@import url("../index.module.less");
.notice {
  color: #7f8c8d;
}
</style>