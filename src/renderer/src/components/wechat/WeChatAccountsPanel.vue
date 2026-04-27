<script setup lang="ts">
import { computed, ref } from 'vue'

import { useWeChatStore } from '../../stores/wechat'

const store = useWeChatStore()
const baseUrl = ref('https://ilinkai.weixin.qq.com')
const qrUrl = ref<string | null>(null)
const statusMessage = ref('Ready to link a WeChat account.')
const loggingIn = ref(false)

const accountCountLabel = computed(() => `${store.accounts.length} account(s)`)

async function login(): Promise<void> {
  loggingIn.value = true
  statusMessage.value = 'Requesting QR code...'

  try {
    const started = await window.api.wechatStartQrLogin(baseUrl.value)
    qrUrl.value = started.qrUrl ?? null
    statusMessage.value = started.message

    const completed = await window.api.wechatWaitQrLogin(started.sessionKey, baseUrl.value)
    statusMessage.value = completed.message

    if (completed.connected) {
      qrUrl.value = null
      await store.refresh()
    }
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <div>
        <h2>WeChat Accounts</h2>
        <p>{{ accountCountLabel }}</p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="store.refresh()">Refresh</button>
        <button class="refresh-btn primary-btn" :disabled="loggingIn" @click="login()">
          {{ loggingIn ? 'Waiting...' : 'Link Account' }}
        </button>
      </div>
    </header>

    <label class="field-label">
      <span>Base URL</span>
      <input v-model="baseUrl" class="base-url-input" type="text" />
    </label>

    <p class="status-text">{{ statusMessage }}</p>

    <div v-if="qrUrl" class="qr-panel">
      <img :src="qrUrl" alt="WeChat QR code" class="qr-image" />
      <a :href="qrUrl" target="_blank" rel="noreferrer" class="qr-link">{{ qrUrl }}</a>
    </div>

    <div v-if="store.accounts.length === 0" class="empty-state">
      No linked WeChat account yet.
    </div>

    <ul v-else class="account-list">
      <li v-for="account in store.accounts" :key="account.accountId" class="account-card">
        <div class="account-title">
          <strong>{{ account.displayName || account.accountId }}</strong>
          <span :class="account.connected ? 'status-live' : 'status-idle'">
            {{ account.connected ? 'Connected' : 'Offline' }}
          </span>
        </div>
        <div class="account-meta">
          <span>{{ account.baseUrl }}</span>
          <span>Engine: {{ account.defaultEngine || 'unset' }}</span>
          <span>Isolation: {{ account.sessionIsolationMode }}</span>
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.panel-header h2 {
  font-size: 15px;
  margin-bottom: 4px;
}

.panel-header p {
  color: var(--text-muted);
  font-size: 12px;
}

.refresh-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.refresh-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.refresh-btn:disabled {
  cursor: wait;
  opacity: 0.7;
}

.primary-btn {
  border-color: var(--accent);
  color: var(--accent);
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.base-url-input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 6px;
}

.status-text {
  color: var(--text-secondary);
  font-size: 12px;
}

.qr-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.qr-image {
  width: min(220px, 100%);
  aspect-ratio: 1 / 1;
  object-fit: contain;
  border-radius: 8px;
  background: #fff;
}

.qr-link {
  color: var(--accent);
  word-break: break-all;
}

.empty-state {
  color: var(--text-muted);
  font-size: 13px;
}

.account-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.account-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.account-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.account-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.status-live {
  color: var(--success);
}

.status-idle {
  color: var(--text-muted);
}
</style>
