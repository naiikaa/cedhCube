import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'default' | 'gruvbox' | 'dracula' | 'nord' | 'onedark' | 'monokai' | 'asimov';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'default', setTheme: () => {} });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('cedhcube-theme') as Theme) || 'default';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('cedhcube-theme', t);
  };

  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
  { value: 'onedark', label: 'One Dark' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'asimov', label: 'Asimov' },
];

export const DECK_COLOR_PRESETS = [
  '#e94560','#4ecdc4','#ffe66d','#a8dadc','#f4a261',
  '#9b5de5','#00bbf9','#00f5d4','#fee440','#f15bb5',
  '#8338ec','#3a86ff','#ff006e','#fb5607','#80b918',
];