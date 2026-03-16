#!/usr/bin/env node
/**
 * Apply phone fixes in assets/doctors-data.js for specific facility names.
 * Keeps file formatting; uses minimal regex replacement within each object.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "doctors-data.js");

const FIXES = [
  { name: 'Ambasada Uśmiechu', phone: '691 777 197' },
  { name: 'Medin Klinika', phone: '77 707 70 70' },
  { name: 'MEDICLINICA – Centrum Medyczne', phone: '77 707 07 33' },
  { name: 'PANACEUM Centrum Implantologii i Stomatologii', phone: '77 47 46 056' },
  { name: 'Medicinae Stomatologia', phone: '500 424 940' },
  { name: 'Opolskie Centrum Stomatologiczne Tańczak', phone: '607 173 521' },
  // User provided as "60 039 43 59" => digits 600394359
  { name: 'Dentistar', phone: '600 394 359' },
  { name: 'LASERDENT', phone: '22 112 35 55' },
  // Same facility appears with different capitalization in the dataset.
  { name: 'Laserdent', phone: '22 112 35 55' },
  { name: 'Adenta', phone: '77 888 10 52' },
  { name: 'PRAXI-DENT', phone: '77 474 46 55' },
  { name: 'Galeria Uśmiechu Opole', phone: '736 841 664' },
  { name: 'Poradnia Nefrologiczna – ul. Biasa 31', phone: '77 445 59 46' },
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyFix(text, fix) {
  // Match from name:"X" to the first following phone:"...".
  // Non-greedy ensures we stay inside the same object in this dataset structure.
  const nameRe = escapeRegExp(`name:"${fix.name}"`);
  const re = new RegExp(`(${nameRe}[\\s\\S]*?\\bphone\\s*:\\s*)\"[^\"]*\"`, "g");
  let count = 0;
  const out = text.replace(re, (m, p1) => {
    count += 1;
    return `${p1}"${fix.phone}"`;
  });
  return { out, count };
}

function main() {
  let txt = fs.readFileSync(DATA_PATH, "utf8");
  const summary = [];

  for (const fix of FIXES) {
    const { out, count } = applyFix(txt, fix);
    txt = out;
    summary.push({ name: fix.name, phone: fix.phone, count });
  }

  fs.writeFileSync(DATA_PATH, txt, "utf8");
  for (const s of summary) {
    process.stdout.write(`${s.name}\t=>\t${s.phone}\tupdated=${s.count}\n`);
  }
}

main();
