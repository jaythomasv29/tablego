/** ESLint 8 legacy configuration is compatible with Next 15's build-time checker. */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  ignorePatterns: ['.next/', 'node_modules/', 'public/'],
  rules: {
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
  },
};
