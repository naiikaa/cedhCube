import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'paper' | 'ink' | 'blueprint';

const STORAGE_KEY = 'cedhcube-theme';
const DEFAULT_THEME: Theme = 'paper';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: DEFAULT_THEME, setTheme: () => {} });

/** `swatch` mirrors each theme's [bg, accent, text] vars for the picker preview. */
export const THEMES: { value: Theme; label: string; swatch: [string, string, string] }[] = [
  { value: 'paper', label: 'Paper', swatch: ['#F4F1EA', '#FF3A00', '#171412'] },
  { value: 'ink', label: 'Ink', swatch: ['#111113', '#FF3A00', '#ECE7DE'] },
  { value: 'blueprint', label: 'Blueprint', swatch: ['#0B1A33', '#FFD23F', '#DCE7FF'] },
];

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Stored values from the retired 10-theme system fall back to the default.
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.some(t => t.value === stored) ? (stored as Theme) : DEFAULT_THEME;
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
