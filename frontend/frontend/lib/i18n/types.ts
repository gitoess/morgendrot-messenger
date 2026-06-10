import type { I18nResources } from '@/frontend/lib/i18n/resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: I18nResources
  }
}

export {}
