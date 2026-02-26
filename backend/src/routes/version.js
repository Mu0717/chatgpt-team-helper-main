import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const VERSION_FILE_PATH = path.resolve(__dirname, '../../version.json')

const GITHUB_API_URL = 'https://api.github.com/repos/Kylsky/chatgpt-team-helper/releases/latest'

const readVersionFile = () => {
  try {
    const content = fs.readFileSync(VERSION_FILE_PATH, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[Version] 读取版本文件失败:', error)
    return { version: 'unknown' }
  }
}

router.get('/', (req, res) => {
  try {
    const versionInfo = readVersionFile()
    res.json(versionInfo)
  } catch (error) {
    console.error('[Version] 获取版本信息失败:', error)
    res.status(500).json({ error: '获取版本信息失败' })
  }
})

router.get('/latest', async (req, res) => {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'chatgpt-team-helper'
      }
    })

    if (response.status === 404) {
      return res.status(404).json({ error: '尚未发布任何版本' })
    }

    if (!response.ok) {
      console.error('[Version] GitHub API 请求失败:', response.status, response.statusText)
      return res.status(502).json({ error: '获取最新版本失败' })
    }

    const data = await response.json()

    res.json({
      version: data.tag_name?.replace(/^v/, '') || data.name || 'unknown',
      tagName: data.tag_name || null,
      name: data.name || null,
      publishedAt: data.published_at || null,
      htmlUrl: data.html_url || null,
      body: data.body || null
    })
  } catch (error) {
    console.error('[Version] 获取最新版本失败:', error)
    res.status(500).json({ error: '获取最新版本失败' })
  }
})

export default router
