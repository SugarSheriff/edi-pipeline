// --- Raw EDI 850 document (simplified fixed delimiters: * element, ~ segment) ---
const RAW_SEGMENTS = [
  "ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *260707*1200*U*00401*000000001*0*P*>",
  "GS*PO*SENDERID*RECEIVERID*20260707*1200*1*X*004010",
  "ST*850*0001",
  "BEG*00*SA*4471**20260707",
  "N1*ST*Overland Park Distribution Center",
  "N3*8801 Renner Blvd",
  "N4*Overland Park*KS*66219",
  "PO1*1*50*EA*12.50**BP*SKU-88231",
  "PO1*2*10*CS*44.00**BP*SKU-77410",
  "SE*9*0001",
  "GE*1*1",
  "IEA*1*000000001"
];

const tapeTrack = document.getElementById("tapeTrack");
const jsonBody = document.getElementById("jsonBody");
const jsonStatus = document.getElementById("jsonStatus");
const logBody = document.getElementById("logBody");
const playBtn = document.getElementById("playBtn");
const breakBtn = document.getElementById("breakBtn");
const resetBtn = document.getElementById("resetBtn");

let broken = false;
let running = false;

function currentSegments() {
  if (!broken) return RAW_SEGMENTS.slice();
  // Snap out the BEG segment to simulate a dropped/corrupt segment
  return RAW_SEGMENTS.filter(s => !s.startsWith("BEG*"));
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
  if (!po.lines.length) errors.push("PO1: no line items found");
  po.lines.forEach((l, i) => {
    if (!l.productId) errors.push(`PO1 loop ${i + 1}: missing product ID`);
  });

  if (errors.length) {
    jsonStatus.textContent = "failed validation";
    jsonStatus.style.color = "var(--err)";
    errors.forEach(e => log("✕ " + e, "log-err"));
    // Mark the segment where BEG should have been, if it's missing entirely
    if (!po.poNumber) {
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
  breakBtn.textContent = broken ? "Un-snap segment" : "Snap a segment";
  renderTape(currentSegments());
  jsonBody.textContent = broken
    ? '// BEG segment removed from the tape — press "Run tape" to see validation catch it'
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
