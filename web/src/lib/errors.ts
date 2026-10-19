import type { TFunction } from 'i18next'
import { ApiError } from './api'

export function errorMessage(t: TFunction, e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'generic'
  return t(`errors.${code}`, { defaultValue: t('errors.generic') })
}
