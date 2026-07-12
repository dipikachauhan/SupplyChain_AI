import apiClient from './client'

export const getRiskScores = (params = {}) =>
  apiClient.get('/risk/', { params })

export const getRiskById = (riskId) =>
  apiClient.get(`/risk/${riskId}`)

export const getRiskSummary = () =>
  apiClient.get('/risk/summary')
