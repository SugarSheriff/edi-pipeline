# Tape Read — EDI X12 Parsing & Validation Demo

A live simulation of an EDI 850 (Purchase Order) being read segment by segment, mapped to a typed object, and validated — the unglamorous middle layer of most B2B integrations, made visible.

**Live demo:** https://sugarsheriff.github.io/edi-pipeline/

## What it does

- Parses a real (simplified) X12 850 document segment by segment in the browser, animating the read-head across the raw tape
- Builds a structured JSON purchase order live as each segment is read
- "Snap a segment" removes the BEG segment to simulate a corrupt/dropped segment and shows validation catching it before it would ever reach an ERP
- Ships with the real building blocks behind the simulation: a C# segment reader, a TypeScript contract + validator, and a PowerShell inbox health check

## Why this exists

Most integration demos show two shiny APIs talking over REST. EDI is the other end of the spectrum — 40-year-old fixed-width formats, delimiters that vary by trading partner, and validation that has to happen before a single field reaches production systems. It's less visually exciting than a webhook diagram, and it's most of what actually keeps supply chains running.

## Structure

```
index.html          the demo page
style.css
script.js            tape scanner logic + validation
src/
  X12Reader.cs        delimiter-aware segment reader
  edi850.contract.ts   typed PO contract + validator
scripts/
  Watch-EdiInbox.ps1   stuck-file monitor for an EDI inbox
```

## Running the demo locally

```bash
git clone https://github.com/SugarSheriff/edi-pipeline.git
cd edi-pipeline
# just open index.html in a browser — no build step, no dependencies
```

## Author

Built by [Liam Hulsey](https://sugarsheriff.github.io/lookatme/) — integration engineer working across SAP Business One, Wrike, SQL Server, and EDI.
