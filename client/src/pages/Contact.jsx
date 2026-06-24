import { useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useContact } from '../hooks/useContact'
import { Input } from '../components/UI/Input'
import { Button } from '../components/UI/Button'
import { Send } from 'lucide-react'

export default function Contact() {
  const container = useRef()
  const location = useLocation()
  const { formData, handleChange, handleSubmit, submitting, errors } = useContact();

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  const fadeInUp = {
    hidden: { y: 30, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const textareaClasses = `
    w-full text-sm font-sans bg-white border rounded-[4px] py-[10px] px-3 transition-all duration-150 focus:outline-none
    ${errors.message 
      ? 'border-status-danger text-[#1A1A1A] focus:ring-2 focus:ring-status-danger/20 focus:border-status-danger' 
      : 'border-border-color text-[#1A1A1A] focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent'}
  `;

  return (
    <div ref={container}>
      {/* Hero Section */}
      <section id="hero" className="relative min-h-[100vh] overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-contact.jpg)` }}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background-dark/70 via-background-dark/20 to-transparent"></div>
        </motion.div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div>
            <motion.p 
              className="text-3xl md:text-5xl text-white mt-30 leading-relaxed font-[100]"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              Get in touch
            </motion.p>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section id="contact-form" className="py-24">
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="mb-12" variants={fadeInUp}>
            <h2 className="text-3xl font-[200] mb-6 tracking-tight">Contact us.</h2>
          </motion.div>
          
          <motion.div
            className="border-t pt-6 mb-14"
            variants={fadeInUp}
          >
            <h3 className="font-light text-lg text-gray-900 mb-4">
              Business enquiries:
            </h3>
            <div className="space-y-4 text-gray-600">
              <p className="flex items-center gap-3">
                <span className="material-icons-outlined text-primary">email</span>
                hello@rocaem.co.uk
              </p>
              <p className="flex items-center gap-3">
                <span className="material-icons-outlined text-primary">phone</span>
                +44(0)207 101 9551
              </p>
              <p className="flex items-center gap-3">
                <span className="material-icons-outlined text-primary">place</span>
                Unit 6 Kew Bridge Plaza, 8 Kew Bridge Road, London, TW8 0FJ
              </p>
            </div>
          </motion.div>
          
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <motion.div className="space-y-6" variants={staggerContainer}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={fadeInUp}>
                  <Input
                    id="firstName"
                    name="firstName"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                    error={errors.firstName}
                  />
                </motion.div>
                
                <motion.div variants={fadeInUp}>
                  <Input
                    id="lastName"
                    name="lastName"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    error={errors.lastName}
                  />
                </motion.div>
              </div>
              
              <motion.div variants={fadeInUp}>
                <Input
                  id="company"
                  name="company"
                  placeholder="Company name (if applicable)"
                  value={formData.company}
                  onChange={handleChange}
                  error={errors.company}
                />
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div variants={fadeInUp}>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                    error={errors.email}
                  />
                </motion.div>
                
                <motion.div variants={fadeInUp}>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                  />
                </motion.div>
              </div>
              
              <motion.div variants={fadeInUp}>
                <p className="font-light text-gray-900 mb-3">Nature of enquiry:</p>
                <div className="flex flex-wrap gap-6 text-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      className="text-primary focus:ring-primary w-4 h-4 rounded"
                      type="checkbox"
                      value="Block Management"
                      checked={formData.enquiryType.includes("Block Management")}
                      onChange={handleChange}
                      name="enquiryType"
                    />
                    <span className="group-hover:text-primary transition-colors">
                      Block Management
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      className="text-primary focus:ring-primary w-4 h-4 rounded"
                      type="checkbox"
                      value="Right to Manage"
                      checked={formData.enquiryType.includes("Right to Manage")}
                      onChange={handleChange}
                      name="enquiryType"
                    />
                    <span className="group-hover:text-primary transition-colors">
                      Right to Manage
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      className="text-primary focus:ring-primary w-4 h-4 rounded"
                      type="checkbox"
                      value="Specialist Services"
                      checked={formData.enquiryType.includes("Specialist Services")}
                      onChange={handleChange}
                      name="enquiryType"
                    />
                    <span className="group-hover:text-primary transition-colors">
                      Specialist Services
                    </span>
                  </label>
                </div>
              </motion.div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div className="flex flex-col" variants={fadeInUp}>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Write message..."
                    className={textareaClasses}
                    value={formData.message}
                    onChange={handleChange}
                  />
                  {errors.message && (
                    <span id="message-error" className="text-xs text-status-danger mt-1 font-semibold" role="alert">
                      {errors.message}
                    </span>
                  )}
                </motion.div>
                
                <motion.div variants={fadeInUp}>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Location of property"
                    value={formData.location}
                    onChange={handleChange}
                    error={errors.location}
                  />
                </motion.div>
              </div>
              
              <motion.p className="text-xs text-gray-500 italic" variants={fadeInUp}>
                By submitting the form you consent to the storage of your data in
                accordance with our Privacy Policy.
              </motion.p>
              
              <motion.div variants={fadeInUp}>
                <Button
                  type="submit"
                  disabled={submitting}
                  variant="primary"
                  size="lg"
                  icon={Send}
                  iconPosition="right"
                  className="uppercase font-bold tracking-wider shadow-md"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </motion.div>
            </motion.div>
          </form>
        </motion.div>
      </section>
    </div>
  )
}

