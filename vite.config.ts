import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx'
import Components from 'unplugin-vue-components/vite';
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers';
import getPublicPath from './getPublicPath';
import path from 'node:path';

import commonjs from 'vite-plugin-commonjs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    commonjs(),
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
    }),
  ],
  base: getPublicPath(),
  define: {
    local: true,
  },
  resolve: {
    extensions: ['.js', '.ts', '.d.ts', '.tsx', '.vue'],
    alias: {
      '~': path.join(__dirname, 'src'),
    },
  },
  build: {
    // 提高 chunk 警告阈值，避免误报
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // DingRTC 白板 PDF 插件（体积最大，单独拆出）
          if (id.includes('@dingrtc/whiteboard/dist/PdfPlugin')) return 'vendor-whiteboard-pdf';
          // DingRTC 白板核心
          if (id.includes('@dingrtc/whiteboard')) return 'vendor-whiteboard';
          // DingRTC SDK 主包及扩展（dingrtc、dingrtc-asr、@dingrtc/rtm、@dingrtc/shared 等）
          if (id.includes('node_modules/dingrtc') || id.includes('node_modules/dingrtc-asr') || id.includes('node_modules/@dingrtc')) return 'vendor-dingrtc';
          // Ant Design Vue 组件库
          if (id.includes('node_modules/ant-design-vue') || id.includes('node_modules/@ant-design')) return 'vendor-antd';
          // Vue 核心
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/vue-router')) return 'vendor-vue';
          // 其他第三方依赖（含 video.js，不单独拆避免循环依赖）
          if (id.includes('node_modules')) return 'vendor-others';
        },
      },
    },
  },
  server: {
    open: true,
    cors: true,
  },
});