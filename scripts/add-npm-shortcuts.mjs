import fs from "node:fs";
import path from "node:path";

const pkgPath = path.resolve("package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.scripts = pkg.scripts ?? {};
pkg.scripts.backup = pkg.scripts.backup ?? "./scripts/backup.sh";
pkg.scripts["tablet:deploy"] = pkg.scripts["tablet:deploy"] ?? "./scripts/tablet-deploy.sh";
pkg.scripts["ai:log"] = pkg.scripts["ai:log"] ?? "./scripts/ai-log.sh";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("OK: package.json npm shortcutok beállítva.");
