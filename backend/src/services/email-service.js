import nodemailer from 'nodemailer'
import { getSmtpSettings } from '../utils/smtp-settings.js'

const parseRecipients = (value) => {
  const raw = String(value || '')
  return raw
    .split(',')
    .map(email => String(email || '').trim())
    .filter(Boolean)
}

const buildSmtpConfig = (settings) => {
  const host = String(settings?.smtp?.host || '').trim()
  const port = Number(settings?.smtp?.port || 0)
  const secure = Boolean(settings?.smtp?.secure)
  const user = String(settings?.smtp?.user || '').trim()
  const pass = String(settings?.smtp?.pass || '')

  if (!host || !user || !pass) {
    return null
  }

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure,
    auth: {
      user,
      pass
    }
  }
}

export async function sendAdminAlertEmail({ subject, text, html } = {}) {
  const settings = await getSmtpSettings()
  const smtpConfig = buildSmtpConfig(settings)
  if (!smtpConfig) {
    console.warn('[AdminAlert] SMTP 配置不完整，跳过发送告警邮件')
    return false
  }

  const recipients = parseRecipients(settings?.adminAlertEmail)
  if (recipients.length === 0) {
    console.warn('[AdminAlert] ADMIN_ALERT_EMAIL 未配置，跳过发送告警邮件')
    return false
  }

  const resolvedSubject = String(subject || '').trim() || '系统告警'
  const from = String(settings?.smtp?.from || '').trim() || smtpConfig.auth.user
  const resolvedText = typeof text === 'string' ? text : (text != null ? String(text) : '')
  const resolvedHtml = typeof html === 'string' ? html : ''

  const transporter = nodemailer.createTransport(smtpConfig)

  try {
    await transporter.sendMail({
      from,
      to: recipients.join(','),
      subject: resolvedSubject,
      text: resolvedText || undefined,
      html: resolvedHtml || undefined
    })
    console.log('[AdminAlert] 告警邮件已发送', { subject: resolvedSubject })
    return true
  } catch (error) {
    console.warn('[AdminAlert] 发送告警邮件失败', error?.message || error)
    return false
  }
}

function buildOpenAccountsSweeperBody(summary) {
  const {
    startedAt,
    finishedAt,
    maxJoined,
    scanCreatedWithinDays,
    scannedCount,
    totalKicked,
    results = [],
    failures = []
  } = summary || {}

  const humanStart = startedAt ? startedAt.toLocaleString() : ''
  const humanEnd = finishedAt ? finishedAt.toLocaleString() : ''

  const rows = (results || [])
    .map(item => {
      const emailPrefix = String(item.emailPrefix || '')
      const joined = item.joined ?? '未知'
      const kicked = Number(item.kicked || 0)
      const didKick = Boolean(item.didKick) || kicked > 0
      return `<tr><td>${emailPrefix}</td><td style="text-align:right;">${joined}</td><td style="text-align:center;">${didKick ? '是' : '否'}</td><td style="text-align:right;">${kicked}</td></tr>`
    })
    .join('')

  const failureRows = (failures || [])
    .map(item => {
      const label = item.emailPrefix ? `${item.emailPrefix} (ID=${item.accountId})` : `ID=${item.accountId}`
      return `<li>账号 ${label}：${item.error || '执行失败'}</li>`
    })
    .join('')

  const htmlParts = [
    `<p>开放账号超员扫描已完成。</p>`,
    `<p>扫描账号数：${scannedCount ?? 0}，阈值：joined &gt; ${maxJoined ?? ''}，本次踢出：${totalKicked ?? 0}</p>`,
    ...(Number(scanCreatedWithinDays) > 0 ? [`<p>扫描范围：最近 ${scanCreatedWithinDays} 天创建的开放账号</p>`] : []),
    '<table style="border-collapse:collapse;width:100%;">',
    '<thead><tr><th style="text-align:left;border-bottom:1px solid #ccc;">邮箱前缀</th><th style="text-align:right;border-bottom:1px solid #ccc;">当前人数</th><th style="text-align:center;border-bottom:1px solid #ccc;">是否踢出</th><th style="text-align:right;border-bottom:1px solid #ccc;">踢出人数</th></tr></thead>',
    `<tbody>${rows || '<tr><td colspan="4">无</td></tr>'}</tbody>`,
    '</table>'
  ]

  if ((failures || []).length > 0) {
    htmlParts.push('<p>以下账号处理失败：</p>')
    htmlParts.push(`<ul>${failureRows}</ul>`)
  }

  if (humanStart || humanEnd) {
    htmlParts.push('<p>')
    if (humanStart) htmlParts.push(`开始时间：${humanStart}<br/>`)
    if (humanEnd) htmlParts.push(`结束时间：${humanEnd}`)
    htmlParts.push('</p>')
  }

  const textRows =
    results && results.length
      ? results
          .map(item => {
            const emailPrefix = String(item.emailPrefix || '')
            const joined = item.joined ?? '未知'
            const kicked = Number(item.kicked || 0)
            const didKick = Boolean(item.didKick) || kicked > 0
            return `- ${emailPrefix}: 当前人数=${joined} 是否踢出=${didKick ? '是' : '否'} 踢出人数=${kicked}`
          })
          .join('\n')
      : '无'

  const textFailures =
    failures && failures.length
      ? '\n\n失败：\n' +
        failures
          .map(item => {
            const label = item.emailPrefix ? `${item.emailPrefix} (ID=${item.accountId})` : `ID=${item.accountId}`
            return `- ${label}: ${item.error || '执行失败'}`
          })
          .join('\n')
      : ''

  const textTime = humanStart || humanEnd ? `\n\n开始时间：${humanStart}\n结束时间：${humanEnd}` : ''

  return {
    html: htmlParts.join('\n'),
    text: `开放账号超员扫描已完成。\n扫描账号数：${scannedCount ?? 0}，阈值：${maxJoined ?? ''}，本次踢出：${totalKicked ?? 0}${Number(scanCreatedWithinDays) > 0 ? `\n扫描范围：最近 ${scanCreatedWithinDays} 天创建的开放账号` : ''}\n\n${textRows}${textFailures}${textTime}`
  }
}

