import { useState } from "react";
import {
  Users,
  Home,
  FileText,
  Headphones,
  ChevronRight,
  Search,
} from "lucide-react";
import { CirclePoundIcon } from "../components/UI/CirclePoundIcon";

export const Support = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [openTopic, setOpenTopic] = useState(null);

  const topicsData = [
    {
      title: "Getting Started",
      description: "Learn the basics of navigating and using your portal.",
      icon: Users,
      isCustomIcon: false,
      articles: [
        {
          q: "Finding your way around",
          a: "Use the sidebar on the left to move between Dashboard, Properties, Financials, Compliance, Maintenance and Documents. The Dashboard gives you a live overview of your whole portfolio — occupancy, compliance, latest statement figures and any alerts that need your attention.",
        },
        {
          q: "Viewing a single property",
          a: "Use the property selector in the top-right of the header to switch between \"All Properties\" and an individual property. Every page then scopes its figures and lists to your selection.",
        },
      ],
    },
    {
      title: "Property",
      description: "Manage your property details and information.",
      icon: Home,
      isCustomIcon: false,
      articles: [
        {
          q: "Checking property performance",
          a: "The Properties page lists every property with its tenant, rent and certificate status. Click \"View Property\" for the full picture — tenancy, financial summary, compliance and open maintenance issues.",
        },
        {
          q: "Keeping details up to date",
          a: "Property details are maintained by your property manager. If anything looks wrong — bedrooms, rent, address — get in touch and we'll correct it.",
        },
      ],
    },
    {
      title: "Finances",
      description: "Understand your balances, payments and statements.",
      icon: CirclePoundIcon,
      isCustomIcon: true,
      articles: [
        {
          q: "Statements",
          a: "Statements are generated monthly and listed under Statements, where each one can be downloaded as a PDF. \"Download All\" fetches every statement in your current filter.",
        },
        {
          q: "Transactions and invoices",
          a: "The Financials page shows every transaction with a running balance, an income-vs-expenses chart, and an Invoices tab where you can download invoice PDFs.",
        },
        {
          q: "Rent arrears",
          a: "Overdue rent appears on your Dashboard alerts and in the Properties \"Rent Arrears\" filter. Your property manager chases arrears on your behalf.",
        },
      ],
    },
    {
      title: "Documents",
      description: "View and download your important documents.",
      icon: FileText,
      isCustomIcon: false,
      articles: [
        {
          q: "Finding a document",
          a: "The Documents page holds everything your property manager has filed for you — statements, certificates and compliance paperwork. Filter by category or search by name, then use the Download action on any row.",
        },
        {
          q: "Certificates",
          a: "Compliance certificates (Gas Safety, EPC, EICR) live under Compliance → Certificates. Rows with a document attached have a View button that downloads the file.",
        },
      ],
    },
    {
      title: "Support",
      description: "How to contact us and get further assistance.",
      icon: Headphones,
      isCustomIcon: false,
      articles: [
        {
          q: "Contacting your property manager",
          a: "For anything about your tenancy, property or statements, your property manager is the first port of call — reply to any email from us, or use the contact form on our website's Contact page.",
        },
        {
          q: "Reporting a problem with the portal",
          a: "If something in the portal looks wrong or won't load, let us know via the contact form and include the page you were on — we'll investigate.",
        },
      ],
    },
  ];

  // Dynamic search filtering — matches topic names and article content.
  const q = searchQuery.toLowerCase();
  const filteredTopics = topicsData.filter(
    (topic) =>
      topic.title.toLowerCase().includes(q) ||
      topic.description.toLowerCase().includes(q) ||
      topic.articles.some(
        (a) => a.q.toLowerCase().includes(q) || a.a.toLowerCase().includes(q),
      ),
  );

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {/* 1. How can we help widget */}
      <div className="card-bg border border-card-border rounded-card p-6 shadow-xs flex items-center justify-between gap-6 select-none">
        <div className="flex flex-col text-left gap-1.5 flex-grow">
          <h3 className="text-sm-portal font-semibold text-brand-primary">
            How can we help?
          </h3>

          <div className="relative mt-2 max-w-xl">
            <Search
              size={14}
              className="absolute left-3.5 top-3 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search for help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-card-border rounded-card pl-10 pr-4 py-2 w-full text-xs-portal font-semibold text-brand-primary card-bg placeholder-gray-800 focus:outline-none focus:border-gray-300 transition-colors"
            />
          </div>

          <p className="text-xs-portal text-gray-400 font-semibold mt-2.5">
            Find answers to common questions about using the portal.
          </p>
        </div>

        {/* Browser SVG Illustration */}
        <div className="hidden md:flex relative items-center justify-center w-24 h-24 bg-blue-50/30 rounded-full shrink-0">
          <svg
            className="w-14 h-14"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="15"
              y="25"
              width="70"
              height="50"
              rx="5"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth="2"
            />
            <rect x="15" y="25" width="70" height="12" rx="2" fill="#EDF2F7" />
            <circle cx="21" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="26" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="31" cy="31" r="1.5" fill="#CBD5E0" />
            <circle cx="50" cy="55" r="10" fill="#1A56DB" />
            <text
              x="47.5"
              y="58.5"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              ?
            </text>
          </svg>
        </div>
      </div>

      {/* 2. Help Topics List */}
      <div className="flex flex-col gap-3 select-none text-left">
        <h4 className="text-xs-portal font-semibold text-brand-primary uppercase tracking-wider pl-1">
          Help Topics
        </h4>

        <div className="card-bg border border-card-border rounded-card shadow-xs overflow-hidden divide-y divide-gray-50">
          {filteredTopics.map((topic) => {
            const IconComponent = topic.icon;
            const isOpen = openTopic === topic.title;
            return (
              <div key={topic.title}>
                <button
                  type="button"
                  onClick={() => setOpenTopic(isOpen ? null : topic.title)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-light/50 transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                      <IconComponent size={14} className="shrink-0" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs-portal font-semibold text-brand-primary group-hover:text-status-info transition-colors leading-tight">
                        {topic.title}
                      </span>
                      <span className="text-2xs text-gray-400 font-semibold mt-1 leading-none">
                        {topic.description}
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    size={13}
                    className={`text-sidebar-text-muted group-hover:text-status-info transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-4 bg-surface-light/30">
                    {topic.articles.map((article) => (
                      <div key={article.q} className="flex flex-col pl-11">
                        <span className="text-xs-portal font-bold text-brand-primary leading-tight">
                          {article.q}
                        </span>
                        <p className="text-2xs text-gray-400 font-semibold mt-1.5 leading-relaxed">
                          {article.a}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTopics.length === 0 && (
            <div className="p-8 text-center text-xs-portal text-gray-400 font-semibold card-bg select-none">
              No matching help topics found. Try searching for something else.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
