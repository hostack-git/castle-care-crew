/**
 * Pre-generates routeTree.gen.ts before the Vite build.
 * Solves the race condition in CI where tanstack-start:route-tree-client-plugin
 * calls getCrawlingResult() before the generator has run().
 *
 * Usage: node scripts/generate-routes.mjs
 */

import { Generator } from '@tanstack/router-generator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const config = {
  routesDirectory: path.resolve(ROOT, 'src/routes'),
  generatedRouteTree: path.resolve(ROOT, 'src/routeTree.gen.ts'),
  routeFileIgnorePrefix: '-',
  quoteStyle: 'single',
  semicolons: true,
  disableTypes: false,
  addExtensions: false,
  enableRouteGeneration: true,
  autoCodeSplitting: true,
  target: 'react',
};

console.log('Generating route tree...');
console.log('Routes directory:', config.routesDirectory);
console.log('Output:', config.generatedRouteTree);

const generator = new Generator({ config, root: ROOT });

try {
  await generator.run();
  console.log('Route tree generated successfully.');
} catch (err) {
  console.error('Route generation failed:', err.message);
  console.log('Continuing with existing routeTree.gen.ts...');
  // Don't exit — build will use the committed routeTree.gen.ts
}
