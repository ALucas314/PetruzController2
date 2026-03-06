import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface DocumentNavState {
  /** Exibir setas de navegação entre documentos */
  showNav: boolean;
  /** Há documento anterior */
  canGoPrev: boolean;
  /** Há próximo documento */
  canGoNext: boolean;
  /** Ir para documento anterior */
  onPrev: () => void;
  /** Ir para próximo documento */
  onNext: () => void;
  /** Criar novo documento (limpar / novo cadastro) */
  onNewDocument: () => void;
  /** Texto opcional: "3 de 12" */
  navLabel?: string;
}

type DocumentNavStateNullable = DocumentNavState | null;

interface DocumentNavContextType {
  documentNav: DocumentNavStateNullable;
  setDocumentNav: (nav: DocumentNavStateNullable) => void;
}

const DocumentNavContext = createContext<DocumentNavContextType | undefined>(undefined);

export function DocumentNavProvider({ children }: { children: ReactNode }) {
  const [documentNav, setDocumentNav] = useState<DocumentNavStateNullable>(null);
  return (
    <DocumentNavContext.Provider value={{ documentNav, setDocumentNav }}>
      {children}
    </DocumentNavContext.Provider>
  );
}

export function useDocumentNav() {
  const context = useContext(DocumentNavContext);
  if (context === undefined) {
    throw new Error("useDocumentNav must be used within a DocumentNavProvider");
  }
  return context;
}
