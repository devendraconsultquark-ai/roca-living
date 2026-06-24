import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function OurServices() {
  const container = useRef()
  const [openIndex, setOpenIndex] = useState(null)
  const [openIndex2, setOpenIndex2] = useState(null)

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }
  const toggleAccordion2 = (index2) => {
    setOpenIndex2(openIndex2 === index2 ? null : index2)
  }

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

  return (
    <div ref={container}>
      {/* Hero Section */}
      <section id="hero" className="relative min-h-[100vh] overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/service_hero.jpg)` }}
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
              We handle the detail <br/> so you don’t have to.
            </motion.p>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Detailed Service Sections */}
          <motion.div 
            className="space-y-24 mb-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {/* Lettings & Tenant Management */}
            <div id="lettings" className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div className="relative group order-first" variants={fadeInUp}>
                <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
                <img alt="Professional handshake" className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]" src={`${import.meta.env.BASE_URL}images/services_1.jpg`} />
              </motion.div>
              
              <motion.div className="space-y-6" variants={fadeInUp}>
                <h2 className="text-3xl font-[200] tracking-tight text-slate-900 border-l-4 border-primary pl-6">Lettings & Tenant Management</h2>
                <div className="text-slate-600 text-base sm:text-lg leading-relaxed space-y-4">
                  <p>
                    We provide a structured lettings and tenant management service designed to support landlords under the evolving regulatory framework of the private rented sector.
                  </p>
                  <p>
                    From initial marketing through to ongoing tenancy management, we oversee the full letting process, ensuring properties are let efficiently, tenants are appropriately referenced, and all tenancy arrangements are managed in line with current legislation.
                  </p>
                  <p>
                    Our approach reflects the changes introduced under the Renters' Rights Act, including the move towards periodic tenancies and increased compliance requirements, ensuring landlords remain protected while maintaining well-managed tenancies.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Rent Collection & Financial Oversight */}
            <div id="financial" className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div className="space-y-6 lg:order-first order-last lg:text-left" variants={fadeInUp}>
                <h2 className="text-3xl font-[200] tracking-tight text-slate-900 border-l-4 border-primary pl-6">Financial Management & Reporting</h2>
                <div className="text-slate-600 text-base sm:text-lg leading-relaxed space-y-4">
                  <p>
                    We manage rent collection and financial administration with a clear and transparent approach, ensuring landlords receive accurate and timely reporting.
                  </p>
                  <p>
                    All rental income and deposits are held in dedicated client accounts, with deposits protected in government-approved schemes, providing security and peace of mind.
                  </p>
                  <p>
                    Through our <span className="text-primary font-bold Carmen-font">ROCALytics</span> reporting platform, we provide detailed financial reporting, including rental income, property-related expenditure and, where required, consolidated portfolio reporting. Our reporting is aligned with Making Tax Digital (MTD) requirements, supporting efficient and compliant financial management.
                  </p>
                </div>
              </motion.div>
              
              <motion.div className="relative group order-first lg:order-last" variants={fadeInUp}>
                <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
                <img alt="ROCALytics reporting on tablet" className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]" src={`${import.meta.env.BASE_URL}images/services_2.jpg`} />
              </motion.div>
            </div>

            {/* Property Portfolio Management */}
            <div id="portfolio" className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div className="relative group order-first" variants={fadeInUp}>
                <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
                <img alt="Multiple properties portfolio" className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]" src={`${import.meta.env.BASE_URL}images/services_3.jpg`} />
              </motion.div>
              
              <motion.div className="space-y-6" variants={fadeInUp}>
                <h2 className="text-3xl font-[200] tracking-tight text-slate-900 border-l-4 border-primary pl-6">Property Portfolio Management</h2>
                <div className="text-slate-600 text-base sm:text-lg leading-relaxed space-y-4">
                  <p>
                    We provide coordinated oversight for landlords with multiple properties or units within residential developments, ensuring consistent management across the portfolio.
                  </p>
                  <p>
                    This includes performance visibility, maintenance coordination and ongoing compliance monitoring, allowing landlords to maintain a clear and informed view of their assets.
                  </p>
                  <p>
                    Through our <span className="text-primary font-bold Carmen-font">ROCALytics</span> reporting platform, we provide consolidated portfolio reporting, bringing together rental income, property-related expenditure and, where applicable, building-level costs into a single, accessible overview.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Pre-Completion & Handover Support */}
            <div id="handover" className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div className="space-y-6 lg:order-first order-last lg:text-left" variants={fadeInUp}>
                <h2 className="text-3xl font-[200] tracking-tight text-slate-900 border-l-4 border-primary pl-6">Pre-Completion & Handover Support</h2>
                <div className="text-slate-600 text-base sm:text-lg leading-relaxed space-y-4">
                  <p>
                    We support landlords and investors through the transition from pre-completion to tenant occupation, ensuring properties are prepared for letting from the outset.
                  </p>
                  <p>
                    This includes coordination of pre-completion inspections and snagging, handover management and initial setup, particularly for overseas investors.
                  </p>
                  <p>
                    Each property is seamlessly onboarded into management, enabling a smooth progression to fully let, income-producing occupancy.
                  </p>
                </div>
              </motion.div>
              
              <motion.div className="relative group order-first lg:order-last" variants={fadeInUp}>
                <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
                <img alt="Pre-completion inspection" className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]" src={`${import.meta.env.BASE_URL}images/services_4.jpg`} />
              </motion.div>
            </div>
          </motion.div>

          <motion.div 
            className="relative rounded-2xl overflow-hidden bg-black p-8 md:p-16 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-slate-800 opacity-90"></div>
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-white text-3xl font-[200] mb-6 Carmen-font">ROCALytics​</h2>
              <p className="text-slate-300 text-lg mb-10">
                <span className="Carmen-font">ROCALytics</span> is our proprietary reporting platform, developed to
                give landlords and investors a more complete view of their
                residential property assets.​
              </p>
              <p className="text-slate-300 text-lg mb-10">
                Built around data points commonly used within institutional reporting environments, <span className="Carmen-font">ROCALytics</span> brings together rental income, expenditure and portfolio performance into a single, accessible overview, supporting informed decision-making and ongoing oversight.​​
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/contact#contact-form" className="bg-white text-black font-bold px-8 py-4 rounded-lg hover:bg-slate-100 transition-colors shadow-xl mx-auto">Contact Our Team</Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
