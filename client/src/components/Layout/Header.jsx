import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../UI/ToastContext'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { addToast } = useToast()

  const isLoginPage = location.pathname.toLowerCase() === '/login' || location.pathname.toLowerCase() === '/login/'
  const isScrolled = scrolled || isLoginPage

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true)
      } else {
        setScrolled(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'About', path: '/about-us' },
    { name: 'Services', path: '/services' },
    { name: "FAQ's", path: '/faq' },
  ]

  const isActive = (path) => {
    return location.pathname === path
  }

  const handleLogout = () => {
    logout()
    addToast('Logged out successfully', 'info')
    navigate('/login')
  }

  return (
    <>
      <header className={`fixed top-0 left-0 z-50 w-full transition-all duration-500 py-1.5 ${
        isScrolled ? 'bg-white shadow-md border-b border-slate-100' : 'bg-transparent border-b border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-32 relative overflow-hidden">
                  <img 
                    src={`${import.meta.env.BASE_URL}images/logo.png`} 
                    className={`h-full object-contain transition-all duration-300 ${isScrolled ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'}`} 
                    alt="Roca Logo" 
                  />
                  <img 
                    src={`${import.meta.env.BASE_URL}images/logo-black.png`} 
                    className={`h-full object-contain transition-all duration-300 absolute inset-0 ${isScrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`} 
                    alt="Roca Logo Black" 
                  />
                </div>
              </Link>
            </div>

            <nav className="hidden lg:flex items-center space-x-8">
              {!user && navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{fontSize: '15px', fontWeight: '300'}}
                  className={`transition-all duration-300 relative py-1 ${
                    isScrolled ? 'text-slate-900 hover:text-primary' : 'text-white hover:text-white/80'
                  }`}
                >
                  {link.name}
                  {isActive(link.path) && (
                    <span className={`absolute bottom-0 left-0 w-full h-0.5 transition-colors ${
                      isScrolled ? 'bg-primary' : 'bg-white'
                    }`}></span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <Link to='/dashboard' className={`flex relative overflow-hidden group bg-black/80 text-white border border-black hover:opacity-90 text-base items-center justify-center transition-all duration-300 py-2 px-8 rounded-card shadow-lg shadow-black/20`}>
                  <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                  <span className="relative z-10 flex" style={{fontSize: '15px', fontWeight: '300'}}>Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link 
                    to='/contact' 
                    className={`hidden md:flex relative overflow-hidden group text-base items-center justify-center transition-all duration-300 py-2 px-6 rounded-card border ${
                      isScrolled 
                        ? 'border-[#1A1A1A] text-[#1A1A1A] hover:bg-gray-50' 
                        : 'border-white/60 text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                    <span className="relative z-10 flex" style={{fontSize: '15px', fontWeight: '300'}}>Contact</span>
                  </Link>
                  <Link 
                    to='/login' 
                    className={`hidden md:flex relative overflow-hidden group text-base items-center justify-center transition-all duration-300 py-2 px-6 rounded-card border ${
                      isScrolled 
                        ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white hover:bg-[#2D2D2D]' 
                        : 'bg-white border-white text-black hover:bg-slate-100'
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out" />
                    <span className="relative z-10 flex" style={{fontSize: '15px', fontWeight: '300'}}>Login</span>
                  </Link>
                </>
              )}
            
              <button
                onClick={() => setIsMenuOpen(true)}
                className={`lg:hidden p-2 transition-colors ${isScrolled ? 'text-slate-900' : 'text-white'}`}
                aria-label="Open menu"
              >
                <span className="material-symbols-outlined text-3xl">menu</span>
              </button>
            </div>
          </div>
        </div>
      </header>


      {/* Mobile Menu Drawer */}
      <div 
        className={`fixed inset-0 z-[100] transition-all duration-300 ${
          isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          onClick={() => setIsMenuOpen(false)}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        ></div>
        <div
          className={`absolute right-0 top-0 h-full w-[300px] bg-white shadow-2xl transform transition-transform duration-500 ease-out ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-8 flex flex-col h-full">
            <div className="flex items-center justify-between mb-12">
              <Link to="/" onClick={() => setIsMenuOpen(false)}>
                <img src={`${import.meta.env.BASE_URL}images/logo-black.png`} className="w-36" alt="Roca Logo" />
              </Link>
              <button 
                onClick={() => setIsMenuOpen(false)} 
                className="text-slate-900 p-2 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-3xl">close</span>
              </button>
            </div>
            <nav className="flex flex-col space-y-6">
              {!user && navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-2xl font-light hover:text-primary transition-colors py-2 border-b border-transparent ${
                    isActive(link.path) ? 'text-primary' : 'text-slate-600'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {user && (
                <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="text-2xl font-light hover:text-primary transition-colors py-2">Dashboard</Link>
              )}
            </nav>
            <div className="mt-4 pt-8 border-t border-slate-100">
              <div className="flex flex-col gap-4 mb-8">
                {user ? (
                   <>
                    <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="bg-primary text-white text-center py-3 rounded text-lg font-semibold hover:bg-primary/90 transition-colors">
                      My Dashboard
                    </Link>
                    <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="bg-slate-100 text-slate-600 text-center py-3 rounded text-lg font-semibold hover:bg-slate-200 transition-colors">
                      Logout
                    </button>
                   </>
                ) : (
                  <>
                    <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="bg-black text-white text-center py-3 rounded text-lg font-light hover:bg-slate-900 transition-colors">
                      Contact Us
                    </Link>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)} className="bg-black text-white text-center py-3 rounded text-lg font-light hover:bg-slate-900 transition-colors">
                      Login
                    </Link>
                  </>
                )}
              </div>
              <p className="text-xs font-light text-slate-400 uppercase mb-6">Contact us</p>
              <a href="mailto:info@rocaliving.co.uk" className="group text-base font-medium flex items-center gap-3 mb-4 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">mail</span>
                info@rocaliving.co.uk
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
