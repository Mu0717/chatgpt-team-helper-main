import {
  BarChart3,
  CreditCard,
  Coins,
  Recycle,
  Gift,
  ShoppingCart,
  User,
  Users,
  Shield,
  Menu,
  Ticket,
  Package,
  Train,
  Settings
} from 'lucide-vue-next'

export interface AdminMenuNode {
  key: string
  label: string
  path: string
  icon: any
  children?: AdminMenuNode[]
}

export type FeatureFlagsLike = {
  xhs?: boolean
  xianyu?: boolean
  payment?: boolean
  openAccounts?: boolean
}

type AdminMenuDraftNode = {
  key: string
  label: string
  path: string
  children?: AdminMenuDraftNode[]
}

const DEFAULT_ICON = Settings

const ICONS_BY_MENU_KEY: Record<string, any> = {
  user_info: User,
  my_orders: ShoppingCart,
  points_exchange: Gift,
  accounts: Users,
  account_recovery: Recycle,
  stats: BarChart3,
  user_management: User,
  redemption_codes: Ticket,
  xhs_orders: Package,
  xianyu_orders: Package,
  purchase_orders: CreditCard,
  credit_orders: Coins,
  order_management: ShoppingCart,
  waiting_room: Train,
  settings: Settings,
  permission_management: Shield,
  role_management: Users,
  menu_management: Menu,
}

const FALLBACK_ADMIN_MENU_TREE: AdminMenuDraftNode[] = [
  { key: 'stats', path: '/admin/stats', label: '数据统计' },
  { key: 'user_info', path: '/admin/user-info', label: '用户信息' },
  { key: 'accounts', path: '/admin/accounts', label: '账号管理' },
  { key: 'redemption_codes', path: '/admin/redemption-codes', label: '兑换码管理' },
  {
    key: 'order_management',
    path: '',
    label: '订单管理',
    children: [
      { key: 'purchase_orders', path: '/admin/purchase-orders', label: '支付订单' },
      { key: 'xhs_orders', path: '/admin/xhs-orders', label: '小红书订单' },
      { key: 'xianyu_orders', path: '/admin/xianyu-orders', label: '闲鱼订单' },
      { key: 'credit_orders', path: '/admin/credit-orders', label: 'Credit 订单' },
      { key: 'account_recovery', path: '/admin/account-recovery', label: '补号管理' },
    ],
  },
  {
    key: 'permission_management',
    path: '',
    label: '权限管理',
    children: [
      { key: 'user_management', path: '/admin/users', label: '用户管理' },
      { key: 'role_management', path: '/admin/roles', label: '角色管理' },
      { key: 'menu_management', path: '/admin/menus', label: '菜单管理' },
    ],
  },
  { key: 'settings', path: '/admin/settings', label: '系统设置' },
  { key: 'my_orders', path: '/admin/my-orders', label: '我的订单' },
  { key: 'points_exchange', path: '/admin/points-exchange', label: '积分兑换' },
  { key: 'waiting_room', path: '/admin/waiting-room', label: '候车室管理' },
]

const withIcons = (tree: any[]): AdminMenuNode[] => {
  const normalize = (node: any): AdminMenuNode | null => {
    const key = String(node?.menuKey ?? node?.key ?? '').trim()
    if (!key) return null
    const children = Array.isArray(node?.children) ? node.children.map(normalize).filter(Boolean) : []
    return {
      key,
      label: String(node?.label ?? '').trim(),
      path: String(node?.path ?? ''),
      icon: ICONS_BY_MENU_KEY[key] || DEFAULT_ICON,
      children: children.length ? children : undefined,
    }
  }

  return (tree || []).map(normalize).filter(Boolean) as AdminMenuNode[]
}

export const getFallbackAdminMenuTree = (menuKeys?: string[] | null, roleKeys?: string[] | null) => {
  const roles = new Set((roleKeys || []).map(String))
  const isSuperAdmin = roles.has('super_admin')

  const allowed = new Set((menuKeys || []).map(String))
  if (!isSuperAdmin) {
    allowed.add('user_info')
    allowed.add('my_orders')
    allowed.delete('stats')
  }

  const filterTree = (nodes: AdminMenuDraftNode[]): AdminMenuDraftNode[] => {
    return nodes
      .map(node => {
        const children = Array.isArray(node.children) ? filterTree(node.children) : []
        const keep = allowed.has(node.key) || children.length > 0
        if (!keep) return null
        return {
          ...node,
          children: children.length ? children : undefined,
        }
      })
      .filter(Boolean) as AdminMenuDraftNode[]
  }

  return withIcons(filterTree(FALLBACK_ADMIN_MENU_TREE))
}

export const normalizeAdminMenuTree = (tree: any[] | null | undefined): AdminMenuNode[] => {
  if (!Array.isArray(tree)) return []
  return withIcons(tree)
}

export const filterAdminMenuTreeByFeatureFlags = (tree: AdminMenuNode[], features?: FeatureFlagsLike) => {
  const flags = features && typeof features === 'object' ? features : {}
  const enabled = (key: keyof FeatureFlagsLike) => {
    const value = flags[key]
    return value === undefined ? true : Boolean(value)
  }

  const featureByMenuKey: Record<string, keyof FeatureFlagsLike> = {
    xhs_orders: 'xhs',
    xianyu_orders: 'xianyu',
    purchase_orders: 'payment',
    credit_orders: 'openAccounts'
  }

  const filterNodes = (nodes: AdminMenuNode[]): AdminMenuNode[] => {
    return (nodes || [])
      .map((node) => {
        const featureKey = featureByMenuKey[node.key]
        if (featureKey && !enabled(featureKey)) {
          return null
        }
        const children = node.children?.length ? filterNodes(node.children) : undefined
        if (children && children.length === 0) {
          return { ...node, children: undefined }
        }
        if (!node.path && (!children || children.length === 0)) {
          return null
        }
        return { ...node, ...(children && children.length ? { children } : { children: undefined }) }
      })
      .filter(Boolean) as AdminMenuNode[]
  }

  return filterNodes(tree || [])
}

export const getDefaultAdminPath = (_menuKeys?: string[] | null, roleKeys?: string[] | null) => {
  const roles = new Set((roleKeys || []).map(String))
  return roles.has('super_admin') ? '/admin/accounts' : '/admin/user-info'
}
