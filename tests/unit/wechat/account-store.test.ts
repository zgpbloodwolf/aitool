import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearWeChatAccountsDirForTests,
  loadAccount,
  saveAccount,
  setWeChatAccountsDirForTests
} from '../../../src/main/wechat/account-store'

describe('account-store', () => {
  let tempDir = ''

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aitool-wechat-accounts-'))
    setWeChatAccountsDirForTests(tempDir)
  })

  afterEach(async () => {
    clearWeChatAccountsDirForTests()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('round-trips an account record', async () => {
    await saveAccount('acc-1', {
      token: 'token-1',
      baseUrl: 'https://example.com',
      userId: 'u-1'
    })

    await expect(loadAccount('acc-1')).resolves.toMatchObject({
      token: 'token-1',
      baseUrl: 'https://example.com',
      userId: 'u-1'
    })
  })
})
