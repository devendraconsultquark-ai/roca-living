import { useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/UI/Button";

export default function Disclaimer() {
  const container = useRef();

  const fadeInUp = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div ref={container} className="card-bg">
      {/* Hero Section */}
      <section
        id="hero"
        className="relative min-h-[60vh] flex items-center overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}images/disclaimer_hero.jpg)`,
          }}
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
            Disclaimer
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
              While Roca Living takes reasonable care to ensure that the
              information on this website is accurate and up to date, we make no
              representations or warranties, whether express or implied, as to
              the accuracy, completeness, reliability, or suitability of the
              content, services, or related materials provided.
            </motion.div>

            <motion.div
              className="content-section bg-surface-light p-4"
              variants={fadeInUp}
            >
              <h2 className="text-xl font-bold text-brand-primary mb-2">
                Risk Notice
              </h2>
              <div className="text-status-muted text-lg leading-relaxed font-light">
                <p className="text-sm">
                  Any reliance placed on information obtained from this website
                  is done entirely at your own risk. To the fullest extent
                  permitted by law, Roca Living accepts no liability for any
                  loss or damage arising from the use of this website,
                  including, without limitation, any indirect or consequential
                  loss.
                </p>
              </div>
            </motion.div>

            <motion.div className="content-section" variants={fadeInUp}>
              <div className="text-status-muted text-lg leading-relaxed font-light">
                <p className="text-sm mb-4">
                  The information provided on this website is for general
                  guidance only and does not constitute professional, legal, or
                  financial advice. You should obtain independent professional
                  advice before making any property, financial, or investment
                  decisions.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
