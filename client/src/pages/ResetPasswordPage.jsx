import React from "react";
import { Input } from "../components/UI/Input";
import { Button } from "../components/UI/Button";
import { Logo } from "../components/UI/Logo";
import { useResetPassword } from "../hooks/useResetPassword";

export const ResetPasswordPage = () => {
  const {
    token,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    successMessage,
    error,
    handleResetPassword,
    navigate,
  } = useResetPassword();

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md card-bg rounded-2xl shadow-xl border border-border-color overflow-hidden">
        {/* Navy Header using brand-primary */}
        <div className="bg-brand-primary/80 text-white p-8 text-center flex flex-col items-center gap-2">
          <Logo useLogoPng={true} />
          <p className="text-xs text-white/70 mt-1">Landlord Partner Portal</p>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleResetPassword}
          className="p-8 flex flex-col gap-5"
        >
          <h3 className="text-lg font-bold text-text-primary">
            Reset Password
          </h3>

          <p className="text-xs text-status-muted leading-relaxed">
            Please enter your new password below.
          </p>

          {!token && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              Warning: Reset token is missing from the link.
            </div>
          )}

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success text-xs font-semibold">
              {successMessage} Redirecting to login...
            </div>
          )}

          <Input
            label="New Password"
            id="password"
            type="password"
            required
            placeholder="Min. 8 chars, 1 uppercase, 1 lowercase, 1 special char"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
          />

          <Input
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading || !!successMessage || !token}
            className="mt-2"
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>

          <div className="text-center mt-2 flex flex-col gap-2">
            <span
              onClick={() => navigate("/login")}
              className="text-xs text-brand-accent hover:underline font-bold cursor-pointer"
            >
              Back to Sign In
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
