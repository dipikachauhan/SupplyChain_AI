import {
  LayoutDashboard,
  Truck,
  Package,
  Warehouse,
  ShieldAlert,
  Newspaper,
  GitBranch,
  Sparkles,
  FlaskConical,
} from 'lucide-react'

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Suppliers',
    path: '/suppliers',
    icon: Truck,
  },
  {
    label: 'Products',
    path: '/products',
    icon: Package,
  },
  {
    label: 'Inventory',
    path: '/inventory',
    icon: Warehouse,
  },
  {
    label: 'Risk Analysis',
    path: '/risk',
    icon: ShieldAlert,
  },
  {
    label: 'News Monitoring',
    path: '/news',
    icon: Newspaper,
  },
  {
    label: 'Supply Chain Network',
    path: '/network',
    icon: GitBranch,
  },
  {
    label: 'AI Recommendations',
    path: '/recommendations',
    icon: Sparkles,
  },
  {
    label: 'Simulation',
    path: '/simulation',
    icon: FlaskConical,
  },
]

export const APP_NAME = 'SupplyLens AI'
export const APP_TAGLINE = 'AI-Powered Supply Chain Risk Intelligence Platform'
