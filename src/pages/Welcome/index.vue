<template>
  <div class="wrap">
    <!-- 独立播放页面 -->
    <div class="standalone-playback-section" v-if="meetingEnded && tokenisValid">
      <APITest :channel-id="channelId" :user-token="userToken" @back="goToHome" />
    </div>
    <Title :level="5" class="demoTitle" v-if="!meetingEnded || !tokenisValid">研师录会议</Title>
    <!-- <Button v-if="!meetingEnded" :disabled="testing" class="testNetwork" @click="onTestNetwork || !tokenisValid">
      {{ testing ? `请等待${ticktok}s` : '测试网络' }}
    </Button> -->
    <div class="main" v-if="!meetingEnded || !tokenisValid">
      <Preview :meeting-ended="meetingEnded" />
      <Join :channel-id="channelId" :userToken="userToken" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Typography, Button, Result, message  } from 'ant-design-vue';
import Preview from "./components/Preview.vue";
import Join from "./components/Join.vue";
import { startTestNetworkQuality } from "~/utils/networkQuality";
import { getRecordInfoByChannelId, getMeetingInfoByChannelId, getUserInfoByToken } from '~/services/recordService';
import { useRouter } from 'vue-router';
import APITest from "./components/APITest.vue";
import { useChannelInfo } from '~/store'; // 导入通道信息store
import configJson from "~/config.json";

const { Title } = Typography;
const router = useRouter();

// 获取URL中的channelId参数和token参数
const channelId = ref('');
const userToken = ref('');

// 状态管理
const testing = ref(false);
const ticktok = ref(15);
const meetingEnded = ref(false); // 会议是否已结束
const tokenisValid = ref(false); // token是否有效

const channelInfo = useChannelInfo();

// 在组件挂载时解析URL参数并检查会议状态
onMounted(async () => {
  const pathParts = window.location.pathname.split('/').filter(part => part);
  if (pathParts.length > 0) {
    channelId.value = pathParts[0];
    userToken.value = pathParts[1];
    
    // 检查会议状态
    await checkMeetingStatus();
    //检查Token信息
    await fetchUserInfo(channelId.value, userToken.value);
  }
});

// 检查会议状态
const checkMeetingStatus = async () => {
  try {
    const meetingInfo = await getMeetingInfoByChannelId(channelId.value);
    
    const firstMeeting = meetingInfo?.[0]; 
    if (firstMeeting && firstMeeting.status === 'completed') {
      // 会议已结束并有录制内容
      meetingEnded.value = true;
    }
    
  } catch (error) {
    console.error('检查会议状态失败:', error);
    // 出错时按正常流程处理
  }
};


// 返回首页
const goToHome = () => {
  //meetingEnded.value = false;
};

// 方法
const onTestNetwork = async () => {
  if (!testing.value) {
    testing.value = true;
    ticktok.value = 15;

    const intervalId = setInterval(() => {
      ticktok.value = Math.max(0, ticktok.value - 1);
    }, 1000);

    await startTestNetworkQuality();

    testing.value = false;
    clearInterval(intervalId);
  }
};



/**
 * 根据channelId获取用户信息的函数
 *
 */
const fetchUserInfo = async (channelId: string, userToken: string) => {
  if (!channelId || !userToken) {
    console.log("参数错误:", channelId, userToken);
    message.error("会议链接有误，请检查会议链接是否正确");
    return;
  }

  console.log("开始获取用户信息...");

  try {
    console.log("请求当前用户身份信息接口:", userToken);
    const resp = await getUserInfoByToken(userToken);
    if (!resp) {return;}
    if (resp.status !== "active") {return;}

    tokenisValid.value = true;
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return;
  }
};

</script>

<style lang="less" scoped>
@import url('./index.module.less');


.standalone-playback-section {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0px;
}
</style>