'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface FilterState {
  activeFilters: Record<string, string>;
  setFilter: (column: string, value: string) => void;
  clearFilter: (column: string) => void;
  clearAll: () => void;
}

const FilterContext = createContext<FilterState>({
  activeFilters: {},
  setFilter: () => {},
  clearFilter: () => {},
  clearAll: () => {},
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const setFilter = (col: string, val: string) => {
    setActiveFilters(prev =>
      prev[col] === val
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== col))
        : { ...prev, [col]: val }
    );
  };

  const clearFilter = (col: string) => {
    setActiveFilters(prev =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== col))
    );
  };

  const clearAll = () => setActiveFilters({});

  return (
    <FilterContext.Provider value={{ activeFilters, setFilter, clearFilter, clearAll }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
