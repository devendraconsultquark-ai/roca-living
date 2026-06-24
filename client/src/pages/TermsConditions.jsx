import { useRef } from 'react'
import { motion } from 'framer-motion'

export default function TermsConditions() {
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
    <div ref={container} className="bg-white">
      {/* Hero Section */}
      <section id="hero" className="relative min-h-[60vh] flex items-center overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/terms_hero.jpg)` }}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-black/50"></div>
        </motion.div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.h1 
            className="text-4xl md:text-6xl text-white font-[100] mb-6"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            Terms & Conditions
          </motion.h1>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="space-y-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.div className="text-lg italic" variants={fadeInUp}>
              Welcome to our website. By accessing or using this website, you agree to be bound by these Terms and Conditions of Use, which, together with our Privacy Policy, govern the relationship between you and Watson in relation to this website.
            </motion.div>
            
            <motion.div className="text-sm" variants={fadeInUp}>
              References to “Roca Living”, “Roca”, “we”, “us”, or “our” refer to the owner of this website, whose registered office is Suite 2, Second Floor 107 Power Road, Chiswick, London, W4 5PY. The company is registered in England and Wales under company number 04914778. References to “you” refer to the user or visitor of this website.
            </motion.div>
            
            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-4">
                01 Website Use
              </h2>
              <div className="text-slate-600 text-lg leading-relaxed font-light">
                <p className="font-semibold text-lg mb-4">Your use of this website is subject to the following conditions:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-3 mt-4 text-sm">
                  <li>The content on this website is provided for general information purposes only and is subject to change without notice.</li>
                  <li>While we make reasonable efforts to ensure the accuracy of the information on this website, neither we nor any third parties provide any warranty or guarantee regarding the accuracy, completeness, timeliness, performance, or suitability of the information or materials for any particular purpose. To the fullest extent permitted by law, we exclude liability for any inaccuracies or errors.</li>
                  <li>Any reliance you place on information or materials found on this website is strictly at your own risk. It is your responsibility to ensure that any products, services, or information available through this website meet your specific requirements.</li>
                  <li>This website contains material that is owned by or licensed to us, including but not limited to the design, layout, appearance, and graphics. Reproduction of any content is prohibited without prior written consent, except in accordance with the applicable copyright notice.</li>
                  <li>All trademarks displayed on this website that are not owned by or licensed to us are acknowledged accordingly.</li>
                  <li>Unauthorised use of this website may result in a claim for damages and/or constitute a criminal offence.</li>
                  <li>This website may include links to third-party websites from time to time. These links are provided for your convenience and do not signify endorsement. We have no control over, and accept no responsibility for, the content of any linked websites.</li>
                  <li>You may not create a link to this website from another website or document without our prior written consent.</li>
                  <li>Your use of this website, and any dispute arising from such use, is governed by and construed in accordance with the laws of England, Scotland, and Wales.</li>
                </ul>
              </div>  
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
