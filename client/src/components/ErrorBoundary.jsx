import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './UI/Button';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans text-left">
          <div className="w-full max-w-md bg-white rounded-2xl border border-border-color p-8 shadow-xl flex flex-col gap-6">
            <div className="flex items-center gap-3 text-status-danger border-b border-border-color pb-4">
              <AlertTriangle size={24} />
              <h1 className="text-lg font-bold">Something went wrong</h1>
            </div>
            
            <p className="text-sm text-gray-600 leading-relaxed">
              An unexpected application error occurred. You can try refreshing the page or navigating back to safety.
            </p>

            {this.state.error?.message && (
              <div className="p-3 bg-gray-50 border border-border-color/60 rounded-lg font-mono text-[10px] text-gray-500 overflow-x-auto whitespace-pre">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                Go to Homepage
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
