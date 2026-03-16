#!/usr/bin/env node
/**
 * Audit phone numbers in assets/doctors-data.js and print a "needs verification" list.
 *
 * Heuristics:
 * - missing/placeholder values
 * - suspicious digit lengths (not 9 digits; allow 11 digits starting with 48)
 * - obviously fake patterns (all zeros, repeated digits, "7700000xx", etc.)
 * - unusually high reuse across entries
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "assets", "doctors-data.js");

function normalizePhone(raw) {
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D+/g, "");
  // Normalize +48 / 0048 -> 48
  let d = digits;
  if (d.startsWith("0048")) d = d.slice(2);
  return { raw: s, digits: d };
}

function isPlaceholder(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return true;
  if (["-", "—", "--", "brak", "brak danych", "n/a", "na", "null", "undefined"].includes(s)) return true;
  return false;
}

function looksFakeDigits(d) {
  if (!d) return true;
  if (/^0+$/.test(d)) return true;
  if (/^(\d)\1+$/.test(d)) return true; // all same digit
  // Common placeholder pattern seen in the dataset: 77 000 00 xx
  if (/^7700000\d\d$/.test(d)) return true;
  // 777777777, 123456789 etc. are usually fake
  if (d === "123456789") return true;
  if (d === "987654321") return true;
  return false;
}

function isPlausiblePL(d) {
  if (!d) return false;
  if (d.length === 9) return true;
  if (d.length === 11 && d.startsWith("48")) return true;
  return false;
}

function parseDoctorsData(fileText) {
  const entries = [];
  let cur = null;

  const lines = fileText.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t === "{") {
      cur = { id: null, name: null, city: null, specialization: null, phone: null, line: null };
      continue;
    }
    if (!cur) continue;

    // Simple key:"value" matches (dataset format is consistent)
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

function sample(arr, n) {
  return arr.slice(0, n);
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing data file: ${DATA_PATH}`);
    process.exit(2);
  }
  const txt = fs.readFileSync(DATA_PATH, "utf8");
  const items = parseDoctorsData(txt);

  const byDigits = new Map(); // digits -> {count, rawSet, examples: []}
  const issues = []; // per-entry issue records

  for (const it of items) {
    const { raw, digits } = normalizePhone(it.phone);
    const rec = byDigits.get(digits) || { count: 0, raws: new Set(), examples: [] };
    rec.count += 1;
    rec.raws.add(raw);
    if (rec.examples.length < 6) {
      rec.examples.push({
        id: it.id,
        city: it.city,
        name: it.name,
        specialization: it.specialization,
        phone: raw,
      });
    }
    byDigits.set(digits, rec);

    const reason = [];
    if (isPlaceholder(raw)) reason.push("pusty/placeholder");
    if (!isPlausiblePL(digits)) reason.push("zla_dlugosc");
    if (looksFakeDigits(digits)) reason.push("wyglada_na_feik");
    if (reason.length) {
      issues.push({ ...it, phone: raw, digits, reason });
    }
  }

  // High reuse: threshold chosen to catch obvious clones but not call-centers.
  const highReuseThreshold = 10;
  const highReuse = [];
  for (const [digits, rec] of byDigits.entries()) {
    if (!digits) continue;
    if (rec.count >= highReuseThreshold) {
      highReuse.push({ digits, count: rec.count, raws: [...rec.raws], examples: rec.examples });
    }
  }
  highReuse.sort((a, b) => b.count - a.count);

  const emptyOrPlaceholder = issues.filter((x) => x.reason.includes("pusty/placeholder"));
  const badLen = issues.filter((x) => x.reason.includes("zla_dlugosc") && !x.reason.includes("pusty/placeholder"));
  const fakeLike = issues.filter((x) => x.reason.includes("wyglada_na_feik") && !x.reason.includes("pusty/placeholder"));

  function printSection(title, lines) {
    process.stdout.write(`\n=== ${title} (${lines.length}) ===\n`);
    for (const l of lines) process.stdout.write(l + "\n");
  }

  process.stdout.write(`PHONE_AUDIT\n`);
  process.stdout.write(`DATA_FILE=${path.relative(ROOT, DATA_PATH)}\n`);
  process.stdout.write(`TOTAL_ENTRIES=${items.length}\n`);
  process.stdout.write(`UNIQUE_PHONES=${byDigits.size}\n`);
  process.stdout.write(`ISSUES=${issues.length}\n`);

  // 1) Empty/placeholder: show as city + name (phone blank)
  process.stdout.write(`\nCOUNTS:\n`);
  process.stdout.write(`EMPTY_OR_PLACEHOLDER=${emptyOrPlaceholder.length}\n`);
  process.stdout.write(`BAD_LENGTH=${badLen.length}\n`);
  process.stdout.write(`FAKE_LIKE_ENTRIES=${fakeLike.length}\n`);
  process.stdout.write(`HIGH_REUSE_NUMBERS=${highReuse.length}\n`);

  printSection(
    "Puste/placeholdery (do uzupelnienia) [podglad]",
    sample(
      emptyOrPlaceholder
        .map((x) => `${x.city}\t${x.name}\t${x.specialization || ""}\t"${x.phone || ""}"`)
        .sort((a, b) => a.localeCompare(b, "pl")),
      120
    )
  );
  if (emptyOrPlaceholder.length > 120) {
    process.stdout.write(`... +${emptyOrPlaceholder.length - 120} kolejnych (pominiete w podgladzie)\n`);
  }

  // 2) Wrong length
  printSection(
    "Zla dlugosc numeru (do sprawdzenia)",
    sample(
      badLen
        .map((x) => `${x.city}\t${x.name}\t${x.specialization || ""}\t${x.phone}\t(digits:${x.digits})`)
        .sort((a, b) => a.localeCompare(b, "pl")),
      120
    )
  );
  if (badLen.length > 120) process.stdout.write(`... +${badLen.length - 120} kolejnych (pominiete w podgladzie)\n`);

  // 3) Fake-like patterns
  const fakeUniq = new Map();
  for (const x of fakeLike) {
    const k = x.digits;
    if (!fakeUniq.has(k)) fakeUniq.set(k, { digits: k, count: 0, examples: [] });
    const r = fakeUniq.get(k);
    r.count += 1;
    if (r.examples.length < 6) r.examples.push(x);
  }
  const fakeList = [...fakeUniq.values()].sort((a, b) => b.count - a.count);
  printSection(
    "Wyglada na fejk/placeholder (pattern)",
    sample(
      fakeList.map((r) => {
        const ex = r.examples[0];
        return `${ex.phone}\tcount=${r.count}\tprzyklad: ${ex.city} | ${ex.name}`;
      }),
      80
    )
  );
  if (fakeList.length > 80) process.stdout.write(`... +${fakeList.length - 80} kolejnych (pominiete w podgladzie)\n`);

  // 4) High reuse numbers
  printSection(
    `Podejrzanie czesto powtarzane (>=${highReuseThreshold} wystapien)`,
    highReuse.map((r) => {
      const display = (r.raws && r.raws[0]) || r.digits;
      return `${display}\tcount=${r.count}\tprzyklad: ${r.examples[0].city} | ${r.examples[0].name}`;
    })
  );

  process.stdout.write("\nNOTE: 'powtarzane' nie zawsze znaczy bledne (np. centrala/rejestracja wspolna). To lista do weryfikacji.\n");
}

main();
