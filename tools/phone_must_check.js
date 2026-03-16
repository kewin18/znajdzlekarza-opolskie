#!/usr/bin/env node
/**
 * Print "must check" phone entries: obvious placeholders/fakes.
 *
 * Outputs: PHONE \t CITY \t NAME \t SPECIALIZATION
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "doctors-data.js");

function parseDoctorsData(fileText) {
  const entries = [];
  let cur = null;
  const lines = fileText.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t === "{") {
      cur = { id: null, name: null, city: null, specialization: null, phone: null };
      continue;
    }
    if (!cur) continue;
    let m;
    if ((m = t.match(/^id\s*:\s*(\d+)\s*,?\s*$/))) cur.id = Number(m[1]);
    if ((m = t.match(/^name\s*:\s*"(.*)"\s*,?\s*$/))) cur.name = m[1];
    if ((m = t.match(/^city\s*:\s*"(.*)"\s*,?\s*$/))) cur.city = m[1];
    if ((m = t.match(/^specialization\s*:\s*"(.*)"\s*,?\s*$/))) cur.specialization = m[1];
    if ((m = t.match(/^phone\s*:\s*"(.*)"\s*,?\s*$/))) cur.phone = m[1];
    if (t === "}," || t === "}" || t === "},\r") {
      entries.push(cur);
      cur = null;
    }
  }
  return entries;
}

function normalizePhoneRaw(raw) {
  return String(raw ?? "").trim();
}

function isMustCheckPhone(raw) {
  const p = normalizePhoneRaw(raw);
  const low = p.toLowerCase();
  if (!p) return false; // empty list would be huge; must-check here is only obvious fakes
  if (low === "brak numeru") return true;
  if (/^77\s*0{3}\s*0{2}\s*\d{2}$/.test(p.replace(/\s+/g, " "))) return true; // "77 000 00 01" style
  if (/^77\s*000\s*00\s*\d{2}$/.test(p)) return true;
  if (/^77\s*000\s*00\s*00$/.test(p)) return true;
  if (/^\s*112\s*\/\s*999\s*$/.test(p)) return true; // not a facility phone
  return false;
}

function main() {
  const txt = fs.readFileSync(DATA_PATH, "utf8");
  const items = parseDoctorsData(txt);

  const rows = items
    .filter((x) => isMustCheckPhone(x.phone))
    .map((x) => ({
      phone: normalizePhoneRaw(x.phone),
      city: x.city || "",
      name: x.name || "",
      specialization: x.specialization || "",
    }));

  // Group by phone for nicer output
  const byPhone = new Map();
  for (const r of rows) {
    const k = r.phone;
    const rec = byPhone.get(k) || [];
    rec.push(r);
    byPhone.set(k, rec);
  }

  const phones = [...byPhone.keys()].sort((a, b) => a.localeCompare(b, "pl"));
  for (const ph of phones) {
    const list = byPhone.get(ph);
    process.stdout.write(`\n# ${ph} (count=${list.length})\n`);
    // Sort by city then name
    list
      .sort((a, b) => {
        const c = a.city.localeCompare(b.city, "pl");
        if (c !== 0) return c;
        return a.name.localeCompare(b.name, "pl");
      })
      .forEach((r) => {
        process.stdout.write(`${ph}\t${r.city}\t${r.name}\t${r.specialization}\n`);
      });
  }
}

main();

