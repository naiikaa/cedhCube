import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Authentic MTG mana symbols + display serif. Loaded after the design system so
// the webfont rules are not clobbered by Tailwind's preflight reset.
import 'mana-font/css/mana.css'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
// Cybercore theme faces (pixel display + CRT mono). Only the cybercore
// [data-theme] block binds them, so every other theme still renders Cinzel.
import '@fontsource/press-start-2p/400.css'
import '@fontsource/vt323/400.css'
import { ThemeProvider } from './hooks/useTheme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
