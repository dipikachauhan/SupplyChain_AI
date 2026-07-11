import apiClient from './client'

export const getInventory = (params = {}) =>
  apiClient.get('/inventory/', { params })

export const getInventoryItemById = (itemId) =>
  apiClient.get(`/inventory/${itemId}`)

export const getInventorySummary = () =>
  apiClient.get('/inventory/summary')
