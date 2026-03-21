import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const MAX_NOTIFICATIONS = 40;

export type LoadNotificationItem = {
  id: string;
  at: number;
  /** Data do documento (YYYY-MM-DD) */
  dataDia: string;
  /** Número do documento na filial (OCPD.doc_numero), quando existir */
  docNumero: number | null;
  /** Ordem global do documento legado (OCPD.doc_ordem_global), quando aplicável */
  docOrdemGlobal: number | null;
  /** Quantidade de linhas/itens OCPD carregadas */
  itemCount: number;
  filialNome: string | null;
};

type LoadNotificationsContextValue = {
  notifications: LoadNotificationItem[];
  addLoadNotification: (payload: Omit<LoadNotificationItem, "id" | "at">) => void;
  clearLoadNotifications: () => void;
};

const LoadNotificationsContext = createContext<LoadNotificationsContextValue | undefined>(undefined);

export function LoadNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<LoadNotificationItem[]>([]);

  const addLoadNotification = useCallback((payload: Omit<LoadNotificationItem, "id" | "at">) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: LoadNotificationItem = { ...payload, id, at: Date.now() };
    setNotifications((prev) => [item, ...prev].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const clearLoadNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({ notifications, addLoadNotification, clearLoadNotifications }),
    [notifications, addLoadNotification, clearLoadNotifications]
  );

  return <LoadNotificationsContext.Provider value={value}>{children}</LoadNotificationsContext.Provider>;
}

export function useLoadNotifications() {
  const ctx = useContext(LoadNotificationsContext);
  if (ctx === undefined) {
    throw new Error("useLoadNotifications must be used within LoadNotificationsProvider");
  }
  return ctx;
}

export function formatLoadNotificationDocLabel(n: Pick<LoadNotificationItem, "docNumero" | "docOrdemGlobal">): string {
  if (n.docNumero != null && !Number.isNaN(n.docNumero)) {
    return `Documento nº ${n.docNumero}`;
  }
  if (n.docOrdemGlobal != null && !Number.isNaN(n.docOrdemGlobal)) {
    return `Documento (ordem ${n.docOrdemGlobal})`;
  }
  return "Documento";
}
