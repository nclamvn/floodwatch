/**
 * Report type labels and utilities
 */

export type ReportType = 'ALERT' | 'SOS' | 'ROAD' | 'RAIN' | 'NEEDS'

/**
 * Report type display names (Vietnamese)
 */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  ALERT: 'Cảnh báo',
  SOS: 'SOS',
  ROAD: 'Đường bộ',
  RAIN: 'Mưa lũ',
  NEEDS: 'Nhu yếu phẩm',
}

/**
 * Report type icons
 */
export const REPORT_TYPE_ICONS: Record<ReportType, string> = {
  ALERT: '⚠️',
  SOS: '🆘',
  ROAD: '🚧',
  RAIN: '🌊',
  NEEDS: '📦',
}

/**
 * Get Vietnamese label for report type
 */
export function getReportTypeLabel(type: string): string {
  return REPORT_TYPE_LABELS[type as ReportType] || type
}

/**
 * Get icon for report type
 */
export function getReportTypeIcon(type: string): string {
  return REPORT_TYPE_ICONS[type as ReportType] || 'ℹ️'
}
