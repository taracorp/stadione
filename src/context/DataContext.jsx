import React, { createContext, useContext } from 'react';

const DataContext = createContext(null);

export const DataProvider = ({ children, data }) => {
  return (
    <DataContext.Provider value={data}>
      {children}
    </DataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within DataProvider');
  }
  return context;
};
