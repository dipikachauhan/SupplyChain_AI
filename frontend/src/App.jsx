import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import {
  AIRecommendations,
  Dashboard,
  Inventory,
  NewsMonitoring,
  NotFound,
  Products,
  RiskAnalysis,
  Simulation,
  Suppliers,
  SupplyChainNetwork,
} from './pages'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="risk" element={<RiskAnalysis />} />
          <Route path="news" element={<NewsMonitoring />} />
          <Route path="network" element={<SupplyChainNetwork />} />
          <Route path="recommendations" element={<AIRecommendations />} />
          <Route path="simulation" element={<Simulation />} />
          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
