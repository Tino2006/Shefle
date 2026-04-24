/**
 * Postgres/node-pg reports undefined columns as 42703 or messages like
 * `column pt.approval_status does not exist` (qualified name).
 */
export function isMissingPortfolioApprovalColumn(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  const code = (error as { code?: string }).code;
  if (code === '42703' && msg.includes('approval_status')) return true;
  return msg.includes('approval_status') && /does not exist/i.test(msg);
}
