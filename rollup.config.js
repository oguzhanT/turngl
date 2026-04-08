import resolve from '@rollup/plugin-node-resolve';
import terser  from '@rollup/plugin-terser';

export default [
  // ESM (tree-shakeable)
  {
    input: 'src/index.js',
    external: ['three'],
    output: {
      file:   'dist/turngl.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [resolve(), terser()],
  },
  // CJS
  {
    input: 'src/index.js',
    external: ['three'],
    output: {
      file:   'dist/turngl.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [resolve(), terser()],
  },
];
