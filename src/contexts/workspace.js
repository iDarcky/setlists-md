import { createContext, useContext } from 'react';

export const WorkspaceContext = createContext({ activeLibrary: 'personal' });

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
