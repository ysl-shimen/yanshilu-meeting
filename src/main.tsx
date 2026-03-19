import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { RtcWhiteboard } from '@dingrtc/whiteboard';
import PdfPlugin from '@dingrtc/whiteboard/PdfPlugin';
import App from './pages/App/App.vue';
import router from './router';
import { loadAppConfig } from './utils/appConfig';
// import './style.css';

RtcWhiteboard.usePdf(PdfPlugin)

// 先加载运行时配置文件（public/config.json），再挂载应用
// 这样所有组件初始化时都能通过 getAppConfig() 同步读取到配置
loadAppConfig()
  .then(() => {
    const pinia = createPinia();
    const app = createApp(App);
    app.use(pinia);
    app.use(router);
    app.mount('#root');
  })
  .catch((err) => {
    console.error('配置文件加载失败，应用无法启动:', err);
    document.body.innerHTML = `<div style="padding:40px;font-size:16px;color:red;">配置文件加载失败，请检查 /config.json 是否存在。<br>${err.message}</div>`;
  });