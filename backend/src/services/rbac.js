import { getDatabase } from '../database/init.js'

const firstColumnValues = (result) => (result?.[0]?.values || []).map(row => row[0])

export async function getUserRoleKeys(userId, db) {
  const database = db || (await getDatabase())
  const result = database.exec(
    `
      SELECT r.role_key
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.id ASC
    `,
    [userId]
  )
  return firstColumnValues(result)
}

export async function getUserMenuKeys(userId, db) {
  const database = db || (await getDatabase())
  const result = database.exec(
    `
      SELECT DISTINCT m.menu_key
      FROM user_roles ur
      JOIN role_menus rm ON rm.role_id = ur.role_id
      JOIN menus m ON m.id = rm.menu_id
      WHERE ur.user_id = ?
        AND COALESCE(m.is_active, 1) != 0
      ORDER BY m.id ASC
    `,
    [userId]
  )
  return firstColumnValues(result)
}

export async function userHasRoleKey(userId, roleKey, db) {
  const database = db || (await getDatabase())
  const result = database.exec(
    `
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND r.role_key = ?
      LIMIT 1
    `,
    [userId, roleKey]
  )
  return Boolean(result?.[0]?.values?.length)
}

export async function userHasMenuKey(userId, menuKey, db) {
  const database = db || (await getDatabase())
  const result = database.exec(
    `
      SELECT 1
      FROM user_roles ur
      JOIN role_menus rm ON rm.role_id = ur.role_id
      JOIN menus m ON m.id = rm.menu_id
      WHERE ur.user_id = ?
        AND m.menu_key = ?
        AND COALESCE(m.is_active, 1) != 0
      LIMIT 1
    `,
    [userId, menuKey]
  )
  return Boolean(result?.[0]?.values?.length)
}

const normalizeMenuRow = (row) => {
  const menuKey = String(row?.menu_key ?? row?.menuKey ?? '').trim()
  return {
    id: Number(row?.id) || 0,
    menuKey,
    label: String(row?.label ?? '').trim(),
    path: String(row?.path ?? ''),
    parentId: row?.parentId == null ? null : Number(row?.parentId),
    sortOrder: Number(row?.sortOrder) || 0,
    isActive: Number(row?.isActive ?? 1) !== 0,
  }
}

export async function listMenus(db, options = {}) {
  const database = db || (await getDatabase())
  const includeInactive = Boolean(options?.includeInactive)
  const where = includeInactive ? '' : 'WHERE COALESCE(is_active, 1) != 0'
  const result = database.exec(
    `
      SELECT id, menu_key, label, path, parent_id, sort_order, COALESCE(is_active, 1) AS is_active
      FROM menus
      ${where}
      ORDER BY COALESCE(sort_order, 0) ASC, id ASC
    `
  )
  return (result?.[0]?.values || []).map(row => {
    return normalizeMenuRow({
      id: row[0],
      menu_key: row[1],
      label: row[2],
      path: row[3],
      parentId: row[4],
      sortOrder: row[5],
      isActive: row[6],
    })
  })
}

export const buildMenuTree = (menus = []) => {
  const nodesById = new Map()
  const roots = []

  for (const menu of menus) {
    if (!menu?.id || !menu?.menuKey) continue
    nodesById.set(menu.id, { ...menu, children: [] })
  }

  for (const node of nodesById.values()) {
    const parentId = Number.isFinite(Number(node.parentId)) ? Number(node.parentId) : null
    const parent = parentId ? nodesById.get(parentId) : null
    if (parent && parent !== node) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortTree = (list) => {
    list.sort((a, b) => {
      const order = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      if (order !== 0) return order
      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })
    for (const node of list) {
      if (Array.isArray(node.children) && node.children.length) {
        sortTree(node.children)
      }
    }
  }
  sortTree(roots)

  return roots
}

export const filterMenuTreeByAllowedKeys = (tree = [], allowedKeys = new Set()) => {
  const allowed = allowedKeys instanceof Set ? allowedKeys : new Set((allowedKeys || []).map(String))
  const filterNode = (node) => {
    const children = Array.isArray(node.children) ? node.children : []
    const filteredChildren = children.map(filterNode).filter(Boolean)
    const keep = allowed.has(String(node.menuKey)) || filteredChildren.length > 0
    if (!keep) return null
    return {
      ...node,
      children: filteredChildren,
    }
  }

  return (tree || []).map(filterNode).filter(Boolean)
}

export async function getAdminMenuTreeForAccessContext(accessContext, db) {
  const database = db || (await getDatabase())
  const access = accessContext || { roles: [], menus: [], isSuperAdmin: false }
  const tree = buildMenuTree(await listMenus(database, { includeInactive: false }))

  const allowed = new Set((access.menus || []).map(String))
  if (!access.isSuperAdmin) {
    allowed.add('user_info')
    allowed.add('my_orders')
    allowed.delete('stats')
  }
  return filterMenuTreeByAllowedKeys(tree, allowed)
}

export async function getUserAccessContext(userId, db) {
  const database = db || (await getDatabase())
  const [roles, menus] = await Promise.all([
    getUserRoleKeys(userId, database),
    getUserMenuKeys(userId, database),
  ])

  return {
    roles,
    menus,
    isSuperAdmin: roles.includes('super_admin'),
  }
}
