import { getConfig, Generator } from '@tanstack/router-generator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('Pre-generating route tree...');

const config = getConfig({
  routesDirectory: './src/routes',
  generatedRouteTree: './src/routeTree.gen.ts',
}, ROOT);

const generator = new Generator({ config, root: ROOT });
await generator.run();

console.log('Route tree generated successfully.');
