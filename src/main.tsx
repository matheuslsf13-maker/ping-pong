import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './lib/store'
import { aplicarTemaSalvo } from './lib/tema'
import './styles.css'

aplicarTemaSalvo()

// service worker: instalavel no celular e abre mesmo sem sinal
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${__VERSAO__}`, { scope: import.meta.env.BASE_URL })
  })
}

clearTimeout((window as unknown as { __bootTimer?: number }).__bootTimer)
document.getElementById('boot')?.remove()

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)
