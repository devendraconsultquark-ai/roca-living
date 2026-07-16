import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/UI/Button";
import { Input } from "../components/UI/Input";
import { ArrowRight } from "lucide-react";
import { useToast } from "../components/UI/ToastContext";
import api from "../utilities/api";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const { addToast } = useToast();

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", {
        email,
        portal: "admin",
      });
      setSuccessMessage(
        response.data?.message ||
          "A reset link has been sent if the email is registered.",
      );
      addToast("Password reset request submitted successfully!", "success");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to submit request. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-light flex items-center justify-center py-16 px-4 font-sans text-left">
      <div className="w-full max-w-md">
        <div className="card-bg rounded-[2.5rem] shadow-2xl p-8 sm:p-12">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-surface-hover text-brand-primary flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">key</span>
            </div>
            <h1 className="text-2xl font-light text-brand-primary tracking-tight">
              Forgot Password
            </h1>
            <p className="text-status-muted font-semibold text-sm mt-2 leading-relaxed">
              Enter your registered email address below. We'll send you a link
              to reset your administrative portal password.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold mb-5">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success text-xs font-semibold mb-5">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-6">
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@rocaliving.com"
              required
              leftIcon="mail"
              className="text-left font-sans"
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isLoading || !!successMessage}
              icon={ArrowRight}
              iconPosition="left"
              className="py-[16px] px-6 rounded-2xl shadow-lg uppercase tracking-widest text-xs font-bold font-sans flex items-center justify-center gap-2"
            >
              {isLoading ? "Submitting..." : "Send Reset Link"}
            </Button>

            <p className="text-center text-sm font-semibold text-gray-400 pt-2">
              Wait, I remember it!{" "}
              <Link
                to="/login"
                className="text-brand-primary font-bold hover:underline"
              >
                Back to Sign In
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
