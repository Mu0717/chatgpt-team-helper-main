import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_ROOT = path.resolve(__dirname, '../..')
const DEFAULT_DB_PATH = process.env.DATABASE_PATH || path.join(BACKEND_ROOT, 'db', 'database.sqlite')
const PYTHON_SYNC_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'xhs_order_sync.py')
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'

const clampMaxScrolls = (value) => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 40
  return Math.min(Math.max(parsed, 5), 200)
}

const clampScrollPause = (value) => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 3
  return Math.min(Math.max(parsed, 1), 10)
}

let isSyncing = false

const runPythonSync = (args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(error)
    })

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `同步脚本退出码 ${code}`))
      }

      try {
        const parsed = JSON.parse(stdout || '{}')
        resolve(parsed)
      } catch (error) {
        reject(new Error(`同步脚本返回格式异常: ${error.message}`))
      }
    })
  })
}

export const isXhsSyncing = () => isSyncing

export const setXhsSyncing = (value) => {
  isSyncing = Boolean(value)
}

export const runXhsOrderSync = async ({ searchOrder = null, maxScrolls = 40, scrollPause = 3 } = {}) => {
  if (isSyncing) {
    const error = new Error('同步任务正在运行，请稍后再试')
    error.code = 'XHS_SYNC_IN_PROGRESS'
    throw error
  }

  isSyncing = true
  try {
    const normalizedScrolls = clampMaxScrolls(maxScrolls)
    const normalizedPause = clampScrollPause(scrollPause)

    const args = [
      PYTHON_SYNC_SCRIPT,
      '--db',
      DEFAULT_DB_PATH,
      '--max-scrolls',
      String(normalizedScrolls),
      '--scroll-pause',
      String(normalizedPause)
    ]

    if (searchOrder) {
      args.push('--search-order', searchOrder)
    }

    const result = await runPythonSync(args)
    return result
  } finally {
    isSyncing = false
  }
}
