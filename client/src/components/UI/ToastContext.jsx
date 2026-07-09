import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // Add a new toast to the stack
  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 5s for non-error toasts
    if (type !== "error") {
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    }
  }, []);

  // Remove a toast by id
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Listen to global 'api-error' events and trigger a toast
  useEffect(() => {
    const handleApiError = (event) => {
      if (event.detail) {
        addToast(event.detail.message, event.detail.type || "error");
      }
    };

    window.addEventListener("api-error", handleApiError);
    return () => {
      window.removeEventListener("api-error", handleApiError);
    };
  }, [addToast]);

  // Icon mapping based on design specifications
  const icons = {
    success: (
      <CheckCircle2 className="text-status-success shrink-0" size={20} />
    ),
    warning: (
      <AlertTriangle className="text-status-warning shrink-0" size={20} />
    ),
    error: <XCircle className="text-status-danger shrink-0" size={20} />,
    info: <Info className="text-brand-accent shrink-0" size={20} />,
  };

  // Color borders mapping
  const borderColors = {
    success: "border-l-4 border-status-success",
    warning: "border-l-4 border-status-warning",
    error: "border-l-4 border-status-danger",
    info: "border-l-4 border-brand-accent",
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast Portal Container at top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`
                bg-white pointer-events-auto shadow-lg rounded-r-lg p-4 flex items-start justify-between gap-3 border border-border-color/30
                ${borderColors[toast.type]}
              `}
            >
              <div className="flex gap-3 items-start">
                {icons[toast.type]}
                <p className="text-sm font-semibold text-text-primary leading-tight pt-0.5">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-text-primary transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
