import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell/AppShell'
import { StudioPage } from './pages/StudioPage'
import { LibraryPage } from './pages/LibraryPage'
import { MusicVideoPage } from './pages/MusicVideoPage'
import { FramesPage } from './pages/FramesPage'
import { MusicGeneratorPage } from './pages/MusicGeneratorPage'
import { VoicesPage } from './pages/VoicesPage'
import { ModelsPage } from './pages/ModelsPage'
import { AdminPage, SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<StudioPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="music" element={<MusicVideoPage />} />
            <Route path="songs" element={<MusicGeneratorPage />} />
            <Route path="frames" element={<FramesPage />} />
            <Route path="voices" element={<VoicesPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
