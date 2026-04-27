<script setup lang="ts">
import { onMounted } from 'vue'

import { useWeChatStore } from '../../stores/wechat'
import WeChatAccountsPanel from './WeChatAccountsPanel.vue'
import WeChatConversationsPanel from './WeChatConversationsPanel.vue'

const store = useWeChatStore()

onMounted(() => {
  void store.refresh()
})
</script>

<template>
  <div class="wechat-workspace">
    <WeChatAccountsPanel />
    <WeChatConversationsPanel />
  </div>
</template>

<style scoped>
.wechat-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 16px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

@media (max-width: 960px) {
  .wechat-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
