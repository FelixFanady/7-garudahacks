import React, { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, HelpCircle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "success" | "info" | "warning";
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  type = "warning",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 sm:mx-0 sm:h-10 sm:w-10 shrink-0">
            <AlertCircle className="h-6 w-6" />
          </div>
        );
      case "success":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:mx-0 sm:h-10 sm:w-10 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        );
      case "info":
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:mx-0 sm:h-10 sm:w-10 shrink-0">
            <Info className="h-6 w-6" />
          </div>
        );
      case "warning":
      default:
        return (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:mx-0 sm:h-10 sm:w-10 shrink-0">
            <HelpCircle className="h-6 w-6" />
          </div>
        );
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white";
      case "info":
        return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white";
      case "warning":
      default:
        return "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />

      {/* Modal Wrapper */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close icon in top right */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
          >
            <X size={16} />
          </button>

          <div className="bg-white px-6 pb-6 pt-7 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              {getIcon()}
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 className="text-base font-semibold text-slate-900 leading-6">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-slate-500 whitespace-pre-line leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              className="inline-flex w-full sm:w-auto justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition outline-none"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`inline-flex w-full sm:w-auto justify-center rounded-xl px-4 py-2 text-sm font-semibold transition outline-none shadow-sm ${getConfirmButtonClass()}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
