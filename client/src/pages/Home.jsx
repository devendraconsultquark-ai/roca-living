import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Home() {
  const container = useRef()

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
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero.jpg)` }}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background-dark/70 via-background-dark/20 to-transparent"></div>
        </motion.div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-40">
          <div className="max-w-4xl">
            <motion.p 
              className="text-3xl md:text-5xl text-white leading-relaxed font-[100]"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              Lettings & Property Portfolio Management for UK and
              International Landlords
            </motion.p>
          </div>
        </div>
      </section>

      {/* Who We Work With */}
      <section className="py-24 bg-white">
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="max-w-7xl mb-16" variants={fadeInUp}>
            <h3 className="text-3xl font-[200] mb-6 tracking-tight">Supporting Professional Landlords & Investors</h3>
            <p className="text-lg text-slate-600">
              ROCA Living provides specialist lettings and property portfolio management services for
              overseas investors with UK residential assets. Integrated with ROCA Estates & Management,
              we deliver coordinated building and unit-level oversight — ensuring your investment
              performs with structure, transparency and compliance.
            </p>
          </motion.div>
          
          <motion.div className="grid md:grid-cols-4 gap-8" variants={staggerContainer}>
            {[
              {
                icon: 'apartment', 
                title: 'Professional UK Landlords​', 
                desc: 'Supporting experienced landlords with structured lettings and reliable property management across individual assets and growing portfolios.​'
              },
              { 
                icon: 'account_balance', 
                title: 'Overseas Property Investors​', 
                desc: 'Providing fully managed, hands-off lettings and reporting for international investors with UK residential property.​' 
              },
              { 
                icon: 'travel_explore', 
                title: 'Portfolio Landlords​', 
                desc: 'Delivering coordinated management and rent collection with consolidated reporting across the portfolio. ​' 
              },
              { 
                icon: 'diamond', 
                title: 'Build-to-Rent Developers​', 
                desc: 'Supporting the operational delivery and stabilisation of residential developments, managing the transition from completion through to fully let, income-producing assets.' 
              }
            ].map((item, i) => (
              <motion.div 
                key={i} 
                className="bg-white p-10 rounded-2xl border border-slate-200 hover:shadow-2xl transition-all group flex flex-col h-full"
                variants={fadeInUp}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                </div>
                <div className="flex-grow">
                  <h4 className="text-xl font-[200] mb-4">{item.title}</h4>
                  <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Our Services Overview */}
      <section className="py-24 bg-background-light border-t border-slate-100">
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6" variants={fadeInUp}>
            <div>
              <h3 className="text-3xl font-[200] tracking-tight">Complete Lettings, Property Management & Reporting Service​</h3>
            </div>
          </motion.div>
          
          <motion.div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" variants={staggerContainer}>
            {[
              { title: 'Lettings & Tenant Management', img: `${import.meta.env.BASE_URL}images/services_1.jpg`, slug: 'lettings' },
              { title: 'Financial Management & Reporting', img: `${import.meta.env.BASE_URL}images/services_2.jpg`, slug: 'financial' },
              { title: 'Property Portfolio Management', img: `${import.meta.env.BASE_URL}images/services_3.jpg`, slug: 'portfolio' },
              { title: 'Pre-Completion & Handover Support', img: `${import.meta.env.BASE_URL}images/services_4.jpg`, slug: 'handover' }
            ].map((service, i) => (
              <motion.div key={i} variants={fadeInUp} className="h-full">
                <Link to={`/services#${service.slug}`} className="group relative overflow-hidden rounded-2xl bg-white flex flex-col h-full hover:shadow-xl transition-all border border-slate-100">
                  <div className="h-48 overflow-hidden">
                    <img className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={service.img} alt={service.title} />
                  </div>
                  <div className="p-8 flex flex-col flex-grow items-start">
                    <h4 className="text-lg lg:text-xl font-[200] leading-tight mb-8 group-hover:text-primary transition-colors">{service.title}</h4>
                    <div className="mt-auto flex items-center gap-2 text-primary font-light text-xs group-hover:gap-3 transition-all border-b-2 border-primary/0 group-hover:border-primary pb-1">
                      Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Compliance & Governance Section */}
      <section className="py-24 bg-white">
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="rounded-3xl overflow-hidden relative">
            <div className="grid lg:grid-cols-1 gap-12 items-center relative z-10 text-center">
              <motion.div className="text-slate-900" variants={fadeInUp}>
                <h3 className="text-3xl font-[200] mb-6 tracking-tight">Professional Standards & Compliance</h3>
                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  ROCA Living operates with a compliance-led approach to property management​
                </p>
                <div className="flex flex-wrap justify-center items-center gap-10">
                  {['c1.jpg', 'c2.jpg', 'c3.jpg', 'c4.jpg', 'c5.jpg'].map((imgName, index) => (
                    <div key={index} className="w-32 h-16 flex items-center justify-center grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100">
                      <img className="max-w-full max-h-full object-contain" src={`${import.meta.env.BASE_URL}images/${imgName}`} alt={`Compliance ${index + 1}`} />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
