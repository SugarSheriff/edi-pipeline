// --- Randomized EDI 850 document generator (simplified fixed delimiters: * element, ~ segment) ---
const PARTNERS = ["SENDERID", "VENDORCO", "ACMESUPPLY", "NORTHBAY", "RIVERPARTS"];
const RECEIVERS = ["RECEIVERID", "OURDISTCO"];
const SHIP_TOS = [
  { name: "Overland Park Distribution Center", street: "8801 Renner Blvd", city: "Overland Park", state: "KS", postalCode: "66219" },
  { name: "Wichita Fulfillment Center", street: "2200 S Rock Rd", city: "Wichita", state: "KS", postalCode: "67207" },
  { name: "Denver Regional Warehouse", street: "4750 Peoria St", city: "Denver", state: "CO", postalCode: "80239" },
  { name: "Dallas Cross-Dock", street: "1150 Trinity Mills Rd", city: "Dallas", state: "TX", postalCode: "75038" }
];
const UNITS = ["EA", "CS", "BX", "PL"];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

function generateDocument() {
  const poNumber = String(rand(1000, 9999));
  const sender = pick(PARTNERS);
  const receiver = pick(RECEIVERS);
  const control = String(rand(1, 999999999)).padStart(9, "0");
  const shipTo = pick(SHIP_TOS);
  const today = "20260707"; // demo date

  const lineCount = rand(2, 4);
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(
      `PO1*${i + 1}*${rand(5, 200)}*${pick(UNITS)}*${(rand(500, 9999) / 100).toFixed(2)}**BP*SKU-${rand(10000, 99999)}`
    );
  }

  const segCount = 6 + lines.length;

  return [
    `ISA*00*          *00*          *ZZ*${sender.padEnd(15)}*ZZ*${receiver.padEnd(15)}*260707*1200*U*00401*${control}*0*P*>`,
    `GS*PO*${sender}*${receiver}*${today}*1200*1*X*004010`,
    `ST*850*0001`,
    `BEG*00*SA*${poNumber}**${today}`,
    `N1*ST*${shipTo.name}`,
    `N3*${shipTo.street}`,
    `N4*${shipTo.city}*${shipTo.state}*${shipTo.postalCode}`,
    ...lines,
    `SE*${segCount}*0001`,
    `GE*1*1`,
    `IEA*1*${control}`
  ];
}

let RAW_SEGMENTS = generateDocument();

const tapeTrack = document.getElementById("tapeTrack");
const jsonBody = document.getElementById("jsonBody");
const jsonStatus = document.getElementById("jsonStatus");
const logBody = document.getElementById("logBody");
const playBtn = document.getElementById("playBtn");
const breakBtn = document.getElementById("breakBtn");
const resetBtn = document.getElementById("resetBtn");

let broken = false;
let running = false;
let snapMode = "BEG"; // which segment type gets snapped this round: BEG or N1

function currentSegments() {
  if (!broken) return RAW_SEGMENTS.slice();
  if (snapMode === "BEG") return RAW_SEGMENTS.filter(s => !s.startsWith("BEG*"));
  return RAW_SEGMENTS.filter(s => !s.startsWith("N1*")); // drops ship-to name
}

function renderTape(segments) {
  tapeTrack.innerHTML = "";
  segments.forEach((seg, i) => {
    const div = document.createElement("div");
    div.className = "tape-seg";
    div.id = `seg-${i}`;
    div.textContent = seg + "~";
    tapeTrack.appendChild(div);
  });
}

function log(msg, cls) {
  const line = document.createElement("div");
  line.className = "log-line" + (cls ? " " + cls : "");
  line.textContent = msg;
  logBody.appendChild(line);
  logBody.scrollTop = logBody.scrollHeight;
}

