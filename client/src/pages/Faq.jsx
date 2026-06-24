import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Faq() {
  const container = useRef()
  const [openIndex, setOpenIndex] = useState(null)
  const [activeTab, setActiveTab] = useState('Landlords')
  const [searchQuery, setSearchQuery] = useState('')

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  const categories = ['Landlords', 'Renters’ Rights Bill – Summary', 'How ROCA Living Can Assist']

  const allFaqs = {
    "Landlords": [
      {
        question: "What services does ROCA Living provide? ",
        answer: "We offer a full-service lettings and property portfolio management solution, including tenant sourcing, referencing, rent collection, compliance management, maintenance coordination, and financial reporting."
      },
      {
        question: "How do you find and vet tenants?",
        answer: "We market your property through leading UK portals and local channels, then carry out a thorough referencing process which can include credit checks, employment verification, previous landlord references, affordability checks and Right to Rent verification."
      },
      {
        question: "How long does it take to find a tenant?",
        answer: "This will vary depending on location, property condition, seasonality and asking rent, but many properties let within one to four weeks when priced and presented correctly."
      },
      {
        question: "What fees do landlords pay?",
        answer: "We offer transparent letting and management fees based on the level of service required. A full fee schedule is provided before instruction so you can see exactly what is included."
      },
      {
        question: "How is rent collected and paid to landlords?",
        answer: "Rent is collected from the tenant in line with the tenancy agreement and then transferred to you, usually with a supporting statement showing income, deductions and any agreed expenses."
      },
      {
        question: "Do you handle maintenance issues?",
        answer: "Yes. We coordinate repairs and routine maintenance using trusted contractors, keeping landlords informed and aiming to protect both the property and tenant experience."
      },
      {
        question: "What legal responsibilities do landlords have?",
        answer: "Landlords must meet a range of legal obligations, including gas safety, electrical safety, smoke and carbon monoxide alarm requirements, deposit protection, Energy Performance Certificate rules, Right to Rent checks and any licensing obligations that apply."
      },
      {
        question: "Can you manage properties for overseas landlords?",
        answer: "Yes. We support both UK-based and overseas landlords, with a focus on clear communication, compliance oversight and structured reporting for portfolio owners."
      },
      {
        question: "What happens if a tenant stops paying rent?",
        answer: "We act quickly using a structured arrears process, maintain written records, contact the tenant promptly and advise landlords on the appropriate next steps, including legal remedies where required."
      }
    ],
    "Renters’ Rights Bill – Summary": [
      {
        question: "What is the Renters’ Rights Bill?",
        answer: "The Renters’ Rights Bill is a major reform of the private rented sector designed to strengthen tenant protections, improve housing standards and increase accountability for landlords and letting agents."
      },
      {
        question: "What are the key changes for landlords?",
        answer: "The headline changes include the removal of Section 21 'no-fault' evictions, a move to periodic tenancies as the default structure, tighter rules around rent increases, stronger tenant rights and greater scrutiny of landlord compliance. "
      },
      {
        question: "Will fixed-term tenancies still exist?",
        answer: "The proposed framework moves away from the traditional fixed-term assured shorthold tenancy model and towards periodic arrangements, meaning landlords will need stronger operational processes and documentation."
      },
      {
        question: "What are the new rules on rent increases?",
        answer: "Rent increases are expected to be more tightly controlled, generally limited in frequency and more open to challenge where a tenant believes the increase is unfair or above market level."
      },
      {
        question: "How does this affect eviction processes?",
        answer: "Landlords will need to rely on valid statutory grounds for possession rather than a no-fault route, so record keeping, compliance and correct procedure become even more important."
      },
      {
        question: "Will there be a landlord register or database?",
        answer: "Reform proposals have included a national landlord database or similar mechanism to improve transparency, compliance monitoring and enforcement across the sector."
      },
      {
        question: "What penalties can landlords face for non-compliance? ",
        answer: "Financial penalties can be significant. Depending on the breach, landlords may face civil penalties, larger fines for repeated or serious non-compliance, rent repayment orders, banning orders or restrictions on their ability to let property."
      },
      {
        question: "What types of breaches could lead to fines? ",
        answer: "Examples may include unlawful eviction practices, failure to comply with tenancy reform rules, breaches of property standards, non-compliance with licensing requirements, or failing to follow the correct legal process for possession or rent increases."
      },
      {
        question: "How high can the fines be? ",
        answer: "Website wording can refer to fines and civil penalties potentially running into thousands of pounds, with more severe or repeated breaches attracting much larger sanctions. Final amounts should always be checked against the latest legislation and guidance before publication."
      },
      {
        question: "Can landlords also face wider consequences beyond fines? ",
        answer: "Yes. In addition to financial penalties, landlords may face enforcement action by local authorities, repayment of rent, reputational damage, delays in regaining possession and, in serious cases, banning orders or prosecution. "
      },
      {
        question: "Suggested website wording for fines ",
        answer: "Failure to comply with the legislation can lead to substantial financial penalties.Serious or repeated breaches may result in much higher sanctions, rent repayment orders or banning orders.Landlords and agents should keep systems, documentation and compliance records fully up to date. "
      }
    ],
    "How ROCA Living Can Assist": [
      {
        question: "How does ROCA Living help landlords stay compliant?",
        answer: "We monitor regulatory requirements, keep track of core compliance dates and help ensure properties and tenancies are managed in line with current legal obligations."
      },
      {
        question: "Do you keep clients updated on legal changes?",
        answer: "Yes. We follow developments in lettings legislation and practical compliance requirements so landlords can make informed decisions and reduce avoidable risk."
      },
      {
        question: "How do you reduce landlord risk?",
        answer: "We reduce risk through robust tenant referencing, structured tenancy management, documented arrears processes, maintenance oversight and a compliance-led approach throughout the tenancy lifecycle."
      },
      {
        question: "Can you help portfolio landlords as well as single-property landlords?",
        answer: "Absolutely. Our service is particularly well suited to professional and portfolio landlords who need consistency, oversight and reporting across multiple properties."
      },
      {
        question: "Do you provide reporting that supports tax and financial oversight? ",
        answer: "Yes. We provide clear reporting on rental income and related expenditure to support portfolio oversight and help landlords prepare for accounting and tax obligations. "
      },
      {
        question: "How can ROCA Living help with the Renters’ Rights Bill specifically? ",
        answer: "We help landlords prepare for reform by reviewing tenancy processes, improving compliance systems, maintaining accurate records and adapting management procedures as the legal framework changes. "
      },
      {
        question: "What makes ROCA Living different from a traditional letting agent?",
        answer: "Our approach combines professional tenant sourcing, day-to-day management, compliance awareness and portfolio-level reporting, giving landlords a more structured and investment-minded service."
      },
      {
        question: "Why is professional management increasingly important?",
        answer: "As regulation becomes more demanding, professional management helps landlords stay compliant, respond quickly to issues, protect rental income and reduce exposure to fines, disputes and operational risk."
      }
    ]
  }

  const filteredFaqs = allFaqs[activeTab].filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/faq_hero.jpg)` }}
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
              We are here to help…​
            </motion.p>
          </div>
        </div>
      </section>

      {/* Accordion / Search Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-y-12">
            <div className="col-span-12 lg:col-span-2" />
            <motion.div 
              className="col-span-12 lg:col-span-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              {/* Search Bar */}
              <motion.div className="mx-auto relative mb-12" variants={fadeInUp}>
                <input
                  className="w-full py-5 px-8 pr-14 rounded-2xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 bg-white placeholder-slate-400 text-slate-900 transition-all shadow-sm group-hover:shadow-md font-light"
                  placeholder="What are you looking for? Search FAQs..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute right-6 inset-y-0 flex items-center justify-center text-primary pointer-events-none">
                  <span className="material-symbols-outlined text-3xl font-light">search</span>
                </div>
              </motion.div>

              {/* Tabs Navigation */}
              <motion.div className="bg-slate-100/80 p-1.5 rounded-2xl flex lg:flex-wrap gap-1 mb-16 shadow-inner overflow-x-auto no-scrollbar lg:overflow-visible" variants={fadeInUp}>
                {categories.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab)
                      setOpenIndex(null)
                    }}
                    className={`flex-1 min-w-fit whitespace-nowrap px-6 py-3 text-xs sm:text-sm font-light rounded-xl transition-all duration-300 ${
                      activeTab === tab 
                        ? 'bg-white text-primary shadow-md transform scale-[1.02]' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </motion.div>

              {/* Active Tab Title */}
              <motion.div className="flex items-center gap-4 mb-10" variants={fadeInUp}>
                <div className="w-1.5 h-10 bg-primary rounded-full shadow-lg shadow-primary/20" />
                <h2 className="text-3xl font-[200] text-slate-900 tracking-tight">
                  {activeTab}
                </h2>
              </motion.div>
              
              {/* Accordions */}
              <motion.div className="space-y-4" variants={staggerContainer}>
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, index) => (
                    <motion.div
                      key={index}
                      className="border border-slate-100/60 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300"
                      variants={fadeInUp}
                    >
                      <button
                        onClick={() => toggleAccordion(index)}
                        className="flex items-center justify-between w-full p-6 lg:p-8 text-left cursor-pointer group"
                      >
                        <span className={`text-lg md:text-xl font-[200] transition-colors duration-300 ${openIndex === index ? 'text-primary' : 'text-slate-800'}`}>
                          {faq.question}
                        </span>
                        <div className={`size-10 rounded-full flex items-center justify-center transition-all duration-500 ${openIndex === index ? 'bg-primary text-white rotate-45' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                          <span className="material-symbols-outlined font-light">add</span>
                        </div>
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {openIndex === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-6 lg:px-8 lg:pb-8 text-slate-600 text-lg leading-relaxed border-t border-slate-50 pt-6">
                              <p className="whitespace-pre-line font-light">
                                {faq.answer}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                ) : (
                  <motion.div className="text-center py-12" variants={fadeInUp}>
                    <p className="text-slate-400 text-lg">No questions found matching your search.</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
            <div className="col-span-12 lg:col-span-2" />
          </div>
          
          <motion.div 
            className="mt-24"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <div className="relative rounded-2xl overflow-hidden bg-black p-8 md:p-16 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 to-slate-800 opacity-90"></div>
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-white text-3xl md:text-4xl font-[200] mb-6">Still have questions? </h2>
                <p className="text-slate-300 text-lg mb-10">Contact ROCA Living for further information </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/contact" className="bg-white text-black font-light px-8 py-4 rounded-lg hover:bg-slate-100 transition-colors shadow-xl">Contact Us</Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
