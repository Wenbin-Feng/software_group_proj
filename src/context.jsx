import { createContext, useContext } from "react";
export const AppContext = createContext(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("Folio components must be within AppContext");
  return context;
}
