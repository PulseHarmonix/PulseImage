import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from './api'
import type { AppSettings, Asset, RelayStatus, TtsEngine } from '../types'

export const queryKeys = {
  history: ['history'] as const,
  settings: ['settings'] as const,
  ttsEngines: ['tts', 'engines'] as const,
  comfyStatus: ['comfy', 'status'] as const,
  ollamaStatus: ['ollama', 'status'] as const,
  songCapabilities: ['songs', 'capabilities'] as const,
  capabilities: ['comfy', 'capabilities'] as const,
}

export function useHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: () => apiGet<Asset[]>('/history'),
    staleTime: 10_000,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiGet<AppSettings>('/settings'),
    staleTime: 30_000,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return async (updates: Partial<AppSettings>) => {
    const result = await apiPost<{ success?: boolean; settings?: AppSettings }>('/settings', updates)
    if (result.settings) queryClient.setQueryData(queryKeys.settings, result.settings)
    else queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    return result
  }
}

export function useTtsEngines() {
  return useQuery({
    queryKey: queryKeys.ttsEngines,
    queryFn: async () => {
      const response = await apiGet<{ engines?: TtsEngine[] }>('/tts/engines')
      return response.engines ?? []
    },
    staleTime: 60_000,
  })
}

export function useComfyStatus() {
  return useQuery({
    queryKey: queryKeys.comfyStatus,
    queryFn: () => apiGet<{ connected: boolean; url?: string }>('/comfy/status'),
    refetchInterval: 20_000,
  })
}

export function useOllamaStatus() {
  return useQuery({
    queryKey: queryKeys.ollamaStatus,
    queryFn: () =>
      apiGet<{ connected: boolean; url?: string; model?: string; timeout?: number }>(
        '/ollama/status',
      ),
    refetchInterval: 20_000,
  })
}

export function useSongCapabilities() {
  return useQuery({
    queryKey: queryKeys.songCapabilities,
    queryFn: () =>
      apiGet<{
        available: boolean
        cover_available: boolean
        comfy_connected: boolean
        comfy_url: string
        node_installed: boolean
        missing: string[]
      }>('/songs/capabilities'),
    refetchInterval: 30_000,
  })
}

export function useRelayCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: async () => {
      const response = await apiGet<{ relayvsr?: RelayStatus; video_upscale?: string }>(
        '/comfy/capabilities',
      )
      return response
    },
    staleTime: 20_000,
  })
}
