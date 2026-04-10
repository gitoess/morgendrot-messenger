import tseslint from 'typescript-eslint'

/** @see docs/MESSENGER-UI-MODULARITY-STRATEGY.md — Import-Richtung features/send ↔ features/inbox */
const inboxAliasPatterns = [
  '@/frontend/features/inbox',
  '@/frontend/features/inbox/*',
  '@/frontend/features/inbox/**/*',
]
const sendAliasPatterns = [
  '@/frontend/features/send',
  '@/frontend/features/send/*',
  '@/frontend/features/send/**/*',
]

const restrictedImportsMsgSend =
  'features/send must not import features/inbox — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgInbox =
  'features/inbox must not import features/send — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'

export default tseslint.config(
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    files: ['frontend/features/send/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: inboxAliasPatterns.map((g) => ({
            group: [g],
            message: restrictedImportsMsgSend,
          })),
        },
      ],
    },
  },
  {
    files: ['frontend/features/inbox/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: sendAliasPatterns.map((g) => ({
            group: [g],
            message: restrictedImportsMsgInbox,
          })),
        },
      ],
    },
  },
)
