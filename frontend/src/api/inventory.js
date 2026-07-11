import apiClient from './client'

export const getInventory = (params = {}) =>
  apiClient.get('/inventory/', { params })
