<script setup lang="ts">
import { useWeChatStore } from '../../stores/wechat'

const store = useWeChatStore()
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <div>
        <h2>Conversations</h2>
        <p>{{ store.conversations.length }} conversation(s)</p>
      </div>
    </header>

    <div v-if="store.conversations.length === 0" class="empty-state">
      No WeChat conversation yet.
    </div>

    <ul v-else class="conversation-list">
      <li
        v-for="conversation in store.conversations"
        :key="conversation.conversationKey"
        class="conversation-card"
      >
        <div class="conversation-title">
          <strong>{{ conversation.peerDisplayName || conversation.peerUserId }}</strong>
          <span>{{ conversation.engine }}</span>
        </div>
        <div class="conversation-meta">
          <span>{{ conversation.accountId }}</span>
          <span>{{ conversation.lastMessagePreview || 'No preview yet' }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-height: 220px;
}

.panel-header h2 {
  font-size: 15px;
  margin-bottom: 4px;
}

.panel-header p {
  color: var(--text-muted);
  font-size: 12px;
}

.empty-state {
  color: var(--text-muted);
  font-size: 13px;
}

.conversation-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conversation-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.conversation-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.conversation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
