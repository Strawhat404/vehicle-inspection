import { query } from '../db.js';
import { logAuditEvent } from '../utils/audit.js';

const HIGH_PRIV = new Set(['Administrator', 'Data Engineer']);

export async function detectPrivilegeEscalation({ actorUserId, actorRole, action, targetUserId, assignedRole }) {
  if (action !== 'iam.user.create' && action !== 'iam.user.role_update') return null;

  const escalation = HIGH_PRIV.has(String(assignedRole || ''));
  if (!escalation) return null;

  await query(
    `INSERT INTO security_alerts (actor_user_id, alert_type, severity, details)
     VALUES (?, 'privilege_escalation_attempt', 'critical', ?)`,
    [actorUserId, JSON.stringify({ action, targetUserId, assignedRole })]
  );

  await logAuditEvent({
    actorUserId,
    actorRole,
    action: 'security.privilege_escalation_detected',
    targetTable: 'security_alerts',
    targetRecordId: targetUserId,
    details: { assignedRole }
  });

  return { alert: 'privilege_escalation_detected' };
}
