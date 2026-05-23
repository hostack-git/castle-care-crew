/**
 * Post-build: mirror dist/client/* into dist/client/staffapp/
 *
 * When the Worker Route is torridonia.com/staffapp/*, Cloudflare Workers Assets
 * resolves requests like /staffapp/assets/styles.css by looking for the file
 * at  dist/client/staffapp/assets/styles.css  (it does NOT strip the prefix).
 * Vite builds to dist/client/assets/ so we copy everything into the sub-folder.
 */
import { cpSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const clientDir = join(root, "dist", "client");
const targetDir = join(clientDir, "staffapp");

mkdirSync(targetDir, { recursive: true });

// Copy every top-level entry except 'staffapp' itself (avoid recursion)
import { readdirSync } from "fs";
for (const entry of readdirSync(clientDir)) {
  if (entry === "staffapp") continue;
  cpSync(join(clientDir, entry), join(targetDir, entry), { recursive: true });
}

console.log("✅  Assets mirrored to dist/client/staffapp/");
