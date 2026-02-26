import { getDatabase } from '../database/init.js'
import { userHasMenuKey, userHasRoleKey } from '../services/rbac.js'

export function requireSuperAdmin(req, res, next) {
  const handler = async () => {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Access denied. No user provided.' })
    }

    const db = await getDatabase()
    const isSuperAdmin = await userHasRoleKey(userId, 'super_admin', db)
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    next()
  }

  handler().catch((error) => {
    console.error('RBAC error:', error)
    res.status(500).json({ error: 'Internal server error' })
  })
}

export function requireMenu(menuKey) {
  return (req, res, next) => {
    const handler = async () => {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Access denied. No user provided.' })
      }

      const db = await getDatabase()
      const isSuperAdmin = await userHasRoleKey(userId, 'super_admin', db)
      if (isSuperAdmin) {
        return next()
      }

      const allowed = await userHasMenuKey(userId, menuKey, db)
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      next()
    }

    handler().catch((error) => {
      console.error('RBAC error:', error)
      res.status(500).json({ error: 'Internal server error' })
    })
  }
}

