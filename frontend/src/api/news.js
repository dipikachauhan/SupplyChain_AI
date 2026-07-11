import apiClient from './client'

export const getNews = (params = {}) => apiClient.get('/news/', { params })
