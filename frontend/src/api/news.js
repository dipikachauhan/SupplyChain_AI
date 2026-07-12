import apiClient from './client'

export const getNews = (params = {}) => apiClient.get('/news/', { params })
export const getNewsById = (id) => apiClient.get(`/news/${id}`)
export const getNewsSummary = () => apiClient.get('/news/summary')
export const getNewsByCategory = (category, params = {}) => apiClient.get(`/news/category/${encodeURIComponent(category)}`, { params })
