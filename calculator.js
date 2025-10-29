/**
 * Rent vs. Buy Calculator
 * Compares monthly affordability and long-term net worth
 */

// ---------- UTILITIES ----------

function $(id) {
  return document.getElementById(id);
}

function formatUSD(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// PMT: monthly payment for loan
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  return (rate * pv * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

// Future value of a series of monthly contributions
function fvSeries(rate, nper, pmt, pv = 0) {
  const monthlyRate = rate / 12;
  if (monthlyRate === 0) return pv + pmt * nper;
  return pv * Math.pow(1 + monthlyRate, nper) + pmt * ((Math.pow(1 + monthlyRate, nper) - 1) / monthlyRate);
}

// Future value of lump sum
function fv(rate, n, pv) {
  return pv * Math.pow(1 + rate / 12, n);
}

// ---------- INPUT GATHERING ----------

function getInputs() {
  const homePrice = parseFloat($("homePrice").value) || 400000;
  const downPaymentPct = parseFloat($("downPaymentPct").value) || 20;
  const mortgageRate = (parseFloat($("mortgageRate").value) || 7) / 100;
  const loanTerm = parseInt($("loanTerm").value, 10) || 30;
  const propertyTaxAmt = parseFloat($("propertyTaxAmt").value) || 0;
  const propertyTaxPct = (parseFloat($("propertyTaxPct").value) || 1.2) / 100;
  const insuranceAmt = parseFloat($("insuranceAmt").value) || 0;
  const insurancePct = (parseFloat($("insurancePct").value) || 0.4) / 100;
  const maintenanceVisible = !$("maintenancePct")?.closest(".hidden");
  const maintenancePct = maintenanceVisible ? (parseFloat($("maintenancePct").value) || 0) / 100 : 0;
  const hoa = parseFloat($("hoa").value) || 0;
  const closingCostsPct = (parseFloat($("closingCostsPct").value) || 3) / 100;
  const sellingCostsPct = (parseFloat($("sellingCostsPct").value) || 7) / 100;

  const monthlyRent = parseFloat($("monthlyRent").value) || 2000;
  const rentGrowthPct = (parseFloat($("rentGrowthPct").value) || 3) / 100;

  const homeAppreciation = (parseFloat($("homeAppreciation").value) || 3) / 100;
  const downPaymentInvested = $("downPaymentInvested")?.checked ?? false;
  const investmentReturn = downPaymentInvested
    ? (parseFloat($("investmentReturn").value) || 6) / 100
    : 0;
  const timeHorizon = parseInt($("yearsToKeep").value, 10) || 10;

  const downPayment = homePrice * (downPaymentPct / 100);
  const loanAmount = homePrice - downPayment;
  const closingCosts = homePrice * closingCostsPct;
  const monthlyRate = mortgageRate / 12;
  const nPayments = loanTerm * 12;

  const monthlyPI = pmt(monthlyRate, nPayments, loanAmount);
  const annualPropertyTax = propertyTaxAmt > 0 ? propertyTaxAmt : homePrice * propertyTaxPct;
  const annualInsurance = insuranceAmt > 0 ? insuranceAmt : homePrice * insurancePct;
  const annualMaintenance = homePrice * maintenancePct;
  const propertyTaxIncreasePct = (parseFloat($("propertyTaxIncrease")?.value) || 3) / 100;
  const insuranceIncreasePct = (parseFloat($("insuranceIncrease")?.value) || 3) / 100;

  const monthlyPropertyTax = annualPropertyTax / 12;
  const monthlyInsurance = annualInsurance / 12;
  const monthlyMaintenance = annualMaintenance / 12;

  return {
    homePrice,
    downPayment,
    downPaymentPct,
    loanAmount,
    mortgageRate,
    loanTerm,
    monthlyPI,
    monthlyPropertyTax,
    monthlyInsurance,
    monthlyMaintenance,
    annualPropertyTax,
    annualInsurance,
    propertyTaxIncreasePct,
    insuranceIncreasePct,
    hoa,
    closingCosts,
    sellingCostsPct,
    monthlyRent,
    rentGrowthPct,
    homeAppreciation,
    investmentReturn,
    timeHorizon,
  };
}

// ---------- AMORTIZATION ----------

function buildAmortization(inputs) {
  const { loanAmount, mortgageRate, loanTerm } = inputs;
  const monthlyRate = mortgageRate / 12;
  const nPayments = loanTerm * 12;
  let balance = loanAmount;
  const schedule = [];

  const monthlyPI = pmt(monthlyRate, nPayments, loanAmount);

  for (let m = 0; m < nPayments; m++) {
    const interest = balance * monthlyRate;
    const principal = monthlyPI - interest;
    balance -= principal;
    schedule.push({
      month: m + 1,
      principal,
      interest,
      balance: Math.max(0, balance),
    });
  }
  return schedule;
}

// ---------- MAIN CALCULATION ----------

function calculate() {
  const i = getInputs();

  // Monthly ownership cost
  const monthlyOwnCost =
    i.monthlyPI + i.monthlyPropertyTax + i.monthlyInsurance + i.monthlyMaintenance + i.hoa;

  // Rent schedule (year-by-year, then interpolate monthly)
  const rentByYear = [];
  let rent = i.monthlyRent;
  for (let y = 0; y <= i.timeHorizon; y++) {
    rentByYear.push(rent);
    rent *= 1 + i.rentGrowthPct;
  }

  // Amortization
  const amort = buildAmortization(i);
  const totalMonths = i.timeHorizon * 12;

  // Home value over time
  const homeValueByYear = [];
  for (let y = 0; y <= i.timeHorizon; y++) {
    homeValueByYear.push(i.homePrice * Math.pow(1 + i.homeAppreciation, y));
  }

  // Cumulative values
  let totalInterest = 0;
  let totalRentPaid = 0;
  let totalPropertyTax = 0;
  let totalInsurance = 0;
  let totalMaintenance = 0;
  let totalHOA = 0;

  let renterInvestment = i.downPayment + i.closingCosts; // Cash that renter keeps invested

  const monthlyInvRate = i.investmentReturn / 12;

  for (let m = 0; m < totalMonths; m++) {
    const year = Math.floor(m / 12);
    const monthInYear = m % 12;
    // Linear interpolate rent within year
    const rentThisMonth =
      rentByYear[year] + (rentByYear[year + 1] - rentByYear[year]) * (monthInYear / 12);

    totalRentPaid += rentThisMonth;

    if (m < amort.length) {
      totalInterest += amort[m].interest;
      const propTaxThisMonth = i.annualPropertyTax * Math.pow(1 + i.propertyTaxIncreasePct, year) / 12;
      const insThisMonth = i.annualInsurance * Math.pow(1 + i.insuranceIncreasePct, year) / 12;
      totalPropertyTax += propTaxThisMonth;
      totalInsurance += insThisMonth;
      totalMaintenance += i.monthlyMaintenance;
      totalHOA += i.hoa;
    }

    // Investment growth: only the initial lump sum compounds (no monthly savings invested)
    renterInvestment = renterInvestment * (1 + monthlyInvRate);
  }

  // Final home value and sale
  const finalHomeValue = homeValueByYear[i.timeHorizon];
  const remainingBalance = amort[Math.min(totalMonths - 1, amort.length - 1)]?.balance ?? 0;
  const sellingCosts = finalHomeValue * i.sellingCostsPct;
  const saleProceeds = finalHomeValue - sellingCosts - remainingBalance;

  // Unrecoverable cost of buying (interest, taxes, insurance, maintenance, HOA, closing, selling)
  const totalPropTax = totalPropertyTax;
  const totalIns = totalInsurance;
  const totalMaint = i.monthlyMaintenance * totalMonths;
  const totalHoa = i.hoa * totalMonths;
  const unrecoverable =
    totalInterest + totalPropTax + totalIns + totalMaint + totalHoa + i.closingCosts + sellingCosts;
  const unrecoverableBreakdown = {
    interest: totalInterest,
    propertyTax: totalPropTax,
    insurance: totalIns,
    maintenance: totalMaint,
    hoa: totalHoa,
    closingCosts: i.closingCosts,
    sellingCosts,
  };

  // Net worth
  const buyerNetWorth = saleProceeds;
  const renterNetWorth = renterInvestment;
  const growthOfInitial = (i.downPayment + i.closingCosts) * Math.pow(1 + i.investmentReturn / 12, totalMonths);

  const buyerBreakdown = {
    finalHomeValue,
    sellingCosts,
    remainingBalance,
    saleProceeds,
  };
  const renterBreakdown = {
    downPayment: i.downPayment,
    closingCosts: i.closingCosts,
    initialInvestment: i.downPayment + i.closingCosts,
    growthOfInitial,
    investmentReturn: i.investmentReturn,
  };

  const netAdvantage = buyerNetWorth - renterNetWorth;
  const unrecoverableCost = unrecoverable;

  // Break-even year
  let breakEvenYear = null;
  for (let y = 1; y <= i.timeHorizon; y++) {
    const months = y * 12;
    let rInv = i.downPayment + i.closingCosts;
    for (let m = 0; m < months; m++) {
      rInv = rInv * (1 + monthlyInvRate);
    }
    const hv = i.homePrice * Math.pow(1 + i.homeAppreciation, y);
    const am = buildAmortization(i);
    const bal = am[Math.min(months - 1, am.length - 1)]?.balance ?? 0;
    const sc = hv * i.sellingCostsPct;
    const proceeds = hv - sc - bal;
    const bNW = proceeds;
    if (bNW >= rInv) {
      breakEvenYear = y;
      break;
    }
  }

  // Upfront cash to buy
  const upfrontCash = i.downPayment + i.closingCosts;

  // First month rent (for display)
  const firstMonthRent = i.monthlyRent;

  return {
    monthlyOwnCost,
    monthlyRentCost: firstMonthRent,
    monthlyDifference: firstMonthRent - monthlyOwnCost,
    totalRentPaid,
    unrecoverableCost: unrecoverable,
    unrecoverableBreakdown,
    buyerNetWorth,
    renterNetWorth,
    buyerBreakdown,
    renterBreakdown,
    netAdvantage,
    breakEvenYear,
    upfrontCash,
    timeHorizon: i.timeHorizon,
    // For breakdown
    principal: i.monthlyPI * 0.4, // approx
    interest: i.monthlyPI * 0.6,
    propertyTax: i.monthlyPropertyTax,
    insurance: i.monthlyInsurance,
    maintenance: i.monthlyMaintenance,
    // For sensitivity
    rentByYear,
    homeValueByYear,
    monthlyOwnCostVal: monthlyOwnCost,
  };
}

// Sensitivity: run for different horizons
function runSensitivity() {
  const horizons = [3, 5, 7, 10];
  const results = [];
  const i = getInputs();

  const monthlyInvRate = i.investmentReturn / 12;

  for (const years of horizons) {
    const totalMonths = years * 12;
    let renterInvestment = i.downPayment + i.closingCosts;
    for (let m = 0; m < totalMonths; m++) {
      renterInvestment = renterInvestment * (1 + monthlyInvRate);
    }

    const amort = buildAmortization(i);
    const finalHomeValue = i.homePrice * Math.pow(1 + i.homeAppreciation, years);
    const remainingBalance = amort[Math.min(totalMonths - 1, amort.length - 1)]?.balance ?? 0;
    const sellingCosts = finalHomeValue * i.sellingCostsPct;
    const saleProceeds = finalHomeValue - sellingCosts - remainingBalance;
    const buyerNW = saleProceeds;

    results.push({
      years,
      winner: buyerNW >= renterInvestment ? "buy" : "rent",
      advantage: Math.abs(buyerNW - renterInvestment),
    });
  }
  return results;
}

// Year-by-year net worth for chart
function getYearByYearData() {
  const i = getInputs();
  const monthlyInvRate = i.investmentReturn / 12;
  const amort = buildAmortization(i);

  const years = [];
  const buyerNW = [];
  const renterNW = [];

  for (let y = 0; y <= i.timeHorizon; y++) {
    const months = y * 12;
    let rInv = i.downPayment + i.closingCosts;
    for (let m = 0; m < months; m++) {
      rInv = rInv * (1 + monthlyInvRate);
    }

    const hv = i.homePrice * Math.pow(1 + i.homeAppreciation, y);
    const bal = months > 0
      ? (amort[Math.min(months - 1, amort.length - 1)]?.balance ?? 0)
      : i.loanAmount;
    const sc = hv * i.sellingCostsPct;
    const proceeds = hv - sc - bal;

    years.push(y);
    buyerNW.push(proceeds);
    renterNW.push(rInv);
  }

  return { years, buyerNW, renterNW };
}

// Render Net Worth by Year table
function renderNetWorthTable() {
  const data = getYearByYearData();
  const tbody = $("netWorthTableBody");
  if (!tbody) return;

  tbody.innerHTML = data.years
    .map(
      (y, i) =>
        `<tr>
          <td>${y}</td>
          <td class="col-buy">${formatUSD(data.buyerNW[i])}</td>
          <td class="col-rent">${formatUSD(data.renterNW[i])}</td>
        </tr>`
    )
    .join("");
}

// Render SVG chart
function renderChart() {
  const data = getYearByYearData();
  const svg = $("rentVsBuyChart");
  const g = document.getElementById("chartContent");
  if (!g || !svg) return;

  const pad = { top: 20, right: 20, bottom: 35, left: 55 };
  const w = 400;
  const h = 220;
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const allVals = [...data.buyerNW, ...data.renterNW];
  const minY = Math.min(0, Math.min(...allVals) * 1.05);
  const maxY = Math.max(Math.max(...allVals) * 1.05, minY + 1);
  const rangeY = maxY - minY;

  const lastYear = data.years[data.years.length - 1] || 1;
  const xScale = (i) => pad.left + (data.years[i] / lastYear) * chartW;
  const yScale = (v) => pad.top + chartH - ((v - minY) / rangeY) * chartH;

  let html = "";

  // Grid lines
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const v = minY + (i / ySteps) * (maxY - minY);
    const y = yScale(v);
    html += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" class="chart-grid"/>`;
  }
  for (let i = 0; i <= lastYear; i++) {
    const x = pad.left + (i / lastYear) * chartW;
    html += `<line x1="${x}" y1="${pad.top}" x2="${x}" y2="${h - pad.bottom}" class="chart-grid"/>`;
  }

  // Zero line
  if (minY < 0 && maxY > 0) {
    const y0 = yScale(0);
    html += `<line x1="${pad.left}" y1="${y0}" x2="${w - pad.right}" y2="${y0}" class="chart-zero"/>`;
  }

  // Buy line
  let buyPath = `M ${xScale(0)} ${yScale(data.buyerNW[0])}`;
  for (let i = 1; i < data.years.length; i++) {
    buyPath += ` L ${xScale(i)} ${yScale(data.buyerNW[i])}`;
  }
  html += `<path d="${buyPath}" class="chart-line chart-line-buy" fill="none"/>`;

  // Rent line
  let rentPath = `M ${xScale(0)} ${yScale(data.renterNW[0])}`;
  for (let i = 1; i < data.years.length; i++) {
    rentPath += ` L ${xScale(i)} ${yScale(data.renterNW[i])}`;
  }
  html += `<path d="${rentPath}" class="chart-line chart-line-rent" fill="none"/>`;

  // X labels
  for (let i = 0; i <= lastYear; i += Math.max(1, Math.ceil(lastYear / 6))) {
    const x = pad.left + (i / lastYear) * chartW;
    html += `<text x="${x}" y="${h - 8}" class="chart-label">${i}</text>`;
  }
  // Y labels
  for (let i = 0; i <= ySteps; i++) {
    const v = minY + (i / ySteps) * (maxY - minY);
    const y = yScale(v);
    const label = v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0);
    html += `<text x="${pad.left - 6}" y="${y + 4}" class="chart-label chart-label-y" text-anchor="end">${label}</text>`;
  }

  // Legend
  html += `<rect x="${w - pad.right - 120}" y="${pad.top}" width="110" height="36" class="chart-legend-bg"/>`;
  html += `<line x1="${w - pad.right - 110}" y1="${pad.top + 12}" x2="${w - pad.right - 85}" y2="${pad.top + 12}" class="chart-legend-line chart-line-buy"/>`;
  html += `<text x="${w - pad.right - 80}" y="${pad.top + 15}" class="chart-legend-text">Buy</text>`;
  html += `<line x1="${w - pad.right - 110}" y1="${pad.top + 26}" x2="${w - pad.right - 85}" y2="${pad.top + 26}" class="chart-legend-line chart-line-rent"/>`;
  html += `<text x="${w - pad.right - 80}" y="${pad.top + 29}" class="chart-legend-text">Rent</text>`;

  g.innerHTML = html;
}

