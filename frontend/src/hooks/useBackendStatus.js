import { useEffect, useState } from 'react'
import apiClient from '../api/client'

export function useBackendStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let mounted = true

    apiClient
      .get('/')
      .then(() => {
        if (mounted) setStatus('online')
      })
      .catch(() => {
        if (mounted) setStatus('offline')
      })

    return () => {
      mounted = false
    }
  }, [])

  return status
}
