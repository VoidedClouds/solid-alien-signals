import { defineConfig, type Options } from 'tsup';

interface BundleOptions {
  dev?: boolean;
  node?: boolean;
}

function options({ dev, node }: BundleOptions): Options {
  // Determine output directory
  let outDir = 'dist';

  return {
    bundle: true,
    clean: true,
    entry: {
      [node ? 'index' : dev ? 'index.dev' : 'index']: 'src/index.ts'
    },
    outExtension({ format }) {
      return {
        js: format === 'iife' ? `.js` : format === 'esm' ? `.module.js` : `.cjs`
      };
    },
    external: [],
    format: node ? 'cjs' : ['esm', 'iife'],
    globalName: node ? undefined : 'solidAlienSignals',
    outDir,
    treeshake: true,
    minify: dev ? false : true,
    define: {
      __DEV__: dev ? 'true' : 'false',
      __TEST__: 'false'
    },
    platform: node ? 'node' : 'browser',
    target: node ? 'node16' : 'esnext',
    esbuildOptions(opts) {
      opts.mangleProps = !dev ? /^_/ : undefined;
    },
    esbuildPlugins: []
  };
}

export default defineConfig([
  // Dev builds
  options({ dev: true }), // dev

  // Prod builds
  options({ dev: false }), // prod

  // Node build
  options({ node: true }) // server
]);
