import apiClient from './client'

export const getRiskScores = (params = {}) =>
  apiClient.get('/risk/', { params })
