import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Authentic MTG mana symbols + display serif. Loaded after the design system so
// the webfont rules are not clobbered by Tailwind's preflight reset.
import 'mana-font/css/mana.css'
import '@fontsource/cinzel/400.css'
import '@fontsource/cinzel/600.css'
import '@fontsource/cinzel/700.css'
import { ThemeProvider } from './hooks/useTheme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