export async function sendOpenAccountsSweeperReportEmail(summary) {
  const settings = await getSmtpSettings()
  const smtpConfig = buildSmtpConfig(settings)
  if (!smtpConfig) {
    console.warn('[OpenAccountsSweeper] SMTP 配置不完整，跳过发送扫描报告')
    return false
  }

  const recipients = parseRecipients(settings?.adminAlertEmail)
  if (recipients.length === 0) {
    console.warn('[OpenAccountsSweeper] ADMIN_ALERT_EMAIL 未配置，跳过发送扫描报告')
    return false
  }

  const transporter = nodemailer.createTransport(smtpConfig)
  const { html, text } = buildOpenAccountsSweeperBody(summary)

  const subject = process.env.OPEN_ACCOUNTS_SWEEPER_REPORT_SUBJECT || '开放账号超员扫描报告'
  const from = String(settings?.smtp?.from || '').trim() || smtpConfig.auth.user

  await transporter.sendMail({
    from,
    to: recipients.join(','),
    subject,
    text,
    html
  })

  console.log('[OpenAccountsSweeper] 扫描报告邮件已发送')
  return true
}

export async function sendPurchaseOrderEmail(order) {
  const settings = await getSmtpSettings()
  const smtpConfig = buildSmtpConfig(settings)
  if (!smtpConfig) {
    console.warn('[Purchase] SMTP 配置不完整，跳过发送订单邮件')
    return false
  }

  const to = String(order?.email || '').trim()
  if (!to) {
    console.warn('[Purchase] 缺少收件邮箱，跳过发送订单邮件')
    return false
  }

  const transporter = nodemailer.createTransport(smtpConfig)
  const from = String(settings?.smtp?.from || '').trim() || smtpConfig.auth.user
  const subject = process.env.PURCHASE_EMAIL_SUBJECT || '订单信息'

  const orderNo = String(order?.orderNo || '')
  const serviceDays = Number(order?.serviceDays || 30)

  const text = [
    `订单号：${orderNo}`,
    `邮箱：${to}`,
    `有效期：${serviceDays} 天（下单日起算）`,
  ].join('\n')

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">订单信息</h2>
      <p style="margin: 0 0 6px;">订单号：<strong>${orderNo}</strong></p>
      <p style="margin: 0 0 6px;">邮箱：${to}</p>
      <p style="margin: 0 0 6px;">有效期：${serviceDays} 天（下单日起算）</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    })
    console.log('[Purchase] order email sent', { orderNo })
    return true
  } catch (error) {
    console.warn('[Purchase] send order email failed', error?.message || error)
    return false
  }
}

export async function sendVerificationCodeEmail(email, code, options = {}) {
  const settings = await getSmtpSettings()
  const smtpConfig = buildSmtpConfig(settings)
  if (!smtpConfig) {
    console.warn('[VerifyCode] SMTP 配置不完整，跳过发送验证码邮件')
    return false
  }

  const to = String(email || '').trim()
  if (!to) {
    console.warn('[VerifyCode] 缺少收件邮箱，跳过发送验证码邮件')
    return false
  }

  const resolvedCode = String(code || '').trim()
  if (!resolvedCode) {
    console.warn('[VerifyCode] 缺少验证码，跳过发送验证码邮件')
    return false
  }

  const minutes = Number(options?.expiresMinutes || 10)
  const subject = options?.subject || process.env.EMAIL_VERIFICATION_SUBJECT || '邮箱验证码'
  const from = String(settings?.smtp?.from || '').trim() || smtpConfig.auth.user
  const transporter = nodemailer.createTransport(smtpConfig)

  const text = `您的验证码为：${resolvedCode}\n有效期：${minutes} 分钟\n如非本人操作请忽略本邮件。`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">邮箱验证码</h2>
      <p style="margin: 0 0 8px;">您的验证码为：</p>
      <p style="margin: 0 0 12px; font-size: 20px; font-weight: 700; letter-spacing: 2px;">${resolvedCode}</p>
      <p style="margin: 0 0 6px;">有效期：${minutes} 分钟</p>
      <p style="margin: 0; color: #666;">如非本人操作请忽略本邮件。</p>
    </div>
  `

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    })
    console.log('[VerifyCode] 验证码邮件已发送', { to })
    return true
  } catch (error) {
    console.warn('[VerifyCode] 发送验证码邮件失败', error?.message || error)
    return false
  }
}
