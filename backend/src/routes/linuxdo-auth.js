import express from 'express'
import axios from 'axios'
import { getDatabase, saveDatabase } from '../database/init.js'
import { authenticateLinuxDoSession, signLinuxDoSessionToken } from '../middleware/linuxdo-session.js'
import { getLinuxDoOAuthSettings } from '../utils/linuxdo-settings.js'
import { withLocks } from '../utils/locks.js'

const router = express.Router()

const AUTH_URL = process.env.LINUXDO_AUTH_URL || 'https://connect.linux.do/oauth2/authorize'
const TOKEN_URL = process.env.LINUXDO_TOKEN_URL || 'https://connect.linuxdo.org/oauth2/token'
const USER_INFO_URL = process.env.LINUXDO_USER_INFO_URL || 'https://connect.linuxdo.org/api/user'

const normalizeUid = (value) => String(value ?? '').trim()
const normalizeUsername = (value) => String(value ?? '').trim()
const normalizeName = (value) => String(value ?? '').trim()
const normalizeEmail = (value) => String(value ?? '').trim()
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const normalizeTrustLevel = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null
}

const upsertLinuxDoUser = async ({ uid, username, name, trustLevel }) => {
  const db = await getDatabase()
  const existing = db.exec(
    'SELECT uid FROM linuxdo_users WHERE uid = ? LIMIT 1',
    [uid]
  )

  if (existing.length > 0 && existing[0].values.length > 0) {
    db.run(
      `
        UPDATE linuxdo_users
        SET username = ?,
            name = COALESCE(NULLIF(?, ''), name),
            trust_level = COALESCE(?, trust_level),
            updated_at = DATETIME('now', 'localtime')
        WHERE uid = ?
      `,
      [username, name || '', trustLevel, uid]
    )
  } else {
    db.run(
      `
        INSERT INTO linuxdo_users (uid, username, name, trust_level, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
      `,
      [uid, username, name || null, trustLevel]
    )
  }

  saveDatabase()
}

const loadLinuxDoUserState = (db, uid) => {
  const result = db.exec(
    'SELECT uid, username, email, current_open_account_id, current_open_account_email FROM linuxdo_users WHERE uid = ? LIMIT 1',
    [uid]
  )
  const existed = result.length > 0 && result[0].values.length > 0
  if (!existed) {
    return { existed: false, username: '', email: '', currentOpenAccountId: null, currentOpenAccountEmail: '' }
  }

  const row = result[0].values[0]
  return {
    existed: true,
    username: row[1] || '',
    email: String(row[2] || ''),
    currentOpenAccountId: row[3] ?? null,
    currentOpenAccountEmail: String(row[4] || '')
  }
}

router.get('/authorize-url', async (req, res) => {
  try {
    const oauth = await getLinuxDoOAuthSettings()
    if (!oauth.clientId || !oauth.clientSecret) {
      return res.status(500).json({ error: '未配置 Linux DO OAuth 凭据' })
    }

    const redirectUri = req.query.redirectUri || oauth.redirectUri
    if (!redirectUri) {
      return res.status(400).json({ error: '缺少回调地址 redirectUri' })
    }

    const params = new URLSearchParams({
      client_id: oauth.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user'
    })

    res.json({
      url: `${AUTH_URL}?${params.toString()}`
    })
  } catch (error) {
    console.error('生成 Linux DO 授权链接失败:', error)
    res.status(500).json({ error: '内部服务器错误' })
  }
})

