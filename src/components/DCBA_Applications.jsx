18:58:30.622 Running build in Washington, D.C., USA (East) – iad1
18:58:30.622 Build machine configuration: 2 cores, 8 GB
18:58:30.752 Cloning github.com/arun050775-code/DCBA (Branch: main, Commit: cb7431f)
18:58:31.215 Cloning completed: 462.000ms
18:58:31.486 Restored build cache from previous deployment (BghRdKzbm9ZcKShjmZKWFy9kv1xQ)
18:58:31.684 Running "vercel build"
18:58:31.705 Vercel CLI 54.3.0
18:58:32.170 Installing dependencies...
18:58:32.923 
18:58:32.923 up to date in 622ms
18:58:32.924 
18:58:32.924 26 packages are looking for funding
18:58:32.924   run `npm fund` for details
18:58:32.956 Running "npm run build"
18:58:33.059 
18:58:33.059 > sba-accounting@1.0.0 build
18:58:33.059 > vite build
18:58:33.060 
18:58:33.261 The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.
18:58:33.300 vite v5.4.21 building for production...
18:58:33.357 transforming...
18:58:33.703 (node:96) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///vercel/path0/postcss.config.js is not specified and it doesn't parse as CommonJS.
18:58:33.704 Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
18:58:33.704 To eliminate this warning, add "type": "module" to /vercel/path0/package.json.
18:58:33.705 (Use `node --trace-warnings ...` to show where the warning was created)
18:58:34.434 ✓ 14 modules transformed.
18:58:34.436 x Build failed in 1.11s
18:58:34.437 error during build:
18:58:34.437 Could not resolve "./components/Applications" from "src/App.jsx"
18:58:34.437 file: /vercel/path0/src/App.jsx
18:58:34.437     at getRollupError (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:406:41)
18:58:34.438     at error (file:///vercel/path0/node_modules/rollup/dist/es/shared/parseAst.js:402:42)
18:58:34.438     at ModuleLoader.handleInvalidResolvedId (file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:22106:24)
18:58:34.438     at file:///vercel/path0/node_modules/rollup/dist/es/shared/node-entry.js:22066:26
18:58:34.459 Error: Command "npm run build" exited with 1
