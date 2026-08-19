import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lockPath = path.join(root, "package-lock.json");
if (!fs.existsSync(lockPath)) throw new Error("package-lock.json is required.");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const rows = [];

for (const [packagePath, metadata] of Object.entries(lock.packages || {})) {
  if (!packagePath || !packagePath.includes("node_modules/")) continue;
  const name = packagePath.slice(packagePath.lastIndexOf("node_modules/") + "node_modules/".length);
  rows.push({
    name,
    version: String(metadata.version || ""),
    license: String(metadata.license || "UNKNOWN"),
    dev: Boolean(metadata.dev),
    optional: Boolean(metadata.optional),
    resolved: String(metadata.resolved || ""),
  });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const counts = rows.reduce((acc, row) => {
  acc[row.license] = (acc[row.license] || 0) + 1;
  return acc;
}, {});
const review = rows.filter((row) => /UNKNOWN|GPL|AGPL|SSPL|BUSL/i.test(row.license));
const report = {
  generatedAt: new Date().toISOString(),
  packageCount: rows.length,
  licenceCounts: counts,
  reviewRequired: review,
  packages: rows,
};

const outputDir = path.join(root, ".release-evidence");
fs.mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const jsonPath = path.join(outputDir, `teamfeepay-dependency-licences-${stamp}.json`);
const csvPath = path.join(outputDir, `teamfeepay-dependency-licences-${stamp}.csv`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
fs.writeFileSync(csvPath, [
  ["name", "version", "license", "dev", "optional", "resolved"].map(escape).join(","),
  ...rows.map((row) => [row.name, row.version, row.license, row.dev, row.optional, row.resolved].map(escape).join(",")),
].join("\n"));

console.log("TeamFeePay acquisition dependency licence report: COMPLETE");
console.log(`Packages: ${rows.length}`);
console.log(`Review required: ${review.length}`);
console.log(`JSON: ${path.relative(root, jsonPath)}`);
console.log(`CSV: ${path.relative(root, csvPath)}`);
