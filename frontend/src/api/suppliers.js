import apiClient from './client'

export const getSuppliers = (params = {}) =>
  apiClient.get('/suppliers/', { params })

export const getSupplierById = (supplierId) =>
  apiClient.get(`/suppliers/${supplierId}`)

export const getHighRiskSuppliers = (params = {}) =>
  apiClient.get('/suppliers/high-risk', { params })

export const searchSuppliers = (q, params = {}) =>
  apiClient.get('/suppliers/search', { params: { q, ...params } })
