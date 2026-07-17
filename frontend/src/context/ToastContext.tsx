import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { registerGlobalToast } from "../api/toast";

type ToastType = "loading" | "success" | "error";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showLoading: (message?: string) => string;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const generateId = () =>
    `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const dismiss = useCallback((id: string) => {
    clearTimeout(timerRef.current[id]);
    delete timerRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    Object.values(timerRef.current).forEach(clearTimeout);
    timerRef.current = {};
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration?: number): string => {
      const id = generateId();
      setToasts((prev) => [...prev, { id, type, message }]);
      if (duration && duration > 0) {
        timerRef.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const showLoading = useCallback(
    (message = "Memuat...") => addToast("loading", message),
    [addToast],
  );

  const showSuccess = useCallback(
    (message: string, duration = 4000) =>
      addToast("success", message, duration),
    [addToast],
  );

  const showError = useCallback(
    (message: string, duration = 5000) => addToast("error", message, duration),
    [addToast],
  );

  // Register callbacks so axios interceptors can call them outside React
  useEffect(() => {
    registerGlobalToast({ showError, showSuccess, showLoading, dismiss });
  }, [showError, showSuccess, showLoading, dismiss]);

  return (
    <ToastContext.Provider
      value={{ showLoading, showSuccess, showError, dismiss, dismissAll }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};

const ToastContainer = ({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const TOAST_STYLES: Record<
  ToastType,
  { wrapper: string; icon: React.ReactNode }
> = {
  loading: {
    wrapper: "bg-white border border-slate-200 text-slate-700 shadow-lg",
    icon: (
      <Loader2 size={17} className="animate-spin text-brand-600 shrink-0" />
    ),
  },
  success: {
    wrapper:
      "bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-lg",
    icon: <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />,
  },
  error: {
    wrapper: "bg-red-50 border border-red-200 text-red-800 shadow-lg",
    icon: <AlertCircle size={17} className="text-red-500 shrink-0" />,
  },
};

const ToastItem = ({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) => {
  const style = TOAST_STYLES[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium animate-toast-in ${style.wrapper}`}
      role="alert"
    >
      <span className="mt-0.5">{style.icon}</span>
      <p className="flex-1 leading-5">{toast.message}</p>
      {toast.type !== "loading" && (
        <button
          onClick={() => onDismiss(toast.id)}
          className="ml-1 mt-0.5 opacity-60 hover:opacity-100 transition shrink-0"
          aria-label="Tutup notifikasi"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