// ---------- UI UPDATE ----------

function updateUI() {
  const r = calculate();
  const sens = runSensitivity();
  renderNetWorthTable();
  renderChart();

  $("yearsLabel").textContent = r.timeHorizon;

  // Headline
  const headlineEl = $("headlineResult");
  headlineEl.classList.remove("buy-wins", "rent-wins");
  if (r.netAdvantage > 0) {
    headlineEl.classList.add("buy-wins");
    $("headlineText").textContent = `Buying gives you ${formatUSD(r.netAdvantage)} more after ${r.timeHorizon} years`;
    $("headlineDetail").textContent = `You'd have more wealth if you buy and stay ${r.timeHorizon} years.`;
  } else if (r.netAdvantage < 0) {
    headlineEl.classList.add("rent-wins");
    $("headlineText").textContent = `Renting gives you ${formatUSD(-r.netAdvantage)} more after ${r.timeHorizon} years`;
    $("headlineDetail").textContent = `Investing the difference makes renting come out ahead.`;
  } else {
    $("headlineText").textContent = "Roughly break-even";
    $("headlineDetail").textContent = "Both paths are comparable over this period.";
  }

  // Monthly
  $("monthlyOwnCost").textContent = formatUSD(r.monthlyOwnCost);
  $("monthlyRentCost").textContent = formatUSD(r.monthlyRentCost);
  const diffEl = $("monthlyDifference");
  diffEl.textContent = formatUSD(r.monthlyDifference);
  diffEl.classList.toggle("positive", r.monthlyDifference > 0);
  diffEl.classList.toggle("negative", r.monthlyDifference < 0);

  // Ownership breakdown
  const i = getInputs();
  const pctPrincipal = (i.monthlyPI * 0.35).toFixed(0); // rough
  const pctInterest = (i.monthlyPI * 0.65).toFixed(0);
  $("ownershipBreakdown").innerHTML = `
    <div>Principal & interest: ${formatUSD(r.monthlyOwnCost - i.monthlyPropertyTax - i.monthlyInsurance - i.monthlyMaintenance - i.hoa)}</div>
    <div>Property tax: ${formatUSD(i.monthlyPropertyTax)}</div>
    <div>Insurance: ${formatUSD(i.monthlyInsurance)}</div>
    <div>Maintenance: ${formatUSD(i.monthlyMaintenance)}</div>
    <div>HOA: ${formatUSD(i.hoa)}</div>
  `;

  // Wealth
  $("buyerNetWorth").textContent = formatUSD(r.buyerNetWorth);
  $("buyerNetWorthDetail").textContent = `Sale proceeds`;
  $("renterNetWorth").textContent = formatUSD(r.renterNetWorth);
  $("renterNetWorthDetail").textContent = `Down payment + closing invested`;

  // Cumulative
  $("totalRentCost").textContent = formatUSD(r.totalRentPaid);
  $("unrecoverableCost").textContent = formatUSD(r.unrecoverableCost);

  // Break-even
  $("breakEvenYear").textContent =
    r.breakEvenYear != null ? `Year ${r.breakEvenYear}` : "Beyond horizon";
  $("upfrontCash").textContent = formatUSD(r.upfrontCash);

  // Sensitivity
  const tbody = $("sensitivityBody");
  tbody.innerHTML = sens
    .map(
      (s) =>
        `<tr>
          <td>${s.years} years</td>
          <td class="winner-${s.winner}">${s.winner === "buy" ? "Buy" : "Rent"}</td>
          <td>${formatUSD(s.advantage)}</td>
        </tr>`
    )
    .join("");
}

