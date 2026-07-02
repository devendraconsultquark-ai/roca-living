import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer
      className="bg-surface-light border-t border-gray-200"
      style={{ opacity: 1, transform: "none" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex items-start gap-3 group cursor-pointer">
            <Link to="/">
              <img
                className="w-32 transition-all duration-500"
                alt="Logo"
                src={`${import.meta.env.BASE_URL}images/logo-black.png`}
              />
            </Link>
          </div>
          <div>
            <h4 className="font-[200] text-gray-900 mb-4 text-xl">
              Our Services
            </h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                <Link className="hover:underline" to="/services#lettings">
                  Lettings & Tenant Management
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/services#financial">
                   Financial Management & Reporting
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/services#portfolio">
                  Property Portfolio Management
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/services#handover">
                  Pre-Completion & Handover Support
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-[200] text-gray-900 mb-4 text-xl">
              Quick Links
            </h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                <Link className="hover:underline" to="/about-us">
                  About Us
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/services">
                  Services
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/faq">
                  FAQs
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/contact">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-[200] text-gray-900 mb-4 text-xl">
              Conditions
            </h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                <Link className="hover:underline" to="/terms-and-conditions">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/disclaimer">
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link className="hover:underline" to="/privacy">
                  Privacy Notice
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-200 mt-8 pt-8">
          {/* Centered compliance links */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-gray-500 mb-5 font-semibold select-none">
            <a href="/Complaints-Procedure.pdf" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-brand-primary transition-colors">
              Complaints Procedure
            </a>
            <span className="text-gray-300">|</span>
            <a href="/Landlord-Fees.pdf" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-brand-primary transition-colors">
              Landlord Fee's
            </a>
            <span className="text-gray-300">|</span>
            <a href="/Client-Money-Protection.pdf" target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-brand-primary transition-colors">
              Client Money Protection
            </a>
          </div>

          <div className="text-2xs text-gray-400 text-center space-y-2 select-none leading-relaxed">
            <p>
              Roca Living is a trading style of Roca Property Group Limited. Company No 04914778
            </p>
            <p>© 2026 Roca Living All rights reserved</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
