import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "./Button";

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [modalConfig, setModalConfig] = useState(null);

  const confirm = useCallback((config) => {
    return new Promise((resolve) => {
      setModalConfig({
        ...config,
        resolve,
      });
    });
  }, []);

  const handleClose = (value) => {
    if (modalConfig?.resolve) {
      modalConfig.resolve(value);
    }
    setModalConfig(null);
  };

  const isOpen = !!modalConfig;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleClose(false)}
              className="absolute inset-0 bg-overlay backdrop-blur-sm"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="card-bg rounded-2xl border border-border-color shadow-2xl p-6 w-full max-w-md relative z-10 flex flex-col gap-5 mx-4"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl shrink-0 ${
                    modalConfig.variant === "danger"
                      ? "bg-status-danger/10 text-status-danger"
                      : "bg-brand-primary/10 text-brand-primary"
                  }`}
                >
                  {modalConfig.variant === "danger" ? (
                    <AlertTriangle size={24} />
                  ) : (
                    <HelpCircle size={24} />
                  )}
                </div>
                <div className="flex flex-col gap-1.5 text-left font-sans">
                  <h3 className="text-lg font-bold text-text-primary leading-tight">
                    {modalConfig.title || "Confirm Action"}
                  </h3>
                  <p className="text-sm text-status-muted leading-relaxed">
                    {modalConfig.message || "Are you sure you want to proceed?"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleClose(false)}
                >
                  {modalConfig.cancelText || "Cancel"}
                </Button>
                <Button
                  variant={
                    modalConfig.variant === "danger" ? "danger" : "primary"
                  }
                  size="md"
                  onClick={() => handleClose(true)}
                >
                  {modalConfig.confirmText || "Confirm"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
