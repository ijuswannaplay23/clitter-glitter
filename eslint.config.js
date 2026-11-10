import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const UI_LIBS = [
  'react',
  'react-dom',
  'react-dom/*',
  'react-router',
  'react-router-dom',
  'dexie-react-hooks',
];
const STORAGE_LIBS = ['dexie', '@supabase/*'];

// Dependencies point downward: domain <- scoring <- data <- features <- ui/app.
// Each layer lists what it must NOT import; the build fails if it does.
const layer = (dir, banned, message) => ({
  files: [`src/${dir}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: banned, message }] }],
  },
});

const upward = (...names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['**/*.{js,mjs}'], ...tseslint.configs.disableTypeChecked },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['src/**/*.{ts,tsx}'], ...reactHooks.configs.flat.recommended },
  layer(
    'domain',
    [...upward('scoring', 'data', 'features', 'ui'), ...UI_LIBS, ...STORAGE_LIBS],
    'domain/ is types and schemas only; it may import zod and nothing else.',
  ),
  layer(
    'scoring',
    [...upward('data', 'features', 'ui'), ...UI_LIBS, ...STORAGE_LIBS],
    'scoring/ must stay pure: import only domain/ and zod.',
  ),
  layer(
    'data',
    [...upward('features', 'ui'), ...UI_LIBS],
    'data/ may import domain/ and scoring/ only.',
  ),
  layer(
    'ui',
    upward('features', 'data'),
    'ui/ is shared presentation; it must not import features/ or data/.',
  ),
);
