import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load black logo image as base64
const getLogoBase64 = () => {
  try {
    const logoPath = path.resolve(__dirname, '../../../admin/public/images/logo-black.png');
    if (fs.existsSync(logoPath)) {
      return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  } catch (err) {
    console.error('[Template] Failed to read logo:', err.message);
  }
  return null;
};

/**
 * Helper: formatCurrency (e.g. £1,200.00)
 */
export const formatCurrency = (val) => {
  if (val === null || val === undefined) return '£0.00';
  const num = parseFloat(val);
  if (isNaN(num)) return '£0.00';
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Helper: formatDecimalOnly (e.g. 1,200.00)
 */
export const formatDecimalOnly = (val) => {
  if (val === null || val === undefined) return '0.00';
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Helper: formatDiscountOnly (e.g. -1,200.00)
 */
export const formatDiscountOnly = (val) => {
  if (val === null || val === undefined) return '0.00';
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return '0.00';
  return '-' + Math.abs(num).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Helper: formatDate (e.g. DD/MM/YYYY)
 */
export const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

/**
 * Helper: formatLongDate (e.g. 14th June 2026)
 */
export const formatLongDate = (val) => {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    
    let suffix = 'th';
    if (day === 1 || day === 21 || day === 31) suffix = 'st';
    else if (day === 2 || day === 22) suffix = 'nd';
    else if (day === 3 || day === 23) suffix = 'rd';
    
    return `${day}${suffix} ${month} ${year}`;
  } catch {
    return '';
  }
};

/**
 * Helper: cleanLine (strips leading bullets, hyphens, and asterisks)
 */
export const cleanLine = (line) => {
  if (!line) return '';
  return line.replace(/^\s*[•\-\*]\s*/, '').trim();
};

/**
 * HTML Body for Statement Page
 */
export const generateStatementHTMLBody = (data) => {
  const landlordName = data.landlord_name || 'Landlord Name';
  const landlordAddress = data.landlord_address || '';
  const landlordAddressLines = landlordAddress.split(/[\n,]/).map(line => line.trim()).filter(Boolean);
  
  const logoBase64 = getLogoBase64();
  const logoHtml = logoBase64 
    ? `<img src="${logoBase64}" alt="ROCA Living" style="height: 52px; display: block;" />`
    : `<div style="font-size: 26px; font-weight: bold; color: #1a1a1a; letter-spacing: 0.5px;">ROCA <span style="background-color: #ff9f43; color: white; padding: 2px 8px; border-radius: 4px;">Living</span></div>`;

  const issueDateStr = formatLongDate(new Date());

  const rentVal = parseFloat(data.rent_received) || 0;
  const voidCreditVal = parseFloat(data.void_period_credit) || 0;
  const totalIncome = rentVal + voidCreditVal;

  const expAmountVal = parseFloat(data.exp_amount) || 0;
  const setupRebateVal = parseFloat(data.setup_rebate) || 0;
  const totalExpenditure = Math.max(0, expAmountVal - setupRebateVal);

  const prevBalanceVal = parseFloat(data.previous_balance) || 0;
  const netIncome = totalIncome - totalExpenditure;
  const newBalance = prevBalanceVal + netIncome;

  return `
    <div class="header">
      ${logoHtml}
      <div class="contact-group">
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>Telephone: 0207 101 9551</span>
        </div>
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Email: admin@rocaliving.co.uk</span>
        </div>
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>Website: www.rocaliving.co.uk</span>
        </div>
      </div>
    </div>
    
    <div class="divider-line"></div>
    
    <!-- Title Row -->
    <div class="title-row">
      <h1 class="doc-title">Statement of Account</h1>
      <span class="doc-date">${formatLongDate(data.period_end) || issueDateStr}</span>
    </div>
    
    <!-- Recipient & Meta info box -->
    <div class="recipient-block">
      <div class="to-details">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: #1a1a1a;">${landlordName}</div>
        ${landlordAddressLines.map(line => `<div>${line}</div>`).join('')}
      </div>
      
      <div class="details-box">
        <svg style="color: #ff9f43; width: 24px; height: 24px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path>
          <path d="M16 8h-6m6 4h-6m6 4h-6"></path>
        </svg>
        <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1;">
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Statement No. / NRL Number</span>
            <span class="details-val">${data.statement_number || '—'} / ${data.nrl_number || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Statement Period</span>
            <span class="details-val">${formatDate(data.period_start)} – ${formatDate(data.period_end)}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Landlord Reference</span>
            <span class="details-val">${data.landlord_reference || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Property Reference</span>
            <span class="details-val">${data.property_reference || '—'}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Property & Tenant Info Cards -->
    <div class="cards-row">
      <div class="card">
        <div class="card-icon-wrapper">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div class="card-content">
          <span class="card-title">PROPERTY DETAILS</span>
          <span class="card-text-bold" style="color: #1a1a1a;">${data.property_address || '—'}</span>
        </div>
      </div>
      
      <div class="card">
        <div class="card-icon-wrapper">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="card-content">
          <span class="card-title">TENANT DETAILS</span>
          <span class="card-text-row" style="color: #1a1a1a; font-weight: bold; margin-bottom: 2px;">${data.tenant_name || '—'}</span>
          <span class="card-text-row"><span class="card-text-bold" style="font-size: 9px; color: #6b7280; text-transform: uppercase;">Tenancy Type:</span> ${data.tenancy_type || 'Assured Periodic Tenancy (APT)'}</span>
          <span class="card-text-row"><span class="card-text-bold" style="font-size: 9px; color: #6b7280; text-transform: uppercase;">Tenancy Start Date:</span> ${formatDate(data.tenancy_start_date)}</span>
        </div>
      </div>
    </div>
    
    <!-- Income Table -->
    <div class="section-block">
      <div class="section-header-row">
        <span class="section-title">Income</span>
        <div class="table-header-cols" style="text-transform: uppercase;">
          <span class="col-amount">Amount</span>
          <span class="col-vat">VAT</span>
          <span class="col-gross">Gross</span>
        </div>
      </div>
      <div class="table-body">
        <div class="property-group-title">${data.property_address || '—'}</div>
        <div class="table-row">
          <span class="row-desc">Rent received for the period ${formatDate(data.period_start)} to ${formatDate(data.period_end)} – ${data.tenant_name || 'Tenant'}</span>
          <div class="row-vals">
            <span class="col-amount">${formatCurrency(rentVal)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">${formatCurrency(rentVal)}</span>
          </div>
        </div>
        ${voidCreditVal > 0 ? `
        <div class="table-row">
          <span class="row-desc">Void period rent credit (Roca Living)</span>
          <div class="row-vals">
            <span class="col-amount">${formatCurrency(voidCreditVal)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">${formatCurrency(voidCreditVal)}</span>
          </div>
        </div>` : ''}
        <div class="row-total">
          <span class="total-label">Total Income</span>
          <div class="total-vals">
            <span class="col-amount">${formatCurrency(totalIncome)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">${formatCurrency(totalIncome)}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Expenditure Table -->
    <div class="section-block" style="margin-top: 10px;">
      <div class="section-header-row">
        <span class="section-title">Expenditure</span>
        <div class="table-header-cols" style="text-transform: uppercase;">
          <span class="col-amount">Amount</span>
          <span class="col-vat">VAT</span>
          <span class="col-gross">Gross</span>
        </div>
      </div>
      <div class="table-body">
        <div class="property-group-title">${data.property_address || '—'}</div>
        ${expAmountVal > 0 ? `
        <div class="table-row">
          <span class="row-desc">Invoice No ${data.exp_invoice_no || '—'} (see accompanying invoice & breakdown)</span>
          <div class="row-vals">
            <span class="col-amount" style="color: #b91c1c;">-${formatCurrency(expAmountVal)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross" style="color: #b91c1c;">-${formatCurrency(expAmountVal)}</span>
          </div>
        </div>` : ''}
        ${setupRebateVal > 0 ? `
        <div class="table-row">
          <span class="row-desc">Tenancy Set up – Roca Living rebate</span>
          <div class="row-vals">
            <span class="col-amount">${formatCurrency(setupRebateVal)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">${formatCurrency(setupRebateVal)}</span>
          </div>
        </div>` : ''}
        ${expAmountVal === 0 && setupRebateVal === 0 ? `
        <div class="table-row">
          <span class="row-desc" style="font-style: italic; color: #6b7280;">No expenditure recorded for this period</span>
          <div class="row-vals">
            <span class="col-amount">£0.00</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">£0.00</span>
          </div>
        </div>` : ''}
        <div class="row-total">
          <span class="total-label">Total Expenditure</span>
          <div class="total-vals">
            <span class="col-amount">${formatCurrency(totalExpenditure)}</span>
            <span class="col-vat">£0.00</span>
            <span class="col-gross">${formatCurrency(totalExpenditure)}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Summary Section -->
    <div class="summary-layout" style="margin-top: 12px;">
      <div class="summary-card">
        <div class="summary-card-header">Summary</div>
        <div class="summary-card-body">
          <div class="summary-row">
            <span>Balance from previous statement</span>
            <span>${formatCurrency(prevBalanceVal)}</span>
          </div>
          <div class="summary-row">
            <span>Net income for the period</span>
            <span>${formatCurrency(totalIncome)}</span>
          </div>
          <div class="summary-row">
            <span>Less expenditure</span>
            <span>${totalExpenditure > 0 ? '-' : ''}${formatCurrency(totalExpenditure)}</span>
          </div>
        </div>
        <div class="net-fees-box">
          <span>NEW BALANCE</span>
          <span>${formatCurrency(newBalance)}</span>
        </div>
      </div>
      
      <div class="payment-card">
        <div class="payment-title">Payment Amount</div>
        <div class="payment-val">${formatCurrency(netIncome)}</div>
        <div class="payment-desc">The amount shown will be transferred to your designated bank account as agreed.</div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer-bar">
      <div class="footer-col">
        <div class="footer-circle-icon">?</div>
        <div class="footer-text-stack">
          <span class="footer-lbl">Questions?</span>
          <span class="footer-val">0207 101 9551</span>
        </div>
      </div>
      <div class="footer-col">
        <div class="footer-circle-icon">@</div>
        <div class="footer-text-stack">
          <span class="footer-lbl">Email</span>
          <span class="footer-val">admin@rocaliving.co.uk</span>
        </div>
      </div>
      <div class="footer-col">
        <div class="footer-circle-icon">🏠</div>
        <div class="footer-text-stack">
          <span class="footer-lbl">ROCA Living</span>
          <span class="footer-val">Better living. Managed well.</span>
        </div>
      </div>
    </div>
    
    <div class="footer-disclaimer">
      Roca Property Group Limited trading as ROCA Living. Registered in England & Wales Company No 04914778
    </div>
  `;
};

/**
 * HTML Body for Invoice Page
 */
export const generateInvoiceHTMLBody = (data) => {
  const landlordName = data.landlord_name || 'Landlord Name';
  const landlordAddress = data.landlord_address || '';
  const landlordAddressLines = landlordAddress.split(/[\n,]/).map(line => line.trim()).filter(Boolean);
  
  const logoBase64 = getLogoBase64();
  const logoHtml = logoBase64 
    ? `<img src="${logoBase64}" alt="ROCA Living" style="height: 52px; display: block;" />`
    : `<div style="font-size: 26px; font-weight: bold; color: #1a1a1a; letter-spacing: 0.5px;">ROCA <span style="background-color: #ff9f43; color: white; padding: 2px 8px; border-radius: 4px;">Living</span></div>`;

  const issueDateStr = formatLongDate(data.period_end || new Date());
  
  const lineItems = data.line_items || [];
  
  // Calculate sums
  let totalGross = parseFloat(data.total_gross) || 0;
  let totalVat = parseFloat(data.total_vat) || 0;
  let totalDiscount = parseFloat(data.total_discount) || 0;
  let totalNet = parseFloat(data.total_net) || 0;
  
  if (lineItems.length > 0 && !data.total_gross) {
    totalGross = 0;
    totalVat = 0;
    totalDiscount = 0;
    lineItems.forEach(item => {
      totalGross += parseFloat(item.cost || 0);
      totalVat += (parseFloat(item.cost || 0) * (parseFloat(item.vat_percent || 0))) / 100;
      totalDiscount += parseFloat(item.discount || 0);
    });
    totalNet = Math.max(0, totalGross + totalVat - totalDiscount);
  }

  // Format Notes dynamically or fallback
  const notesHtml = data.notes 
    ? `<div class="notes-card">
         <div class="summary-card-header">Notes</div>
         <div class="notes-body">
           <ul class="notes-list">
             ${data.notes.split('\n').filter(Boolean).map(line => `<li>${cleanLine(line)}</li>`).join('')}
           </ul>
         </div>
       </div>`
    : `<div class="notes-card">
         <div class="summary-card-header">Notes</div>
         <div class="notes-body">
           <ul class="notes-list">
             <li>UK Vastgoed (UKV) introductory/new tenant discount applied in accordance with the landlord management agreement.</li>
             <li>All fees are shown excluding VAT as ROCA Living is not VAT registered.</li>
           </ul>
         </div>
       </div>`;

  return `
    <!-- Header -->
    <div class="header">
      ${logoHtml}
      <div class="contact-group">
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>Telephone: 0207 101 9551</span>
        </div>
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Email: admin@rocaliving.co.uk</span>
        </div>
        <div class="contact-row">
          <svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>Website: www.rocaliving.co.uk</span>
        </div>
      </div>
    </div>
    
    <div class="divider-line"></div>
    
    <!-- Title Row -->
    <div class="title-row">
      <h1 class="doc-title">Invoice</h1>
      <span class="doc-date">${issueDateStr}</span>
    </div>
    
    <!-- Recipient & Meta info box -->
    <div class="recipient-block">
      <div class="to-details">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: #1a1a1a;">${landlordName}</div>
        ${landlordAddressLines.map(line => `<div>${line}</div>`).join('')}
      </div>
      
      <div class="details-box">
        <svg style="color: #ff9f43; width: 24px; height: 24px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path>
          <path d="M16 8h-6m6 4h-6m6 4h-6"></path>
        </svg>
        <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1;">
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Invoice Number</span>
            <span class="details-val">${data.invoice_number || '—'}</span>
          </div>
          <div style="display: flex; flex-direction: column;">
            <span class="details-lbl">Invoice Period</span>
            <span class="details-val">${formatDate(data.period_start)} – ${formatDate(data.period_end)}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Property, Tenant & Service Level Cards -->
    <div class="cards-row">
      <div class="card">
        <div class="card-icon-wrapper">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div class="card-content">
          <span class="card-title">PROPERTY:</span>
          <span class="card-text-bold" style="color: #1a1a1a;">${data.property_address || '—'}</span>
        </div>
      </div>
      
      <div class="card">
        <div class="card-icon-wrapper">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="card-content">
          <span class="card-title">TENANT:</span>
          <span class="card-text-row" style="color: #1a1a1a; font-weight: bold; margin-bottom: 2px;">${data.tenant_name || '—'}</span>
          <span class="card-text-row"><span class="card-text-bold" style="font-size: 9px; color: #6b7280; text-transform: uppercase;">Tenancy Start Date:</span> ${formatDate(data.tenancy_start_date)}</span>
        </div>
      </div>
      
      <div class="card">
        <div class="card-icon-wrapper">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div class="card-content">
          <span class="card-title">SERVICE LEVEL:</span>
          <span class="card-text-bold" style="color: #1a1a1a;">${data.service_level || 'Fully Managed'}</span>
        </div>
      </div>
    </div>
    
    <!-- Items Table -->
    <div class="section-block">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="text-left">Items</th>
            <th class="text-right" style="width: 80px;">Cost<br/>£</th>
            <th class="text-right" style="width: 70px;">VAT<br/>£</th>
            <th class="text-right" style="width: 60px;">VAT<br/>%</th>
            <th class="text-right" style="width: 130px;">Discount<br/>£ (UKV)</th>
            <th class="text-right" style="width: 90px;">Net<br/>£</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => {
            const cost = parseFloat(item.cost || 0);
            const vatPct = parseFloat(item.vat_percent || 0);
            const vat = (cost * vatPct) / 100;
            const discount = parseFloat(item.discount || 0);
            const net = Math.max(0, cost + vat - discount);
            return `
              <tr>
                <td class="text-left">${item.description || '—'}</td>
                <td class="text-right">${formatDecimalOnly(cost)}</td>
                <td class="text-right">${formatDecimalOnly(vat)}</td>
                <td class="text-right">${vatPct}%</td>
                <td class="text-right" style="color: ${discount > 0 ? '#b91c1c' : 'inherit'}; font-weight: ${discount > 0 ? '500' : 'normal'};">${discount > 0 ? formatDiscountOnly(discount) : '0.00'}</td>
                <td class="text-right" style="font-weight: bold;">${formatDecimalOnly(net)}</td>
              </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td class="text-left">TOTAL</td>
            <td class="text-right">${formatDecimalOnly(totalGross)}</td>
            <td class="text-right">${formatDecimalOnly(totalVat)}</td>
            <td class="text-right">0%</td>
            <td class="text-right">${totalDiscount > 0 ? formatDiscountOnly(totalDiscount) : '0.00'}</td>
            <td class="text-right">${formatDecimalOnly(totalNet)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Summary Section -->
    <div class="summary-layout" style="margin-top: 12px;">
      <div class="summary-card">
        <div class="summary-card-header">Invoice Summary</div>
        <div class="summary-card-body">
          <div class="summary-row">
            <span>Total Gross Fees</span>
            <span style="font-weight: bold; color: #1a1a1a;">${formatCurrency(totalGross)}</span>
          </div>
          <div class="summary-row">
            <span>Total Discounts Applied</span>
            <span style="font-weight: bold; color: #b91c1c;">${totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : '£0.00'}</span>
          </div>
        </div>
        <div class="net-fees-box">
          <span>NET FEES DUE</span>
          <span>${formatCurrency(totalNet)}</span>
        </div>
      </div>
      
      <div class="payment-terms-card">
        <div class="summary-card-header">Payment Terms</div>
        <div class="payment-terms-body">
          Fees are deducted from rent received unless otherwise agreed.<br/><br/>
          All amounts are exclusive of VAT.<br/>
          ROCA Living is not VAT registered.
        </div>
      </div>
    </div>
    
    ${notesHtml}
    
    <div class="footer-disclaimer" style="margin-top: 15px;">
      Roca Property Group Limited trading as ROCA Living. Registered in England & Wales Company No 04914778
    </div>
  `;
};

/**
 * Shared Stylesheet for Statement and Invoice Layouts
 */
const getTemplateStyles = () => `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
  
  * { box-sizing: border-box; }
  
  body {
    margin: 0;
    padding: 0;
    font-family: 'Outfit', 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1f2937;
    background-color: #ffffff;
    font-size: 13px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
  }
  
  .page {
    width: 210mm;
    height: 297mm;
    padding: 10mm 15mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background-color: #ffffff;
    page-break-after: always;
  }
  
  .page:last-child {
    page-break-after: avoid;
  }
  
  /* Header Section */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 4px;
  }
  
  .contact-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    font-weight: 500;
    color: #4b5563;
    align-items: flex-start;
  }
  
  .contact-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
  }
  
  .contact-icon {
    width: 13px;
    height: 13px;
  }
  
  .divider-line {
    height: 2px;
    background-color: #ff9f43;
    margin: 8px -15mm 12px -15mm;
    width: calc(100% + 30mm);
  }
  
  /* Title Row */
  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 12px;
  }
  
  .doc-title {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: 0.3px;
    margin: 0;
    text-transform: uppercase;
  }
  
  .doc-date {
    font-size: 13px;
    font-weight: 600;
    color: #4b5563;
  }
  
  /* Recipient & Meta block */
  .recipient-block {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 12px;
    align-items: flex-start;
  }
  
  .to-details {
    flex: 1;
    font-size: 13px;
    color: #4b5563;
    line-height: 1.4;
  }
  
  .details-box {
    width: 270px;
    background-color: #FAF5F0;
    border: 1px solid #EAD8C7;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .details-lbl {
    font-size: 9px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 2px;
  }
  
  .details-val {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
  }
  
  /* Cards Row */
  .cards-row {
    display: flex;
    gap: 15px;
    margin-bottom: 12px;
  }
  
  .card {
    flex: 1;
    background-color: #FAF5F0;
    border: 1px solid #EAD8C7;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  
  .card-icon-wrapper {
    color: #ff9f43;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 2px;
    flex-shrink: 0;
  }
  
  .card-icon {
    width: 20px;
    height: 20px;
  }
  
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .card-title {
    font-size: 9px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 3px;
  }
  
  .card-text-row {
    font-size: 11.5px;
    color: #4b5563;
  }
  
  .card-text-bold {
    font-weight: 700;
    color: #1a1a1a;
  }
  
  /* Section Tables */
  .section-block {
    margin-bottom: 12px;
  }
  
  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 4px;
    border-bottom: 1.5px solid #ff9f43;
    margin-bottom: 6px;
  }
  
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .table-header-cols {
    display: flex;
    gap: 20px;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
  }
  
  .col-amount { width: 75px; text-align: right; }
  .col-vat { width: 50px; text-align: right; }
  .col-gross { width: 75px; text-align: right; }
  
  .table-body {
    display: flex;
    flex-direction: column;
  }
  
  .property-group-title {
    font-size: 11.5px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 4px;
  }
  
  .table-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 11.5px;
  }
  
  .row-desc {
    flex: 1;
    color: #4b5563;
    padding-right: 20px;
  }
  
  .row-vals {
    display: flex;
    gap: 20px;
    font-weight: 600;
  }
  
  .row-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    background-color: #FAF5F0;
    border-top: 1.5px solid #ff9f43;
    border-bottom: 1.5px solid #ff9f43;
    font-weight: 700;
    margin-top: 2px;
  }
  
  .total-label {
    font-size: 12px;
    color: #1a1a1a;
    text-transform: uppercase;
  }
  
  .total-vals {
    display: flex;
    gap: 20px;
    font-size: 12.5px;
  }
  
  /* Summary layout */
  .summary-layout {
    display: flex;
    gap: 15px;
  }
  
  .summary-card {
    flex: 1.2;
    background-color: #ffffff;
    border: 1px solid #EAD8C7;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .summary-card-header {
    background-color: #FAF5F0;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border-bottom: 1px solid #EAD8C7;
  }
  
  .summary-card-body {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: #1a1a1a;
  }
  
  .summary-row-bold {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  
  .net-fees-box {
    background-color: #1A1A1A;
    color: #ff9f43;
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
    font-size: 14px;
    margin-top: auto;
  }
  
  .payment-card {
    flex: 1;
    background-color: #1A1A1A;
    color: #ffffff;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
  .payment-title {
    font-size: 10px;
    font-weight: 700;
    color: #fed7aa;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  
  .payment-val {
    font-size: 24px;
    font-weight: 700;
    color: #ff9f43;
    margin: 4px 0;
  }
  
  .payment-desc {
    font-size: 10.5px;
    line-height: 1.35;
    color: #e2e8f0;
  }
  
  .payment-terms-card {
    flex: 1;
    background-color: #ffffff;
    border: 1px solid #EAD8C7;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .payment-terms-body {
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.4;
    color: #1a1a1a;
  }
  
  .notes-card {
    margin-top: 12px;
    background-color: #ffffff;
    border: 1px solid #EAD8C7;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .notes-body {
    padding: 10px 12px;
    font-size: 11px;
    line-height: 1.4;
    color: #1a1a1a;
  }
  
  .notes-list {
    margin: 0;
    padding-left: 15px;
  }
  
  .notes-list li {
    margin-bottom: 4px;
    list-style-type: none;
    position: relative;
  }
  
  .notes-list li::before {
    content: "•";
    color: #ff9f43;
    font-weight: bold;
    display: inline-block;
    width: 1em;
    margin-left: -1em;
  }
  
  /* Footer */
  .footer-bar {
    background-color: #1a1a1a;
    color: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    border-radius: 6px;
    margin-top: 15px;
  }
  
  .footer-col {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .footer-circle-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background-color: #ff9f43;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: bold;
    font-size: 12px;
  }
  
  .footer-text-stack {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  
  .footer-lbl {
    font-size: 9px;
    font-weight: 700;
    color: #fed7aa;
    text-transform: uppercase;
  }
  
  .footer-val {
    font-size: 11px;
    font-weight: 700;
  }
  
  .footer-disclaimer {
    font-size: 9px;
    color: #6b7280;
    text-align: center;
    margin-top: 8px;
  }
  
  /* Invoice Specific Items */
  .invoice-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  
  .invoice-table th {
    background-color: #1a1a1a;
    color: #ffffff;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    padding: 6px 8px;
    border: 1px solid #1a1a1a;
  }
  
  .invoice-table td {
    padding: 6px 8px;
    font-size: 11px;
    border: 1px solid #e5e7eb;
    color: #1a1a1a;
  }
  
  .invoice-table tr:nth-child(even) {
    background-color: #f9f9f9;
  }
  
  .invoice-table tr.total-row {
    background-color: #f3f4f6 !important;
    color: #1a1a1a;
    font-weight: 700;
  }
  
  .invoice-table tr.total-row td {
    color: #1a1a1a;
    border-top: 1.5px solid #1a1a1a;
    border-bottom: 1.5px solid #1a1a1a;
  }
  
  .text-left { text-align: left; }
  .text-right { text-align: right; }
`;

/**
 * Combined Statement and Invoice HTML Wrapper (2 Pages)
 */
export const generateCombinedHTML = (statementData, invoiceData) => {
  const statementHtml = generateStatementHTMLBody(statementData);
  const invoiceHtml = generateInvoiceHTMLBody(invoiceData);
  const styles = getTemplateStyles();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement & Invoice</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="page">
    ${statementHtml}
  </div>
  <div class="page">
    ${invoiceHtml}
  </div>
</body>
</html>`;
};

/**
 * Standalone Statement HTML Wrapper (1 Page)
 */
export const generateStandaloneStatementHTML = (statementData) => {
  const statementHtml = generateStatementHTMLBody(statementData);
  const styles = getTemplateStyles();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="page">
    ${statementHtml}
  </div>
</body>
</html>`;
};

/**
 * Standalone Invoice HTML Wrapper (1 Page)
 */
export const generateStandaloneInvoiceHTML = (invoiceData) => {
  const invoiceHtml = generateInvoiceHTMLBody(invoiceData);
  const styles = getTemplateStyles();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="page">
    ${invoiceHtml}
  </div>
</body>
</html>`;
};
