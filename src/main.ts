import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import './assets/main.css'
import './assets/replay-layout.css'
import './assets/workspace-layout.css'

const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/', component: Dashboard }, { path: '/:pathMatch(.*)*', redirect: '/' }] })
createApp(App).use(createPinia()).use(router).mount('#app')
