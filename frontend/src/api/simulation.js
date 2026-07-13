import apiClient from './client'

export const runSimulation = (scenario) => apiClient.post('/simulation/run', scenario)
