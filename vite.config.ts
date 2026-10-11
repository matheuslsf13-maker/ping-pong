import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// caminhos relativos: o mesmo build serve no endereco do GitHub Pages
// (/ping-pong/) e, no futuro, na raiz de um dominio proprio
const versao = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __VERSAO__: JSON.stringify(versao) },
})
