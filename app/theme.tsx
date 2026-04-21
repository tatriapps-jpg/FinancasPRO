import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = '@financaspro:tema';

export type Colors = {
  bg: string;
  card: string;
  input: string;
  border: string;
  borderSoft: string;
  borderLight: string;
  text: string;
  textSec: string;
  textMuted: string;
  barTrack: string;
  barTrack2: string;
};

export const dark: Colors = {
  bg: '#12151e',
  card: '#1c2133',
  input: '#2a3148',
  border: 'rgba(255,255,255,0.18)',
  borderSoft: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.06)',
  text: '#f0f3ff',
  textSec: '#aab4d0',
  textMuted: '#6b779a',
  barTrack: '#344060',
  barTrack2: '#2a3148',
};

export const light: Colors = {
  bg: '#f4f6fb',
  card: '#ffffff',
  input: '#eaecf4',
  border: 'rgba(0,0,0,0.12)',
  borderSoft: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.06)',
  text: '#1a2035',
  textSec: '#4a5570',
  textMuted: '#8896aa',
  barTrack: '#d1d5db',
  barTrack2: '#e2e8f0',
};

type ThemeCtx = {
  isDark: boolean;
  colors: Colors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeCtx>({
  isDark: true,
  colors: dark,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === 'light') setIsDark(false);
    });
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? dark : light, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
