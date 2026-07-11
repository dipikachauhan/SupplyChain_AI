import apiClient from './client'

export const getProducts = (params = {}) =>
  apiClient.get('/products/', { params })
