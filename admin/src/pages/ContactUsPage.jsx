export const ContactUsPage = () => {
  return (
    <div className="min-h-screen bg-surface-light flex items-center justify-center py-16 px-4 font-sans text-left">
      <div className="w-full max-w-md">
        <div className="card-bg rounded-2xl shadow-2xl p-8 sm:p-12">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-surface-hover text-brand-primary flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">
                support_agent
              </span>
            </div>
            <h1 className="text-2xl font-light text-brand-primary tracking-tight">
              Contact Us
            </h1>
            <p className="text-status-muted font-semibold text-sm mt-2 leading-relaxed">
              Need help with the administrative portal? Reach the ROCA Living
              team using the details below.
            </p>
          </div>

          <div className="space-y-4">
            <a
              href="mailto:hello@rocaliving.co.uk"
              className="flex items-center gap-4 p-4 rounded-xl border border-card-border hover:bg-surface-hover transition-colors duration-150"
            >
              <span className="material-symbols-outlined text-brand-primary">
                mail
              </span>
              <div>
                <p className="text-2xs font-semibold text-status-muted uppercase tracking-widest">
                  Email
                </p>
                <p className="text-sm-portal font-bold text-brand-primary">
                  hello@rocaliving.co.uk
                </p>
              </div>
            </a>

            <a
              href="tel:+442071019551"
              className="flex items-center gap-4 p-4 rounded-xl border border-card-border hover:bg-surface-hover transition-colors duration-150"
            >
              <span className="material-symbols-outlined text-brand-primary">
                phone
              </span>
              <div>
                <p className="text-2xs font-semibold text-status-muted uppercase tracking-widest">
                  Phone
                </p>
                <p className="text-sm-portal font-bold text-brand-primary">
                  +44 (0)207 101 9551
                </p>
              </div>
            </a>
          </div>

          <div className="mt-10 flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-hover" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              ROCA Living Support
            </span>
            <div className="h-px flex-1 bg-surface-hover" />
          </div>
        </div>
      </div>
    </div>
  );
};
