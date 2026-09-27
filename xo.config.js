/**
Xo 5 flat config. Every override carries its reason; a rule turned off without a reason is a review finding.
@type {import('xo').FlatXoConfig}
*/
const xoConfig = [
  {
    // The type fixture imports the built package, so it only resolves after a build; the consumer fixtures type-check it against the installed tarball instead.
    // The capture scripts ran in scratch projects against the old package and are kept exactly as they were run; the golden JSON files are captured data.
    // The TypeScript 5 fixture uses `import = require()` on purpose and is compiled by its own TypeScript in the consumer workspace.
    // The hogan.js oracle's capture script ran in a scratch project, like the golden capture.
    // release-notes.md is written by release.yml from CHANGELOG.md before it lints; its link definition may go unused there.
    ignores: ['ai-docs/**', 'release-notes.md', 'test/consumers/types/**', 'test/consumers/ts5-cjs-interop-off/**', 'test/golden/*.cjs', 'test/golden/*.json', 'test/unit/hogan/**'],
  },
  {
    files: ['**/*.md'],
    rules: {
      // The docs write intervals such as [0, max], which read as link labels to this rule.
      'markdown/no-missing-label-refs': 'off',
    },
  },
  {
    space: 2,
    rules: {
      // The `v` flag is a syntax error in Safari 16 and Chrome before 112, which would stop the library loading at all in those browsers; `u` works everywhere.
      'require-unicode-regexp': ['error', {requireFlag: 'u'}],
    },
  },
  {
    files: ['package.json'],
    rules: {
      // The shape publint and attw approved in every resolution mode: main, module and types stay for older resolvers, and the declaration files are found by sibling name, so no types or default conditions.
      'package-json/prefer-exports': 'off',
      'package-json/require-default-condition': 'off',
      'package-json/require-types-in-exports': 'off',
      // Npm always publishes package.json, whatever `files` says.
      'package-json/prefer-files-field': 'off',
      // Trusted publishing matches repository.url exactly, so it stays spelled out.
      'package-json/prefer-shorthand': 'off',
      // Deliberate pins: tsdown is pre-1.0 and pinned exactly; TypeScript stays on the line xo and tsdown declare.
      'package-json/dependency-version-range': 'off',
    },
  },
  {
    // The tests and consumer fixtures replace fetch on purpose, to send the package's requests to the local fixture server.
    // The wrapper objects are the odd inputs the golden capture recorded.
    files: ['test/**/*.{js,cjs,mjs,ts}'],
    rules: {
      'unicorn/no-global-object-property-assignment': 'off',
      'no-new-wrappers': 'off',
      'unicorn/new-for-builtins': 'off',
    },
  },
  {
    files: ['test/**/*.{js,cjs,mjs,ts}'],
    rules: {
      // The test scripts name their files, so helpers, fixtures and capture scripts can live under test/.
      'node-test/no-import-test-files': 'off',
      // Table-driven tests: an assertion per row of a fixed, non-empty table.
      'node-test/no-conditional-assertion': 'off',
      'no-await-in-loop': 'off',
      // Skips that depend on the runtime (Bun and Deno are opt-in), never forgotten ones.
      'node-test/no-skip-test': 'off',
    },
  },
  {
    // Each golden test calls the helper for its kind of case, and the helpers assert.
    files: ['test/golden/golden.test.js'],
    rules: {
      'node-test/require-assertion': 'off',
    },
  },
  {
    // CommonJS on purpose: this fixture proves require() works.
    files: ['test/consumers/cjs-node/**/*.js'],
    rules: {
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  {
    // The fixture projects model consumers: some are CommonJS on purpose, and none needs engines.
    files: ['test/consumers/**/package.json'],
    rules: {
      'package-json/prefer-type-module': 'off',
      'package-json/require-engines': 'off',
    },
  },
];

export default xoConfig;
