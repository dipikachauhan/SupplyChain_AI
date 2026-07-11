import apiClient from './client'

export const getLogistics = (params = {}) =>
  apiClient.get('/logistics/', { params })
