import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './lib/store'
import { aplicarTemaSalvo } from './lib/tema'
import './styles.css'

aplicarTemaSalvo()

// service worker: instalavel no celular e abre mesmo sem sinal
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // versao nova publicada: quando o service worker novo assume, recarrega uma
  // vez -- senao o celular segue mostrando a versao velha guardada
  const tinhaControle = Boolean(navigator.serviceWorker.controller)
  let recarregou = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControle || recarregou) return
    recarregou = true
    location.reload()
  })
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${__VERSAO__}`, { scope: import.meta.env.BASE_URL })
  })
  // ao voltar para o app, procura versao nova
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void navigator.serviceWorker.getRegistration().then((r) => r?.update())
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
