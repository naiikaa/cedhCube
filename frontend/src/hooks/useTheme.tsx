import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'default' | 'gruvbox' | 'dracula' | 'nord' | 'onedark' | 'monokai' | 'asimov';

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

/** `swatch` mirrors each theme's [surface, accent, commander] vars for the picker preview. */
export const THEMES: { value: Theme; label: string; swatch: [string, string, string] }[] = [
  { value: 'default', label: 'Default', swatch: ['#16162a', '#e94560', '#ffe66d'] },
  { value: 'gruvbox', label: 'Gruvbox', swatch: ['#242422', '#fb4934', '#fabd2f'] },
  { value: 'dracula', label: 'Dracula', swatch: ['#262738', '#ff79c6', '#f1fa8c'] },
  { value: 'nord', label: 'Nord', swatch: ['#2d3342', '#88c0d0', '#ebcb8b'] },
  { value: 'onedark', label: 'One Dark', swatch: ['#2a2d36', '#e06c75', '#e5c07b'] },
  { value: 'monokai', label: 'Monokai', swatch: ['#262722', '#f92672', '#e6db74'] },
  { value: 'asimov', label: 'Asimov', swatch: ['#101010', '#ff8c00', '#ff8c00'] },
];

export const DECK_COLOR_PRESETS = [
  '#e94560','#4ecdc4','#ffe66d','#a8dadc','#f4a261',
  '#9b5de5','#00bbf9','#00f5d4','#fee440','#f15bb5',
  '#8338ec','#3a86ff','#ff006e','#fb5607','#80b918',
];