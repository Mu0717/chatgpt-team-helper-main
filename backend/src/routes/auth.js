import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { getDatabase, saveDatabase } from '../database/init.js'
import { sendVerificationCodeEmail } from '../services/email-service.js'
import { getEmailDomainWhitelist, isEmailDomainAllowed } from '../utils/email-domain-whitelist.js'
import { getAdminMenuTreeForAccessContext, getUserAccessContext } from '../services/rbac.js'
import { safeInsertPointsLedgerEntry } from '../utils/points-ledger.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
const JWT_ALGORITHM = 'HS256'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_REGISTER_REWARD_POINTS = 2

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase()

const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? '')).digest('hex')

const randomVerificationCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

const sendRegisterCode = async (db, email) => {
  const recent = db.exec(
    `
      SELECT 1
      FROM email_verification_codes
      WHERE email = ? AND purpose = 'register'
        AND created_at >= DATETIME('now', 'localtime', '-60 seconds')
      LIMIT 1
    `,
    [email]
  )
  if (recent[0]?.values?.length) {
    return { ok: false, status: 429, error: '验证码发送过于频繁，请稍后再试' }
  }

  const code = randomVerificationCode()
  const codeHash = sha256(code)

  db.run(
    `
      INSERT INTO email_verification_codes (email, purpose, code_hash, expires_at, created_at)
      VALUES (?, 'register', ?, DATETIME('now', 'localtime', '+10 minutes'), DATETIME('now', 'localtime'))
    `,
    [email, codeHash]
  )
  saveDatabase()

  const sent = await sendVerificationCodeEmail(email, code, { expiresMinutes: 10 })
  if (!sent) {
    return { ok: false, status: 500, error: '验证码发送失败，请检查 SMTP 配置' }
  }

  return { ok: true }
}

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    const db = await getDatabase()
    const identifier = String(username).trim()
    const result = db.exec(
      'SELECT id, username, password, email, COALESCE(invite_enabled, 1) FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier]
    )

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = {
      id: result[0].values[0][0],
      username: result[0].values[0][1],
      password: result[0].values[0][2],
      email: result[0].values[0][3],
      inviteEnabled: Number(result[0].values[0][4] ?? 1) !== 0,
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h', algorithm: JWT_ALGORITHM }
    )

    const access = await getUserAccessContext(user.id, db)
    const adminMenus = await getAdminMenuTreeForAccessContext(access, db)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        inviteEnabled: user.inviteEnabled,
        roles: access.roles,
        menus: access.menus,
        adminMenus,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/register/send-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }

    const db = await getDatabase()

    const whitelist = await getEmailDomainWhitelist(db)
    if (!isEmailDomainAllowed(email, whitelist)) {
      return res.status(400).json({ error: '邮箱后缀不在白名单内' })
    }

    const exists = db.exec('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (exists[0]?.values?.length) {
      return res.status(409).json({ error: '邮箱已注册' })
    }

    const result = await sendRegisterCode(db, email)
    if (!result.ok) {
      return res.status(result.status || 500).json({ error: result.error || '发送失败' })
    }

    res.json({ message: '验证码已发送' })
  } catch (error) {
    console.error('Send register code error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const code = String(req.body?.code || '').trim()
    const password = String(req.body?.password || '')
    const inviteCode = String(req.body?.inviteCode || '').trim() || null

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' })
    }
    if (!/^[0-9]{6}$/.test(code)) {
      return res.status(400).json({ error: '验证码格式不正确' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少需要 6 个字符' })
    }

    const db = await getDatabase()

    const whitelist = await getEmailDomainWhitelist(db)
    if (!isEmailDomainAllowed(email, whitelist)) {
      return res.status(400).json({ error: '邮箱后缀不在白名单内' })
    }

    const emailExists = db.exec('SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1', [email, email])
    if (emailExists[0]?.values?.length) {
      return res.status(409).json({ error: '邮箱已注册' })
    }

    const codeResult = db.exec(
      `
        SELECT id, code_hash
        FROM email_verification_codes
        WHERE email = ? AND purpose = 'register'
          AND consumed_at IS NULL
          AND expires_at >= DATETIME('now', 'localtime')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email]
    )
    if (!codeResult[0]?.values?.length) {
      return res.status(400).json({ error: '验证码无效或已过期' })
    }

    const [codeId, expectedHash] = codeResult[0].values[0]
    if (sha256(code) !== expectedHash) {
      return res.status(400).json({ error: '验证码无效或已过期' })
    }

    let inviterUserId = null
    if (inviteCode) {
      const inviterResult = db.exec('SELECT id FROM users WHERE invite_code = ? LIMIT 1', [inviteCode])
      inviterUserId = inviterResult[0]?.values?.length ? inviterResult[0].values[0][0] : null
      if (!inviterUserId) {
        return res.status(400).json({ error: '邀请码无效' })
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10)
    const rewardPoints = inviterUserId ? INVITE_REGISTER_REWARD_POINTS : 0
    db.run(
      `
        INSERT INTO users (username, password, email, invited_by_user_id, invite_enabled, points, created_at)
        VALUES (?, ?, ?, ?, 0, ?, DATETIME('now', 'localtime'))
      `,
      [email, hashedPassword, email, inviterUserId, rewardPoints]
    )

    const userIdResult = db.exec('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    const userId = userIdResult[0]?.values?.length ? userIdResult[0].values[0][0] : null
    if (!userId) {
      return res.status(500).json({ error: '用户创建失败' })
    }

    const roleResult = db.exec('SELECT id FROM roles WHERE role_key = ? LIMIT 1', ['user'])
    const roleId = roleResult[0]?.values?.length ? roleResult[0].values[0][0] : null
    if (roleId) {
      db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId])
    }

    db.run(
      `UPDATE email_verification_codes SET consumed_at = DATETIME('now', 'localtime') WHERE id = ?`,
      [codeId]
    )

    if (rewardPoints > 0) {
      safeInsertPointsLedgerEntry(db, {
        userId,
        deltaPoints: rewardPoints,
        pointsBefore: 0,
        pointsAfter: rewardPoints,
        action: 'register_invite_reward',
        refType: 'invite_code',
        refId: inviteCode || null,
        remark: '邀请码注册奖励'
      })
    }

    saveDatabase()

    const access = await getUserAccessContext(userId, db)
    const adminMenus = await getAdminMenuTreeForAccessContext(access, db)
    const inviteEnabledResult = db.exec(
      'SELECT COALESCE(invite_enabled, 1) FROM users WHERE id = ? LIMIT 1',
      [userId]
    )
    const inviteEnabled = Number(inviteEnabledResult[0]?.values?.[0]?.[0] ?? 1) !== 0
    const token = jwt.sign(
      { id: userId, username: email },
      JWT_SECRET,
      { expiresIn: '24h', algorithm: JWT_ALGORITHM }
    )

    res.json({
      token,
      user: {
        id: userId,
        username: email,
        email,
        inviteEnabled,
        roles: access.roles,
        menus: access.menus,
        adminMenus,
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
