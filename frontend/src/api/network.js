import apiClient from './client'

export const getNetworkOverview = (params = {}) => apiClient.get('/network/overview', { params })
export const getNetworkNode = (nodeId) => apiClient.get(`/network/nodes/${encodeURIComponent(nodeId)}`)
