import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { useAppConfigStore } from '@/stores/appConfig'
import { initInterfaceScale } from '@/lib/interfaceScale'
import { pinia } from '@/stores/pinia'

const app = createApp(App)

app.use(pinia)
app.use(router)

initInterfaceScale()

const bootstrap = async () => {
  const appConfigStore = useAppConfigStore(pinia)
  await appConfigStore.loadConfig()
  app.mount('#app')
}

bootstrap()
