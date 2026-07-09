import { useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/UI/Button";

export default function PrivacyNotice() {
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
            backgroundImage: `url(${import.meta.env.BASE_URL}images/privacy_hero.jpg)`,
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
            Privacy Notice
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
              How we process, protect & manage your personal data
            </motion.div>

            <motion.p className="text-sm mb-4" variants={fadeInUp}>
              Roca Living is a trading style of Roca Property Group, a private
              limited company registered in England and Wales under company
              number 04914778, with its registered office at Suite 2, Second
              Floor 107 Power Road, Chiswick, London, W4 5PY. REM takes personal
              data privacy seriously and we are committed to safeguarding and
              preserving that of our website visitors and potential clients. We
              understand our responsibilities regarding handling your personal
              data, keeping it secure and safe and ensuring we comply with all
              legal requirements.
            </motion.p>

            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                02 Method and Place of Data Processing
              </h2>
              <div className="text-status-muted leading-relaxed font-light">
                <section className="text-sm">
                  <p className="text-status-muted leading-relaxed">
                    The Owner implements appropriate technical and
                    organisational security measures to protect Personal Data
                    against unauthorised access, disclosure, alteration, or
                    destruction.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Data is processed using computers and IT-enabled systems in
                    accordance with procedures aligned to the stated purposes of
                    processing. In addition to the Owner, Personal Data may be
                    accessible to authorised personnel involved in the operation
                    of the website (including administration, sales, marketing,
                    legal, and IT teams), or to external service providers (such
                    as hosting providers, IT support services, communications
                    agencies, or mail carriers) appointed as Data Processors
                    where necessary.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    An up-to-date list of these parties may be requested from
                    the Owner at any time.
                  </p>
                </section>
              </div>
            </motion.div>

            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                03 Legal Basis for Processing
              </h2>
              <div className="text-status-muted leading-relaxed font-light">
                <section className="text-sm">
                  <ul className="list-disc list-inside text-status-muted space-y-2">
                    <li>
                      The user has given consent for one or more specific
                      purposes;
                    </li>
                    <li>
                      The data is necessary for the performance of a contract
                      with the user or to take steps prior to entering into a
                      contract;
                    </li>
                    <li>
                      Processing is required to comply with a legal obligation;
                    </li>
                    <li>
                      Processing is necessary for the performance of a task
                      carried out in the public interest or under official
                      authority;
                    </li>
                    <li>
                      Processing is necessary for the legitimate interests of
                      the Owner or a third party, provided such interests are
                      not overridden by the user’s rights.
                    </li>
                  </ul>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Where required, the Owner will clarify the applicable legal
                    basis for processing and confirm whether the provision of
                    Personal Data is a statutory or contractual requirement.
                  </p>
                </section>
              </div>
            </motion.div>

            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                04 Place of Processing and Data Transfers
              </h2>
              <div className="text-status-muted leading-relaxed font-light">
                <section className="text-sm">
                  <p className="text-status-muted leading-relaxed">
                    Personal Data is processed at the Owner’s operational
                    offices and at any other locations where parties involved in
                    the processing are based.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Depending on the user’s location, Personal Data may be
                    transferred to countries outside their country of residence.
                    Further details regarding the location of data processing
                    and international data transfers are provided in the
                    relevant sections of this Privacy Policy.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Where data is transferred outside the European Union, users
                    may request information about the legal basis for such
                    transfers and the safeguards in place to protect their
                    Personal Data.
                  </p>
                </section>
              </div>
            </motion.div>

            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                05 Retention of Personal Data
              </h2>
              <div className="text-status-muted leading-relaxed font-light">
                <section className="text-sm">
                  <p className="text-status-muted leading-relaxed">
                    Personal Data is retained only for as long as necessary to
                    fulfil the purposes for which it was collected.
                  </p>
                  <ul className="list-disc list-inside text-status-muted space-y-2 mt-4">
                    <li>
                      Data collected for contractual purposes is retained until
                      the contract has been fully performed;
                    </li>
                    <li>
                      Data processed for the Owner’s legitimate interests is
                      retained for as long as required to achieve those
                      interests.
                    </li>
                  </ul>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Personal Data may be retained for longer periods where the
                    user has provided consent (unless withdrawn) or where
                    retention is required to comply with legal obligations or
                    instructions from a regulatory authority.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    Once the applicable retention period has expired, Personal
                    Data will be securely deleted. After deletion, rights such
                    as access, rectification, erasure, and data portability can
                    no longer be exercised.
                  </p>
                </section>
              </div>
            </motion.div>

            <motion.div className="content-section" variants={fadeInUp}>
              <h2 className="text-xl font-bold text-brand-primary mb-4">
                06 Cookies
              </h2>
              <div className="text-status-muted leading-relaxed font-light">
                <section className="text-sm">
                  <p className="text-status-muted leading-relaxed">
                    Roca Living uses only strictly necessary cookies. When you
                    sign in, we set a secure, HTTP-only session cookie
                    (<code>jwt_admin</code> or <code>jwt_landlord</code>) so we
                    can keep you authenticated and protect your account. These
                    cookies are essential to the operation of the portal and are
                    exempt from consent under applicable law.
                  </p>
                  <p className="text-status-muted leading-relaxed mt-4">
                    We do not use analytics, advertising, or third-party tracking
                    cookies. If we ever introduce non-essential cookies, we will
                    ask for your consent before they are set.
                  </p>
                </section>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
