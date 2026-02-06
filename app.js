const form = document.getElementById("lccForm");
const results = document.getElementById("results");
const errorBox = document.getElementById("errorBox");
const resetBtn = document.getElementById("resetBtn");

const backdrop = document.getElementById("modalBackdrop");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModal");

function showError(msg){
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function clearError(){
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function openModal(text){
  modalBody.textContent = text;
  backdrop.classList.remove("hidden");
}
function closeModal(){
  backdrop.classList.add("hidden");
}

document.querySelectorAll(".info").forEach(btn => {
  btn.addEventListener("click", () => openModal(btn.dataset.help || "No info."));
});
closeModalBtn.addEventListener("click", closeModal);
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function toNumber(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Accept 0.03 or 3 as "3%"
function normalizeRate(r){
  return r > 1 ? r / 100 : r;
}

function pvFactor(r, n){
  if (n <= 0) throw new Error("Lifespan must be > 0.");
  if (r < 0) throw new Error("Discount rate must be ≥ 0.");
  if (r === 0) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
}

function fmt(x){
  if (!Number.isFinite(x)) return String(x);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  for (const k of Object.keys(payload)) payload[k] = toNumber(payload[k]);

  const required = [
    "initial_cost","area","lifespan_n","discount_rate_r",
    "energy_use","co2_emission","energy_price",
    "operation_cost","maintenance_repair","co2_factor","decommissioning_rate"
  ];
  for (const k of required) {
    if (payload[k] == null) return showError(`Please fill in: ${k.replaceAll("_"," ")}`);
  }

  const initial_cost = payload.initial_cost;
  const area = payload.area;
  const n = Math.trunc(payload.lifespan_n);
  let r = normalizeRate(payload.discount_rate_r);

  if (area <= 0) return showError("Area must be > 0.");
  if (n < 1) return showError("Lifespan must be at least 1 year.");
  if (r < 0) return showError("Discount rate must be ≥ 0.");
  if (payload.decommissioning_rate < 0) return showError("Decommissioning rate must be ≥ 0.");

  try {
    const pvf = pvFactor(r, n);

    // Annual costs
    const energy_cost_year = payload.energy_use * area * payload.energy_price;
    const operation_cost_year = payload.operation_cost * area;
    const maintenance_cost_year = payload.maintenance_repair * area;
    const environmental_cost_year = payload.co2_emission * area * payload.co2_factor;

    const annual_costs =
      energy_cost_year +
      operation_cost_year +
      maintenance_cost_year +
      environmental_cost_year;

    // End-of-life decommissioning (one-time at year n)
    const decommissioning_cost = initial_cost * payload.decommissioning_rate;
    const pv_decommissioning = (r === 0) ? decommissioning_cost : decommissioning_cost / Math.pow(1 + r, n);

    // Total LCC (present value)
    const lcc = initial_cost + pvf * annual_costs + pv_decommissioning;

    results.textContent =
      `Discount rate used (decimal): ${r.toFixed(6)}\n` +
      `PVF: ${pvf.toFixed(6)}\n\n` +
      `Energy cost / year:              ${fmt(energy_cost_year)} SEK\n` +
      `Operation cost / year:           ${fmt(operation_cost_year)} SEK\n` +
      `Maintenance + repairs / year:    ${fmt(maintenance_cost_year)} SEK\n` +
      `Environmental (CO₂) cost / year: ${fmt(environmental_cost_year)} SEK\n` +
      `Annual costs (sum):              ${fmt(annual_costs)} SEK/year\n\n` +
      `Decommissioning (nominal):       ${fmt(decommissioning_cost)} SEK\n` +
      `Decommissioning PV (year ${n}):   ${fmt(pv_decommissioning)} SEK\n\n` +
      `TOTAL LCC (PV):                  ${fmt(lcc)} SEK`;
  } catch (err) {
    results.textContent = "No results yet.";
    showError(err.message || "Calculation error.");
  }
});

resetBtn.addEventListener("click", () => {
  form.reset();
  clearError();
  results.textContent = "No results yet.";
  closeModal();
});

