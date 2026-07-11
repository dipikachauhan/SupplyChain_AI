import apiClient from './client'

export const getProducts = (params = {}) =>
  apiClient.get('/products/', { params })

export const getProductById = (productId) =>
  apiClient.get(`/products/${productId}`)

export const getProductsSummary = () =>
  apiClient.get('/products/summary')