// ---------- RENT CALC MODAL ----------

function openRentCalcModal() {
  const i = getInputs();
  const rentByYear = [];
  let rent = i.monthlyRent;
  for (let y = 0; y <= i.timeHorizon; y++) {
    rentByYear.push(rent);
    rent *= 1 + i.rentGrowthPct;
  }

  let total = 0;
  const rows = [];
  for (let y = 0; y < i.timeHorizon; y++) {
    let annualRent = 0;
    for (let m = 0; m < 12; m++) {
      const rentM = rentByYear[y] + (rentByYear[y + 1] - rentByYear[y]) * (m / 12);
      annualRent += rentM;
    }
    total += annualRent;
    rows.push({
      year: y + 1,
      monthlyStart: rentByYear[y],
      annual: annualRent,
      cumulative: total,
    });
  }

  const body = $("rentCalcModalBody");
  body.innerHTML = `
    <div class="calc-inputs">
      <div>Starting monthly rent: ${formatUSD(i.monthlyRent)}</div>
      <div>Rent increase: ${(i.rentGrowthPct * 100).toFixed(1)}% per year</div>
      <div>Years: ${i.timeHorizon}</div>
    </div>
    <table class="calc-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Rent (start)</th>
          <th>Annual</th>
          <th>Cumulative</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${r.year}</td>
            <td>${formatUSD(r.monthlyStart)}</td>
            <td>${formatUSD(r.annual)}</td>
            <td>${formatUSD(r.cumulative)}</td>
          </tr>
        `).join("")}
      </tbody>
      <tfoot>
        <tr class="calc-row-total">
          <td colspan="2">Total spent renting</td>
          <td colspan="2">${formatUSD(total)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const modal = $("rentCalcModal");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRentCalcModal() {
  const modal = $("rentCalcModal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function openUnrecoverableCalcModal() {
  const r = calculate();
  const b = r.unrecoverableBreakdown;

  const body = $("unrecoverableCalcModalBody");
  body.innerHTML = `
    <div class="calc-inputs">
      <div>Money spent on ownership you don't get back. Principal payments build equity and are excluded.</div>
    </div>
    <table class="calc-table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Mortgage interest</td><td>${formatUSD(b.interest)}</td></tr>
        <tr><td>Property taxes</td><td>${formatUSD(b.propertyTax)}</td></tr>
        <tr><td>Insurance</td><td>${formatUSD(b.insurance)}</td></tr>
        <tr><td>Maintenance</td><td>${formatUSD(b.maintenance)}</td></tr>
        <tr><td>HOA</td><td>${formatUSD(b.hoa)}</td></tr>
        <tr><td>Closing costs (at purchase)</td><td>${formatUSD(b.closingCosts)}</td></tr>
        <tr><td>Selling costs</td><td>${formatUSD(b.sellingCosts)}</td></tr>
      </tbody>
      <tfoot>
        <tr class="calc-row-total">
          <td>Total unrecoverable</td>
          <td>${formatUSD(r.unrecoverableCost)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const modal = $("unrecoverableCalcModal");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeUnrecoverableCalcModal() {
  const modal = $("unrecoverableCalcModal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function openBuyerCalcModal() {
  const r = calculate();
  const b = r.buyerBreakdown;

  const body = $("buyerCalcModalBody");
  body.innerHTML = `
    <div class="calc-inputs">
      <div>Net worth from sale proceeds when you sell the home.</div>
    </div>
    <table class="calc-table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Home value at sale</td><td>${formatUSD(b.finalHomeValue)}</td></tr>
        <tr><td>Minus: Selling costs</td><td>−${formatUSD(b.sellingCosts)}</td></tr>
        <tr><td>Minus: Remaining mortgage</td><td>−${formatUSD(b.remainingBalance)}</td></tr>
        <tr><td>Sale proceeds</td><td>${formatUSD(b.saleProceeds)}</td></tr>
      </tbody>
      <tfoot>
        <tr class="calc-row-total">
          <td>Net worth if you buy</td>
          <td>${formatUSD(r.buyerNetWorth)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const modal = $("buyerCalcModal");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeBuyerCalcModal() {
  const modal = $("buyerCalcModal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function openRenterCalcModal() {
  const r = calculate();
  const b = r.renterBreakdown;

  const body = $("renterCalcModalBody");
  body.innerHTML = `
    <div class="calc-inputs">
      <div>Investment of down payment + closing costs, compounded at ${(b.investmentReturn * 100).toFixed(1)}% per year.</div>
    </div>
    <table class="calc-table">
      <thead>
        <tr>
          <th>Component</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Down payment + closing costs (invested from day one)</td><td>${formatUSD(b.initialInvestment)}</td></tr>
        <tr><td>Growth on initial investment (${(b.investmentReturn * 100).toFixed(1)}%/year)</td><td>${formatUSD(b.growthOfInitial - b.initialInvestment)}</td></tr>
      </tbody>
      <tfoot>
        <tr class="calc-row-total">
          <td>Net worth if you rent</td>
          <td>${formatUSD(r.renterNetWorth)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const modal = $("renterCalcModal");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRenterCalcModal() {
  const modal = $("renterCalcModal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

// ---------- PDF REPORT ----------

function generatePDFReport() {
  const i = getInputs();
  const r = calculate();
  const sens = runSensitivity();

  const headline =
    r.netAdvantage > 0
      ? `Buying gives you ${formatUSD(r.netAdvantage)} more after ${r.timeHorizon} years`
      : r.netAdvantage < 0
        ? `Renting gives you ${formatUSD(-r.netAdvantage)} more after ${r.timeHorizon} years`
        : "Roughly break-even over this period";

  const annualPropTax = i.annualPropertyTax;
  const annualIns = i.annualInsurance;

  const report = document.createElement("div");
  report.id = "pdfReport";
  report.innerHTML = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e;max-width:680px;margin:0 auto;padding:32px 24px;">
      <div style="border-bottom:2px solid #3b82f6;padding-bottom:16px;margin-bottom:24px;">
        <h1 style="margin:0;font-size:1.75rem;font-weight:700;color:#1a1a2e;">Rent vs. Buy Calculator</h1>
        <p style="margin:8px 0 0;font-size:0.9rem;color:#64748b;">Report generated ${new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</p>
      </div>

      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:1rem;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.05em;">Summary</h2>
        <div style="background:#f0f9ff;border-radius:8px;padding:16px;font-size:1.1rem;font-weight:600;color:#0369a1;">${headline}</div>
      </div>

      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 16px;font-size:1rem;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.05em;">Inputs</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;font-size:0.85rem;">
          <div><span style="color:#64748b;">Home price</span><br><strong>${formatUSD(i.homePrice)}</strong></div>
          <div><span style="color:#64748b;">Down payment</span><br><strong>${i.downPaymentPct}%</strong></div>
          <div><span style="color:#64748b;">Mortgage rate</span><br><strong>${((i.mortgageRate || 0) * 100).toFixed(1)}%</strong></div>
          <div><span style="color:#64748b;">Loan term</span><br><strong>${i.loanTerm} years</strong></div>
          <div><span style="color:#64748b;">Property tax</span><br><strong>${formatUSD(annualPropTax)}/yr</strong></div>
          <div><span style="color:#64748b;">Insurance</span><br><strong>${formatUSD(annualIns)}/yr</strong></div>
          <div><span style="color:#64748b;">Property tax increase</span><br><strong>${((i.propertyTaxIncreasePct || 0) * 100).toFixed(1)}%/yr</strong></div>
          <div><span style="color:#64748b;">Insurance increase</span><br><strong>${((i.insuranceIncreasePct || 0) * 100).toFixed(1)}%/yr</strong></div>
          <div><span style="color:#64748b;">Monthly rent</span><br><strong>${formatUSD(i.monthlyRent)}</strong></div>
          <div><span style="color:#64748b;">Rent increase</span><br><strong>${((i.rentGrowthPct || 0) * 100).toFixed(1)}%/yr</strong></div>
          <div><span style="color:#64748b;">Home appreciation</span><br><strong>${((i.homeAppreciation || 0) * 100).toFixed(1)}%/yr</strong></div>
          <div><span style="color:#64748b;">Years to keep</span><br><strong>${i.timeHorizon}</strong></div>
        </div>
      </div>

      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 16px;font-size:1rem;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.05em;">Results</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.9rem;">
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Monthly cost to own</span><br><strong>${formatUSD(r.monthlyOwnCost)}</strong></div>
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Monthly cost to rent</span><br><strong>${formatUSD(r.monthlyRentCost)}</strong></div>
          <div style="background:#dcfce7;padding:12px;border-radius:6px;"><span style="color:#166534;">Net worth if you buy</span><br><strong>${formatUSD(r.buyerNetWorth)}</strong></div>
          <div style="background:#fef3c7;padding:12px;border-radius:6px;"><span style="color:#92400e;">Net worth if you rent</span><br><strong>${formatUSD(r.renterNetWorth)}</strong></div>
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Total spent renting</span><br><strong>${formatUSD(r.totalRentPaid)}</strong></div>
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Unrecoverable cost (own)</span><br><strong>${formatUSD(r.unrecoverableCost)}</strong></div>
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Break-even year</span><br><strong>${r.breakEvenYear != null ? `Year ${r.breakEvenYear}` : "Beyond horizon"}</strong></div>
          <div style="background:#f8fafc;padding:12px;border-radius:6px;"><span style="color:#64748b;">Upfront cash to buy</span><br><strong>${formatUSD(r.upfrontCash)}</strong></div>
        </div>
      </div>

      <div style="margin-bottom:28px;">
        <h2 style="margin:0 0 12px;font-size:1rem;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.05em;">Sensitivity</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead><tr style="border-bottom:1px solid #e2e8f0;"><th style="text-align:left;padding:8px 0;">Years</th><th style="text-align:left;padding:8px 0;">Winner</th><th style="text-align:right;padding:8px 0;">Advantage</th></tr></thead>
          <tbody>
            ${sens.map((s) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 0;">${s.years} years</td><td style="padding:6px 0;color:${s.winner === "buy" ? "#16a34a" : "#d97706"}">${s.winner === "buy" ? "Buy" : "Rent"}</td><td style="text-align:right;padding:6px 0;">${formatUSD(s.advantage)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <p style="margin:24px 0 0;font-size:0.75rem;color:#94a3b8;line-height:1.5;">For illustrative purposes only. Does not constitute financial advice. Consult a professional for your situation.</p>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:#fff;z-index:99999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:20px;";
  overlay.id = "pdfOverlay";
  report.style.cssText = "background:#fff;flex-shrink:0;";
  overlay.appendChild(report);
  document.body.appendChild(overlay);

  if (typeof html2pdf === "undefined") {
    document.body.removeChild(overlay);
    alert("PDF library not loaded. Please refresh and try again.");
    return;
  }

  const opt = {
    margin: 12,
    filename: `rent-vs-buy-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  const cleanup = () => {
    if (overlay.parentNode) document.body.removeChild(overlay);
  };

  html2pdf()
    .set(opt)
    .from(report)
    .save()
    .then(cleanup)
    .catch((err) => {
      cleanup();
      console.error("PDF generation failed:", err);
      alert("Could not generate PDF. Please try again.");
    });
}

// ---------- EVENT HANDLERS ----------

function init() {
  const inputs = document.querySelectorAll(
    "input, select"
  );
  inputs.forEach((el) => {
    el.addEventListener("input", () => {
      if (el.dataset.paired) {
        const paired = $(el.dataset.paired);
        if (paired && el.value.trim() !== "") paired.value = "";
      }
      updateUI();
    });
    el.addEventListener("change", updateUI);
  });

  $("downPaymentInvested")?.addEventListener("change", () => {
    const checked = $("downPaymentInvested")?.checked ?? false;
    document.querySelectorAll(".investment-return-group").forEach((el) => {
      el.classList.toggle("hidden", !checked);
    });
    updateUI();
  });
  document.querySelectorAll(".investment-return-group").forEach((el) => {
    el.classList.toggle("hidden", !($("downPaymentInvested")?.checked ?? false));
  });

  $("downloadPdfBtn")?.addEventListener("click", generatePDFReport);

  $("totalRentInfoIcon")?.addEventListener("click", openRentCalcModal);
  $("rentCalcModalClose")?.addEventListener("click", closeRentCalcModal);
  $("rentCalcModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeRentCalcModal();
  });

  $("unrecoverableInfoIcon")?.addEventListener("click", openUnrecoverableCalcModal);
  $("unrecoverableCalcModalClose")?.addEventListener("click", closeUnrecoverableCalcModal);
  $("unrecoverableCalcModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeUnrecoverableCalcModal();
  });

  $("buyerNetWorthInfoIcon")?.addEventListener("click", openBuyerCalcModal);
  $("buyerCalcModalClose")?.addEventListener("click", closeBuyerCalcModal);
  $("buyerCalcModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeBuyerCalcModal();
  });

  $("renterNetWorthInfoIcon")?.addEventListener("click", openRenterCalcModal);
  $("renterCalcModalClose")?.addEventListener("click", closeRenterCalcModal);
  $("renterCalcModal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeRenterCalcModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("rentCalcModal")?.classList.contains("open")) closeRentCalcModal();
      if ($("unrecoverableCalcModal")?.classList.contains("open")) closeUnrecoverableCalcModal();
      if ($("buyerCalcModal")?.classList.contains("open")) closeBuyerCalcModal();
      if ($("renterCalcModal")?.classList.contains("open")) closeRenterCalcModal();
    }
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const advanced = btn.dataset.mode === "advanced";
      document.querySelectorAll(".advanced-only").forEach((el) => {
        el.classList.toggle("hidden", !advanced);
      });
      document.querySelectorAll(".simple-only").forEach((el) => {
        el.classList.toggle("hidden", advanced);
      });
      updateUI();
    });
  });

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".view-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const view = tab.dataset.view;
      $("netWorthTableView").classList.toggle("hidden", view !== "table");
      $("netWorthGraphView").classList.toggle("hidden", view !== "graph");
    });
  });

  document.querySelectorAll("[data-toggle]").forEach((h3) => {
    h3.addEventListener("click", () => {
      const id = h3.dataset.toggle;
      const grid = document.getElementById(`${id}-inputs`);
      if (grid) grid.classList.toggle("collapsed");
    });
  });

  updateUI();
}

init();
