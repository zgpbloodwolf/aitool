<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useExtensionStore } from './stores/extension'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import ChatPanel from './components/ChatPanel.vue'
import StatusBar from './components/StatusBar.vue'

const extStore = useExtensionStore()
const sidebarVisible = ref(true)

onMounted(() => {
  extStore.loadExtensions()
})
</script>

<template>
  <div class="app-layout">
    <TitleBar @toggle-sidebar="sidebarVisible = !sidebarVisible" />
    <div class="main-content">
      <Sidebar v-if="sidebarVisible" />
      <div class="center-area">
        <ChatPanel class="chat-area" />
      </div>
    </div>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.center-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  overflow: hidden;
}
</style>
