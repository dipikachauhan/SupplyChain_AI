import apiClient from './client'

export const getSuppliers = (params = {}) =>
  apiClient.get('/suppliers/', { params })

export const getSupplierById = (supplierId) =>
  apiClient.get(`/suppliers/${supplierId}`)
