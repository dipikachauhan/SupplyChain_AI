import { useCallback, useEffect, useState } from 'react'

export function useApi(fetchFn, dependencies = [], options = {}) {
  const { immediate = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetchFn()
      const payload =
        response &&
        typeof response === 'object' &&
        'data' in response
          ? response.data
          : response

      setData(payload)
      return payload
    } catch (err) {
      setError(err.message || 'Failed to load data')
      setData(null)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    if (!immediate) return

    execute().catch(() => {})
  }, [execute, immediate, ...dependencies])

  return {
    data,
    loading,
    error,
    refetch: execute,
  }
}
