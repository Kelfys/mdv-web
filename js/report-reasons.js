/**
 * Motivos de denúncia — compartilhado entre UI e API.
 */
import { t } from './strings.js'

export const REPORT_REASONS = [
  { id: 'inappropriate', label: () => t('report.reasonInappropriate') },
  { id: 'misleading', label: () => t('report.reasonMisleading') },
  { id: 'counterfeit', label: () => t('report.reasonCounterfeit') },
  { id: 'scam', label: () => t('report.reasonScam') },
  { id: 'spam', label: () => t('report.reasonSpam') },
  { id: 'offensive', label: () => t('report.reasonOffensive') },
  { id: 'copyright', label: () => t('report.reasonCopyright') },
  { id: 'privacy', label: () => t('report.reasonPrivacy') },
  { id: 'other', label: () => t('report.reasonOther') },
]

export const REPORT_REASON_IDS = new Set(REPORT_REASONS.map((reason) => reason.id))

export function getReportReasonLabel(reason) {
  const match = REPORT_REASONS.find((item) => item.id === reason)
  return match ? match.label() : reason
}