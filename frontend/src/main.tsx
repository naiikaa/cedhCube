import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Authentic MTG mana symbols + type (Archivo display, IBM Plex Mono data).
// Loaded after the design system so the webfont rules are not clobbered by
// Tailwind's preflight reset.
import 'mana-font/css/mana.css'
import '@fontsource-variable/archivo/index.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import { ThemeProvider } from './hooks/useTheme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
