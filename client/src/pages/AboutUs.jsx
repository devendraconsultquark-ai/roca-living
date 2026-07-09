import { useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/UI/Button";

export default function AboutUs() {
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
    <div ref={container}>
      {/* Hero Section */}
      <section id="hero" className="relative min-h-[100vh] overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${import.meta.env.BASE_URL}images/about_hero.jpg)`,
          }}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background-dark/70 via-background-dark/20 to-transparent"></div>
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-40">
          <div>
            <motion.p
              className="text-3xl md:text-5xl text-white leading-relaxed font-[100]"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              Property, Understood.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Experience & Focus Section */}
      <section className="py-24 card-bg">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              className="relative group order-first"
              variants={fadeInUp}
            >
              <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
              <img
                alt="Residential property portfolio"
                className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]"
                src={`${import.meta.env.BASE_URL}images/about_1.jpg`}
              />
            </motion.div>

            <motion.div variants={fadeInUp}>
              <div className="space-y-6 text-status-muted text-base sm:text-lg leading-relaxed">
                <p>
                  With extensive experience across the residential property
                  sector, ROCA Living specialises in professionally managed
                  lettings and the structured oversight of residential property
                  portfolios, including individual apartments and multi-unit
                  residential developments, on behalf of professional UK
                  landlords and overseas investors.
                </p>
                <p>
                  Our focus is on delivering a reliable and compliance-led
                  management service that supports landlords in maintaining
                  well-managed, income-producing assets. We work closely with
                  developer partners and investors to manage the transition from
                  property completion through to tenant occupation, including
                  bringing newly completed properties into stable,
                  income-producing use.
                </p>
                <p>
                  Our approach is intentionally hands-on and
                  relationship-driven. By managing a carefully selected
                  portfolio of properties and developments, we are able to
                  provide a high level of attention to each asset and a
                  responsive, consistent service to our clients.
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Integrated Block Management Section */}
      <section className="py-24 bg-surface-light">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              className="order-last lg:order-first"
              variants={fadeInUp}
            >
              <h2 className="text-3xl font-[200] mb-8 tracking-tight text-brand-primary">
                Integrated Block Management
              </h2>
              <div className="space-y-6 text-status-muted text-base sm:text-lg font-light leading-relaxed">
                <p>
                  Working alongside ROCA Estates & Management, we provide
                  coordinated oversight across both buildings and individual
                  apartments. This integrated structure allows for:
                </p>
                <ul className="space-y-4">
                  {[
                    "Improved communication for tenants & landlords",
                    "Seamless reporting of Issues leading to faster resolution times",
                    "Greater visibility of building-level matters",
                    "A more streamlined management experience",
                    "Ability to provide consolidated financial reporting via the ROCAlytics platform.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary mt-1">
                        check_circle
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.div
              className="relative group lg:order-last order-first"
              variants={fadeInUp}
            >
              <div className="absolute -inset-2 lg:-inset-4 rounded-xl blur-2xl group-hover:bg-primary/20 transition-all"></div>
              <img
                alt="Modern residential building"
                className="relative rounded-xl shadow-2xl w-full object-cover aspect-[4/3]"
                src={`${import.meta.env.BASE_URL}images/about_2.jpg`}
              />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ROCA Framework Section */}
      <section className="py-24 card-bg">
        <motion.div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.div className="text-center mb-20" variants={fadeInUp}>
            <h2 className="text-3xl font-[200] mb-4 tracking-tighter">
              ROCA – Our Framework
            </h2>
            <div className="w-20 h-1.5 bg-primary mx-auto rounded-full"></div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12"
            variants={staggerContainer}
          >
            {[
              {
                letter: "R",
                title: "eal Estate",
                desc: "Professional management of residential real estate, supporting landlords and investors across individual properties and multi-unit developments.",
              },
              {
                letter: "O",
                title: "perational Control",
                desc: "Our structured approach ensures effective day-to-day oversight, maintaining consistent standards across both building and apartment-level management.",
              },
              {
                letter: "C",
                title: "ompliance",
                desc: "We operate with a strong focus on regulatory compliance, ensuring properties are managed in line with current and evolving UK lettings requirements.",
              },
              {
                letter: "A",
                title: "sset Management",
                desc: "Our objective is to support the long-term performance of residential assets through professional management, clear reporting and ongoing oversight.",
              },
            ].map((framework, i) => (
              <motion.div
                key={i}
                className="flex flex-col gap-4 group"
                variants={fadeInUp}
              >
                <div className="text-5xl font-[200] text-brand-primary border-b-4 border-primary pb-2 w-fit group-hover:text-primary transition-colors">
                  {framework.letter}
                  <span className="text-2xl opacity-100 group-hover:text-primary transition-colors font-[200]">
                    {framework.title}
                  </span>
                </div>
                <p className="text-status-muted text-base font-[200] leading-relaxed">
                  {framework.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
