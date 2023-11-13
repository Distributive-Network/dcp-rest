/**
 * @file    .eslintrc.js - ESLint configuration file, following the Core Team's JS Style Guide.
 * @author  Wes Garland <wes@distributive.network>
 * @date    Mar. 2022
 */

'use strict';

/** 
 * @see {@link https://eslint.org/docs/latest/use/configure/}
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
  root: true,
  reportUnusedDisableDirectives: true,
  ignorePatterns: [
    'benchmarks',
    'branding',
    'examples',
    'www',
    'attic',
    'evaluator',
    'vendor',
    'dist',
  ],
  'extends': [
    'eslint:recommended',
    '@distributive',
  ],
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
    'node': true
  },
  globals: {
    dcpConfig: true
  },
  'parserOptions': {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  'rules': {}
};
