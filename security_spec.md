# Puerta Cantera Residencial — Security Specification (Phase 0)

## 1. Data Invariants
1. **Admin-only Directory Control**: Only verified administrators (`isAdmin()`) may create, update, or delete records in `/houses`, `/residents`, `/notices`, `/feeHistory`, and `/admins`.
2. **PII Isolation**: `/residents/{residentId}` contains email, phone, and vehicle plates. Non-admin users may ONLY read their own resident record (`resource.data.ownerUid == request.auth.uid`), never list or read other residents.
3. **Immutable Audit Trail**: `/auditLogs/{logId}` is append-only by admins; updates and deletes are unconditionally denied (`allow update, delete: if false;`).
4. **Strict Ownership & Terminal State Locking**:
   - Residents may create `/payments`, `/reports`, and `/visits` ONLY with `ownerUid == request.auth.uid` and initial non-terminal statuses (`pending`, `open`, `active`).
   - Non-admin users cannot approve/adjust/reject payments, cannot modify resolved reports, and cannot uncancel cancelled visit passes.
5. **Temporal Integrity & Bounded Payloads**: Every created document must match `request.time` for `createdAt` / `updatedAt`; every string and list has explicit `.size()` bounds; every document ID matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Denied)
1. **Unauthenticated Resident Read**: `GET /residents/usr-1` with `auth = null`.
2. **Unverified Admin Email Spoof**: `GET /residents` with `email = omargarcialeal@gmail.com` and `email_verified = false`.
3. **Cross-User PII Leak**: Non-admin `uid-B` calling `GET /residents/usr-A` where `ownerUid = uid-A`.
4. **Non-Admin Resident Creation**: Non-admin `uid-B` calling `CREATE /residents/usr-new`.
5. **Privilege Escalation (Shadow Field)**: `CREATE /residents/usr-x` injecting `isSuperAdmin: true` outside `hasOnly()`.
6. **Self-Admin Promotion**: Non-admin `uid-B` calling `CREATE /admins/uid-B`.
7. **ID Poisoning**: `CREATE /houses/../../evil-1500-chars` failing `isValidId()`.
8. **Payment Self-Approval**: Non-admin creating `/payments/pay-1` with `status: 'approved'` or updating `status` from `'pending'` to `'approved'`.
9. **Terminal State Bypass**: Non-admin updating `/visits/pass-1` when existing `status == 'cancelled'`.
10. **Forged Timestamp**: `CREATE /notices/not-1` with client-backdated `createdAt != request.time`.
11. **Unbounded Array / Payload Exhaustion**: `CREATE /residents/usr-2` with `vehicleQrCodes.size() == 25` (> 10 max) or 500-char phone number.
12. **Audit Log Tampering**: Even admin attempting `UPDATE` or `DELETE` on `/auditLogs/aud-1`.
