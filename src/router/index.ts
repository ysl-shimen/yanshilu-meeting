import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import Welcome from '~/pages/Welcome/index.vue';
import InChannel from '~/pages/InChannel/InChannel.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Welcome',
    component: Welcome
  },
  {
    path: '/:channelId/:userToken?',
    name: 'WelcomeWithChannel',
    component: Welcome
  },
  {
    path: '/meeting/:channelId',
    name: 'InChannel',
    component: InChannel
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;