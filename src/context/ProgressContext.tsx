import React, { createContext, useContext, useState } from 'react';

interface ProgressContextType {
  progress: number | null; // 0-100 or null if inactive
  message: string;
  showProgress: (message: string, initialValue?: number) => void;
  updateProgress: (progress: number, message?: string) => void;
  hideProgress: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const showProgress = (msg: string, initialValue: number = 0) => {
    setMessage(msg);
    setProgress(initialValue);
  };

  const updateProgress = (p: number, msg?: string) => {
    setProgress(p);
    if (msg) setMessage(msg);
  };

  const hideProgress = () => {
    setProgress(null);
    setMessage('');
  };

  return (
    <ProgressContext.Provider value={{ progress, message, showProgress, updateProgress, hideProgress }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};