function resetState() {
  RAW_SEGMENTS = generateDocument();
  broken = false;
  running = false;
  renderTape(currentSegments());
  jsonBody.textContent = '// press "Run tape" to begin';
  jsonStatus.textContent = "idle";
  jsonStatus.style.color = "var(--accent)";
  logBody.innerHTML = '<div class="log-line log-muted">Waiting for a run…</div>';
  playBtn.disabled = false;
  breakBtn.textContent = "Snap a segment";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTape() {
  if (running) return;
  running = true;
  playBtn.disabled = true;

  const segments = currentSegments();
  renderTape(segments);
  logBody.innerHTML = "";
  jsonStatus.textContent = "parsing…";
  jsonStatus.style.color = "var(--accent)";

  const po = { poNumber: null, poDate: null, orderType: null, shipTo: {}, lines: [] };
  const errors = [];

  for (let i = 0; i < segments.length; i++) {
    const el = document.getElementById(`seg-${i}`);
    el.classList.add("active");
    const parts = segments[i].split("*");
    const id = parts[0];

    switch (id) {
      case "ISA":
        log("ISA — interchange envelope opened (sender: SENDERID)", "log-muted");
        break;
      case "GS":
        log("GS — functional group PO opened", "log-muted");
        break;
      case "ST":
        log(`ST — transaction set ${parts[1]} started (control ${parts[2]})`, "log-muted");
        break;
      case "BEG":
        po.orderType = parts[2];
        po.poNumber = parts[3];
        po.poDate = parts[5];
        log(`BEG — PO number ${po.poNumber} captured`, "log-ok");
        break;
      case "N1":
        po.shipTo.name = parts[2];
        break;
      case "N3":
        po.shipTo.street = parts[1];
        break;
      case "N4":
        po.shipTo.city = parts[1];
        po.shipTo.state = parts[2];
        po.shipTo.postalCode = parts[3];
        log("N1/N3/N4 — ship-to address resolved", "log-ok");
        break;
      case "PO1":
        po.lines.push({
          lineNumber: Number(parts[1]),
          quantity: Number(parts[2]),
          unitOfMeasure: parts[3],
          unitPrice: Number(parts[4]),
          productId: parts[7]
        });
        log(`PO1 — line ${parts[1]}: ${parts[2]} ${parts[3]} of ${parts[7]}`, "log-ok");
        break;
      case "SE":
        log(`SE — transaction closed, ${parts[1]} segments counted`, "log-muted");
        break;
      case "GE":
      case "IEA":
        log(`${id} — envelope closed`, "log-muted");
        break;
    }

    jsonBody.textContent = JSON.stringify(po, null, 2);
    await sleep(280);
    el.classList.remove("active");
    el.classList.add("done");
  }

  // Validate the fully-parsed object
  if (!po.poNumber) errors.push("BEG02: missing PO number — required to reconcile against trading partner");
  if (!po.shipTo.name) errors.push("N102: missing ship-to name — N3/N4 arrived with no N1 to anchor them");
  if (!po.lines.length) errors.push("PO1: no line items found");
  po.lines.forEach((l, i) => {
    if (!l.productId) errors.push(`PO1 loop ${i + 1}: missing product ID`);
  });

  if (errors.length) {
    jsonStatus.textContent = "failed validation";
    jsonStatus.style.color = "var(--err)";
    errors.forEach(e => log("✕ " + e, "log-err"));
    if (!po.poNumber || !po.shipTo.name) {
      log("→ document rejected before reaching the ERP. A 997 functional acknowledgment goes back to the trading partner with these errors.", "log-err");
    }
  } else {
    jsonStatus.textContent = "valid ✓";
    jsonStatus.style.color = "var(--ok)";
    log("✓ document valid — handed off to SAP Business One order intake", "log-ok");
  }

  running = false;
  playBtn.disabled = false;
}

playBtn.addEventListener("click", runTape);

breakBtn.addEventListener("click", () => {
  if (running) return;
  broken = !broken;
  if (broken) snapMode = pick(["BEG", "N1"]);
  breakBtn.textContent = broken ? "Un-snap segment" : "Snap a segment";
  renderTape(currentSegments());
  jsonBody.textContent = broken
    ? `// ${snapMode} segment removed from the tape — press "Run tape" to see validation catch it`
    : '// press "Run tape" to begin';
  jsonStatus.textContent = broken ? "tape altered" : "idle";
  jsonStatus.style.color = broken ? "var(--err)" : "var(--accent)";
  logBody.innerHTML = '<div class="log-line log-muted">Waiting for a run…</div>';
});

resetBtn.addEventListener("click", resetState);

// --- Code tabs ---
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".code-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`.code-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
  });
});

resetState();
