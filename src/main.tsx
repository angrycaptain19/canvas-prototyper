import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import 'tldraw/tldraw.css'
// Side-effect: load saved theme tokens + apply to document on boot.
import '@/lib/theme/themeStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
