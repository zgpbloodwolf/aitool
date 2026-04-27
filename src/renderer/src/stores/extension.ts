import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ExtensionInfo } from '../../../shared/types'

export type { ExtensionInfo }

export const useExtensionStore = defineStore('extension', () => {
  const extensions = ref<ExtensionInfo[]>([])
  const activeExtensionId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadExtensions(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      extensions.value = await window.api.getInstalledExtensions()
      if (extensions.value.length > 0 && !activeExtensionId.value) {
        activeExtensionId.value = extensions.value[0].id
      }
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function activateExtension(id: string): Promise<void> {
    await window.api.activateExtension(id)
    activeExtensionId.value = id
  }

  return { extensions, activeExtensionId, loading, error, loadExtensions, activateExtension }
})
