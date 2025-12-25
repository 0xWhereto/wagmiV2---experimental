"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "pending" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration (except for pending toasts)
    if (toast.type !== "pending") {
      const duration = toast.duration || 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );

    // If updating to success/error, auto-remove after duration
    if (updates.type && updates.type !== "pending") {
      const duration = updates.duration || 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="10" fill="#10B981" />
        <path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    pending: (
      <div className="w-5 h-5 relative">
        <div 
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#F59E0B", borderTopColor: "transparent" }}
        />
      </div>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="10" fill="#EF4444" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="10" fill="#667EEA" />
        <path d="M10 9v4M10 6h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };

  const colors = {
    success: { bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.3)", text: "#10B981" },
    pending: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)", text: "#F59E0B" },
    error: { bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)", text: "#EF4444" },
    info: { bg: "rgba(102, 126, 234, 0.1)", border: "rgba(102, 126, 234, 0.3)", text: "#667EEA" },
  };

  const color = colors[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className="rounded-xl p-4 min-w-[300px] backdrop-blur-sm"
      style={{
        background: "rgb(240, 240, 243)",
        boxShadow: "8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff",
        border: `1px solid ${color.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" style={{ color: "#374151" }}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-xs mt-1" style={{ color: "#6B7280" }}>
              {toast.message}
            </div>
          )}
          {toast.txHash && (
            <a
              href={`https://sonicscan.org/tx/${toast.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs mt-1.5 inline-flex items-center gap-1 hover:underline"
              style={{ color: color.text }}
            >
              View transaction
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 8l4-4M4 4h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-lg transition-all hover:bg-black/5"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// Hook for transaction notifications
export function useTransactionToast() {
  const { addToast, updateToast, removeToast } = useToast();

  const pending = (title: string, message?: string) => {
    return addToast({
      type: "pending",
      title,
      message: message || "Please confirm in your wallet...",
    });
  };

  const success = (title: string, txHash?: string, message?: string) => {
    return addToast({
      type: "success",
      title,
      message: message || "Transaction confirmed",
      txHash,
    });
  };

  const error = (title: string, message?: string) => {
    return addToast({
      type: "error",
      title,
      message: message || "Something went wrong",
    });
  };

  const update = (id: string, type: ToastType, title: string, txHash?: string, message?: string) => {
    updateToast(id, { type, title, message, txHash });
  };

  return { pending, success, error, update, remove: removeToast };
}



