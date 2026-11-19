import { createContext, useContext } from 'react';

export const WorkspaceContext = createContext({ activeLibrary: null });

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
