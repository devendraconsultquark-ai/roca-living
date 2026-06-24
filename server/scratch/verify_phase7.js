const BASE_URL = "http://localhost:8008/api/v1";

async function run() {
  console.log("=== STARTING PHASE 7 PDF REDESIGN TEST ===");

  // 1. Admin Login
  console.log("\nLogging in as Admin...");
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "testadmin@example.com",
      password: "Password123!"
    })
  });
  
  const loginData = await loginRes.json();
  if (loginRes.status !== 200) {
    throw new Error("Admin login failed");
  }

  const jwtAdmin = loginRes.headers.get("set-cookie")?.match(/jwt_admin=([^;]+)/)?.[1];
  const adminHeaders = {
    "Content-Type": "application/json",
    "Cookie": `jwt_admin=${jwtAdmin}`
  };

  // 2. Generate Statement (Combines Statement & Invoice - 2 pages)
  console.log("\nGenerating Landlord Statement (Combined)...");
  const stamp = Date.now();
  const stmtRes = await fetch(`${BASE_URL}/statements/generate`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      statement_number: `STMT_REDESIGN_${stamp}`,
      landlord_name: "Mr Rob Belema & Geertje Adrianntje Hogenes",
      landlord_address: "Jollenmakersweg 26, Oostzaan, 1511 DA",
      nrl_number: "RB: NL945003 / GAH: NL945014",
      landlord_reference: "RL_LR_PH_19",
      property_reference: "PH-19",
      property_address: "Apartment 19, Parsons House, Washington, Sunderland, NE37 1EZ",
      tenant_name: "Ms Kirsty Scott",
      tenancy_type: "Assured Periodic Tenancy (APT)",
      tenancy_start_date: "2026-06-01",
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      rent_received: 795.00,
      void_period_credit: 250.00,
      exp_invoice_no: `EXP_INV_${stamp}`,
      exp_amount: 816.00,
      setup_rebate: 816.00,
      previous_balance: 0.00,
      total_income: 1045.00,
      total_expenditure: 0.00,
      net_paid: 1045.00
    })
  });

  console.log("Statement status response:", stmtRes.status);
  const stmtData = await stmtRes.json();
  if (!stmtRes.ok) {
    throw new Error(`Statement generation failed: ${JSON.stringify(stmtData)}`);
  }
  console.log("Statement generated successfully!", stmtData);

  // 3. Generate Standalone Invoice (1 page)
  console.log("\nGenerating Standalone Service Fee Invoice...");
  const invRes = await fetch(`${BASE_URL}/invoices/generate`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      landlord: {
        name: "Mr Rob Belema & Geertje Adrianntje Hogenes",
        address: "Jollenmakersweg 26, Oostzaan, 1511 DA",
        reference: "RL_LR_PH_19"
      },
      invoice_number: `INV_REDESIGN_${stamp}`,
      period_start: "2026-06-01",
      period_end: "2026-06-30",
      service_level: "Fully Managed",
      property: {
        address: "Apartment 19, Parsons House, Washington, Sunderland, NE37 1EZ"
      },
      tenant_name: "Ms Kirsty Scott",
      tenancy_start_date: "2026-06-01",
      line_items: [
        { description: "Tenancy sourcing fee (*1st month's rent less 28% discount UKV)", cost: 572.40, vat_percent: 0, discount: 572.40, net: 0.00 },
        { description: "Tenant referencing / right to rent checks", cost: 0.00, vat_percent: 0, discount: 0.00, net: 0.00 },
        { description: "Deposit registration (*UKV 100% discount)", cost: 25.00, vat_percent: 0, discount: 25.00, net: 0.00 },
        { description: "Tenancy set up - admin (*UKV 100% discount)", cost: 25.00, vat_percent: 0, discount: 25.00, net: 0.00 },
        { description: "Landlord ID / KYC (*UKV 100% discount)", cost: 30.00, vat_percent: 0, discount: 30.00, net: 0.00 },
        { description: "Check Out - Inventory", cost: 100.00, vat_percent: 0, discount: 100.00, net: 0.00 },
        { description: "Management Fee 8% (*discounted 100% UKV) (01/06/2026 - 30/06/2026)", cost: 63.60, vat_percent: 0, discount: 63.60, net: 0.00 }
      ],
      total_amount: 0.00,
      notes: "UK Vastgoed (UKV) introductory/new tenant discount applied in accordance with the landlord management agreement.\nAll fees are shown excluding VAT as ROCA Living is not VAT registered."
    })
  });

  console.log("Invoice status response:", invRes.status);
  const invData = await invRes.json();
  if (!invRes.ok) {
    throw new Error(`Invoice generation failed: ${JSON.stringify(invData)}`);
  }
  console.log("Invoice generated successfully!", invData);

  console.log("\n=== ALL REDESIGN TESTS COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Test execution failed:", err.message);
  process.exit(1);
});
