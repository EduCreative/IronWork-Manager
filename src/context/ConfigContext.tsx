import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ConfigContextType {
  currencySymbol: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  themeMode: 'light' | 'dark' | 'system';
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
}

const ConfigContext = createContext<ConfigContextType>({
  currencySymbol: 'Rs.',
  companyName: 'IronWork Manager',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  themeMode: 'system',
  lightBg: '#f9fafb', // gray-50
  lightText: '#111827', // gray-900
  darkBg: '#030712', // gray-950
  darkText: '#f9fafb', // gray-50
});

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ConfigContextType>({
    currencySymbol: localStorage.getItem('global_currency_symbol') || 'Rs.',
    companyName: localStorage.getItem('global_company_name') || 'IronWork Manager',
    companyAddress: localStorage.getItem('global_company_address') || '',
    companyPhone: localStorage.getItem('global_company_phone') || '',
    companyEmail: localStorage.getItem('global_company_email') || '',
    themeMode: (localStorage.getItem('theme_mode') as any) || 'system',
    lightBg: localStorage.getItem('light_bg') || '#f9fafb',
    lightText: localStorage.getItem('light_text') || '#111827',
    darkBg: localStorage.getItem('dark_bg') || '#030712',
    darkText: localStorage.getItem('dark_text') || '#f9fafb',
  });

  useEffect(() => {
    // Real-time listener for settings
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const newSymbol = data.currencySymbol || 'Rs.';
        const newCompanyName = data.companyName || 'IronWork Manager';
        const newCompanyAddress = data.companyAddress || '';
        const newCompanyPhone = data.companyPhone || '';
        const newCompanyEmail = data.companyEmail || '';
        const newThemeMode = data.themeMode || 'system';
        const newLightBg = data.lightBg || '#f9fafb';
        const newLightText = data.lightText || '#111827';
        const newDarkBg = data.darkBg || '#030712';
        const newDarkText = data.darkText || '#f9fafb';

        setConfig({
          currencySymbol: newSymbol,
          companyName: newCompanyName,
          companyAddress: newCompanyAddress,
          companyPhone: newCompanyPhone,
          companyEmail: newCompanyEmail,
          themeMode: newThemeMode,
          lightBg: newLightBg,
          lightText: newLightText,
          darkBg: newDarkBg,
          darkText: newDarkText,
        });

        localStorage.setItem('global_currency_symbol', newSymbol);
        localStorage.setItem('global_company_name', newCompanyName);
        localStorage.setItem('global_company_address', newCompanyAddress);
        localStorage.setItem('global_company_phone', newCompanyPhone);
        localStorage.setItem('global_company_email', newCompanyEmail);
        localStorage.setItem('theme_mode', newThemeMode);
        localStorage.setItem('light_bg', newLightBg);
        localStorage.setItem('light_text', newLightText);
        localStorage.setItem('dark_bg', newDarkBg);
        localStorage.setItem('dark_text', newDarkText);
      }
    }, (error) => {
      console.error("Config onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};
