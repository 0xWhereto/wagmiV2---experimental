"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextType {
  darkTheme: boolean;
  setDarkTheme: (value: boolean) => void;
  iconsFilter: boolean;
  setIconsFilter: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [darkTheme, setDarkTheme] = useState(true);
  const [iconsFilter, setIconsFilter] = useState(true);

  // Apply theme class to document
  useEffect(() => {
    if (darkTheme) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [darkTheme]);

  // Apply icons filter class to document
  useEffect(() => {
    if (iconsFilter) {
      document.documentElement.classList.add('icons-grayscale');
    } else {
      document.documentElement.classList.remove('icons-grayscale');
    }
  }, [iconsFilter]);

  return (
    <SettingsContext.Provider value={{ darkTheme, setDarkTheme, iconsFilter, setIconsFilter }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

