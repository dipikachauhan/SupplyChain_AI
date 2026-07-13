import apiClient from './client'

export const generateAIRecommendation = (filters = {}) => apiClient.post('/recommendations/generate', filters, { timeout: 45000 })