router.post('/exchange', async (req, res) => {
  try {
    const oauth = await getLinuxDoOAuthSettings()
    if (!oauth.clientId || !oauth.clientSecret) {
      return res.status(500).json({ error: '未配置 Linux DO OAuth 凭据' })
    }

    const { code, redirectUri } = req.body

    if (!code) {
      return res.status(400).json({ error: '缺少授权码 code' })
    }

    const finalRedirectUri = redirectUri || oauth.redirectUri

    if (!finalRedirectUri) {
      return res.status(400).json({ error: '缺少回调地址 redirectUri' })
    }

    const payload = new URLSearchParams({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      code,
      redirect_uri: finalRedirectUri,
      grant_type: 'authorization_code'
    })

    const tokenResponse = await axios.post(
      TOKEN_URL,
      payload.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    const accessToken = tokenResponse.data?.access_token
    if (!accessToken) {
      return res.status(502).json({ error: 'Linux DO 未返回访问令牌' })
    }

    const userResponse = await axios.get(USER_INFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const user = userResponse.data || null

    let sessionToken = null
    const uid = normalizeUid(user?.id)
    const username = normalizeUsername(user?.username)
    const name = normalizeName(user?.name)
    const trustLevel = normalizeTrustLevel(user?.trust_level ?? user?.trustLevel)
    if (uid && username) {
      await upsertLinuxDoUser({ uid, username, name, trustLevel })
      sessionToken = signLinuxDoSessionToken({ uid, username, name, trustLevel })
    }

    res.json({
      user,
      sessionToken
    })
  } catch (error) {
    console.error('Linux DO OAuth 失败:', error.response?.data || error.message)
    const status = error.response?.status || 500
    res.status(status).json({
      error: 'Linux DO OAuth 失败',
      details: error.response?.data || error.message
    })
  }
})

router.get('/me', authenticateLinuxDoSession, async (req, res) => {
  try {
    const uid = normalizeUid(req.linuxdo?.uid)
    const usernameFromToken = normalizeUsername(req.linuxdo?.username)
    const nameFromToken = normalizeName(req.linuxdo?.name)
    const trustLevelFromToken = normalizeTrustLevel(req.linuxdo?.trustLevel ?? req.linuxdo?.trust_level)
    if (!uid) {
      return res.status(400).json({ error: '缺少 uid' })
    }

    const db = await getDatabase()
    const result = db.exec(
      'SELECT uid, username, email, current_open_account_id FROM linuxdo_users WHERE uid = ? LIMIT 1',
      [uid]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      const usernameToSave = usernameFromToken || uid
      db.run(
        `
          INSERT INTO linuxdo_users (uid, username, name, trust_level, email, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))
        `,
        [uid, usernameToSave, nameFromToken || null, trustLevelFromToken]
      )
      saveDatabase()
      return res.json({ uid, username: usernameToSave, email: '', currentOpenAccountId: null })
    }

    const row = result[0].values[0]
    const username = row[1] || usernameFromToken
    if (usernameFromToken && row[1] !== usernameFromToken) {
      db.run(
        `
          UPDATE linuxdo_users
          SET username = ?,
              name = COALESCE(NULLIF(?, ''), name),
              trust_level = COALESCE(?, trust_level),
              updated_at = DATETIME('now', 'localtime')
          WHERE uid = ?
        `,
        [usernameFromToken, nameFromToken || '', trustLevelFromToken, uid]
      )
      saveDatabase()
    }

    res.json({
      uid: row[0],
      username,
      email: row[2] || '',
      currentOpenAccountId: row[3] ?? null
    })
  } catch (error) {
    console.error('读取 Linux DO 用户信息失败:', error)
    res.status(500).json({ error: '内部服务器错误' })
  }
})

router.put('/me/email', authenticateLinuxDoSession, async (req, res) => {
  try {
    const uid = normalizeUid(req.linuxdo?.uid)
    const usernameFromToken = normalizeUsername(req.linuxdo?.username)
    if (!uid) {
      return res.status(400).json({ error: '缺少 uid' })
    }

    const emailRaw = req.body?.email
    if (emailRaw === undefined) {
      return res.status(400).json({ error: '缺少 email' })
    }

    const email = normalizeEmail(emailRaw)
    const emailToSave = email ? email.toLowerCase() : null

    if (emailToSave && !isValidEmail(emailToSave)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }

    const db = await getDatabase()
    const retryError = new Error('LOCK_RETRY')
    retryError.code = 'LOCK_RETRY'

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const stateForLock = loadLinuxDoUserState(db, uid)
      const lockedAccountId = stateForLock.currentOpenAccountId ? Number(stateForLock.currentOpenAccountId) : null
      const lockKeys = [`uid:${uid}`]
      if (lockedAccountId) lockKeys.push(`acct:${lockedAccountId}`)

      try {
        await withLocks(lockKeys, async () => {
          const state = loadLinuxDoUserState(db, uid)
		          const existed = state.existed
		          const oldEmail = normalizeEmail(state.email).toLowerCase()
		          const currentOpenAccountId = state.currentOpenAccountId ?? null
		          const currentOpenAccountEmail = normalizeEmail(state.currentOpenAccountEmail).toLowerCase()
		          const accountId = currentOpenAccountId ? Number(currentOpenAccountId) : null

	          if ((lockedAccountId ?? null) !== (accountId ?? null)) {
	            throw retryError
	          }

		          const oldEmailNormalized = oldEmail || ''
		          const newEmailNormalized = (emailToSave || '').trim().toLowerCase()
		          const isOnboarded = Boolean(accountId)
		          const isEmailChanged = oldEmailNormalized !== newEmailNormalized
		          const nextAccountId = currentOpenAccountId ?? null

		          const nextOpenAccountEmail = (() => {
		            if (!isOnboarded) return null
		            const persisted = currentOpenAccountEmail || ''
		            if (persisted) return persisted
		            // 首次引入 current_open_account_email 时，为避免“修改邮箱”导致无法识别当前上车邮箱，兜底写入旧邮箱
		            if (isEmailChanged) return oldEmailNormalized || null
		            return oldEmailNormalized || null
		          })()

		          if (existed) {
		            db.run(
		              `UPDATE linuxdo_users SET email = ?, current_open_account_id = ?, current_open_account_email = ?, username = COALESCE(?, username), updated_at = DATETIME('now', 'localtime') WHERE uid = ?`,
		              [emailToSave, nextAccountId, nextOpenAccountEmail, usernameFromToken || null, uid]
		            )
		          } else {
		            const usernameToSave = usernameFromToken || uid
		            db.run(
		              `INSERT INTO linuxdo_users (uid, username, email, current_open_account_id, current_open_account_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))`,
		              [uid, usernameToSave, emailToSave, nextAccountId, nextOpenAccountEmail]
		            )
		          }

	          saveDatabase()
		          res.json({
		            uid,
		            username: usernameFromToken || uid,
		            email: emailToSave || '',
		            currentOpenAccountId: nextAccountId ?? null
		          })
	        })
	        return
      } catch (error) {
        if (error?.code === 'LOCK_RETRY' && attempt < 1) {
          continue
        }
        throw error
      }
    }

    res.status(409).json({ error: '状态变化，请重试' })
  } catch (error) {
    console.error('更新 Linux DO 邮箱失败:', error)
    res.status(500).json({ error: '内部服务器错误' })
  }
})

router.put('/me/current-open-account', authenticateLinuxDoSession, async (req, res) => {
  try {
    const uid = normalizeUid(req.linuxdo?.uid)
    const usernameFromToken = normalizeUsername(req.linuxdo?.username)
    if (!uid) {
      return res.status(400).json({ error: '缺少 uid' })
    }

    const rawAccountId = req.body?.accountId
    const accountId =
      rawAccountId === null || rawAccountId === undefined || rawAccountId === ''
        ? null
        : Number.parseInt(String(rawAccountId), 10)

    if (accountId !== null && (!Number.isFinite(accountId) || accountId <= 0)) {
      return res.status(400).json({ error: 'accountId 必须是正整数或 null' })
    }

	    const db = await getDatabase()

	    if (accountId !== null) {
	      const check = db.exec(
	        'SELECT id FROM gpt_accounts WHERE id = ? AND is_open = 1 LIMIT 1',
        [accountId]
      )
      if (check.length === 0 || check[0].values.length === 0) {
        return res.status(404).json({ error: '开放账号不存在或已隐藏' })
	      }
	    }

	    await withLocks([`uid:${uid}`], async () => {
	      const existing = db.exec(
	        'SELECT uid FROM linuxdo_users WHERE uid = ? LIMIT 1',
	        [uid]
	      )

	      if (existing.length > 0 && existing[0].values.length > 0) {
	        db.run(
	          `UPDATE linuxdo_users SET current_open_account_id = ?, username = COALESCE(?, username), updated_at = DATETIME('now', 'localtime') WHERE uid = ?`,
	          [accountId, usernameFromToken || null, uid]
	        )
	      } else {
	        const usernameToSave = usernameFromToken || uid
	        db.run(
	          `INSERT INTO linuxdo_users (uid, username, email, current_open_account_id, created_at, updated_at) VALUES (?, ?, NULL, ?, DATETIME('now', 'localtime'), DATETIME('now', 'localtime'))`,
	          [uid, usernameToSave, accountId]
	        )
	      }

	      saveDatabase()
	    })

	    res.json({ uid, username: usernameFromToken || uid, currentOpenAccountId: accountId })
	  } catch (error) {
	    console.error('更新 current_open_account_id 失败:', error)
	    res.status(500).json({ error: '内部服务器错误' })
	  }
	})

export default router
