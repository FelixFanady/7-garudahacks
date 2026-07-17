/**
 * Global toast helper — allows axios interceptors (outside React) to show toasts.
 * The ToastProvider sets these callbacks on mount.
 */

type ShowFn = (message: string, duration?: number) => string;
type DismissFn = (id: string) => void;

let _showError: ShowFn | null = null;
let _showSuccess: ShowFn | null = null;
let _showLoading: ((msg?: string) => string) | null = null;
let _dismiss: DismissFn | null = null;

export const registerGlobalToast = (fns: {
  showError: ShowFn;
  showSuccess: ShowFn;
  showLoading: (msg?: string) => string;
  dismiss: DismissFn;
}) => {
  _showError = fns.showError;
  _showSuccess = fns.showSuccess;
  _showLoading = fns.showLoading;
  _dismiss = fns.dismiss;
};

export const globalToast = {
  error: (msg: string, duration?: number) => _showError?.(msg, duration) ?? "",
  success: (msg: string, duration?: number) => _showSuccess?.(msg, duration) ?? "",
  loading: (msg?: string) => _showLoading?.(msg) ?? "",
  dismiss: (id: string) => _dismiss?.(id),
};
