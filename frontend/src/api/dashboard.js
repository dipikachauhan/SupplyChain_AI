import apiClient from './client'

export const getDashboardMetrics = () => apiClient.get('/dashboard/')
