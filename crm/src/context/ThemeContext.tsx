'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme   = 'dark' | 'light';
export type Palette = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'sky';

interface ThemeCtx {
  theme:      Theme;
  toggle:     () => void;
  palette:    Palette;
  setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme:      'dark',
  toggle:     () => {},
  palette:    'indigo',
  setPalette: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,   setTheme]       = useState<Theme>('dark');
  const [palette, setPaletteState] = useState<Palette>('indigo');

  // Restore persisted preferences on mount
  useEffect(() => {
    const savedTheme   = localStorage.getItem('crm-theme')   as Theme   | null;
    const savedPalette = localStorage.getItem('crm-palette') as Palette | null;

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('light', savedTheme === 'light');
    }
    if (savedPalette) {
      setPaletteState(savedPalette);
      document.documentElement.setAttribute('data-palette', savedPalette);
    }
  }, []);

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('crm-theme', next);
      document.documentElement.classList.toggle('light', next === 'light');
      return next;
    });
  };

  const setPalette = (p: Palette) => {
    setPaletteState(p);
    localStorage.setItem('crm-palette', p);
    document.documentElement.setAttribute('data-palette', p);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
