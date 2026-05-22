import React, { createContext, useContext } from 'react';

const WorkspaceContext = createContext({ activeLibrary: 'personal' });

export function WorkspaceProvider({ activeLibrary, children }) {
  return (
    <WorkspaceContext.Provider value={{ activeLibrary }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
