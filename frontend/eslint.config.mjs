import tseslint from 'typescript-eslint'

/** @see docs/MESSENGER-UI-MODULARITY-STRATEGY.md — Import-Richtung zwischen Feature-Ordnern */
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
const attachmentsAliasPatterns = [
  '@/frontend/features/attachments',
  '@/frontend/features/attachments/*',
  '@/frontend/features/attachments/**/*',
]

const restrictedImportsMsgSend =
  'features/send must not import features/inbox — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgInboxFromSend =
  'features/inbox must not import features/send — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgInboxFromAttachments =
  'features/inbox must not import features/attachments — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgAttachmentsFromInbox =
  'features/attachments must not import features/inbox — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgSendFromAttachments =
  'features/send must not import features/attachments — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'
const restrictedImportsMsgAttachmentsFromSend =
  'features/attachments must not import features/send — use shared types, lib/, or parent orchestration (MESSENGER-UI-MODULARITY-STRATEGY).'

export default tseslint.config(
  {
    ignores: ['**/.next/**', '**/node_modules/**', '**/dist/**'],
  },
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
          patterns: [
            ...inboxAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgSend,
            })),
            ...attachmentsAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgSendFromAttachments,
            })),
          ],
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
          patterns: [
            ...sendAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgInboxFromSend,
            })),
            ...attachmentsAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgInboxFromAttachments,
            })),
          ],
        },
      ],
    },
  },
  {
    files: ['frontend/features/attachments/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...inboxAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgAttachmentsFromInbox,
            })),
            ...sendAliasPatterns.map((g) => ({
              group: [g],
              message: restrictedImportsMsgAttachmentsFromSend,
            })),
          ],
        },
      ],
    },
  },
)
