import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// ?worker&url bundles maplibre's worker with its shared chunk into one file (plain ?url does not), without
// pulling maplibre itself into this chunk
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { AdminApp } from './AdminApp'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp workerUrl={workerUrl} />
  </StrictMode>
)
