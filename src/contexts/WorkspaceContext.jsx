import React from 'react';
import { WorkspaceContext } from './workspace';

export function WorkspaceProvider({ activeLibrary, children }) {
  return (
    <WorkspaceContext.Provider value={{ activeLibrary }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
