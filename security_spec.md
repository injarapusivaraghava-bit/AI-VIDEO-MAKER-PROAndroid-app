# Security Specification — AI VIDEO MAKER PRO (Phase 0 TDD)

## 1. Data Invariants
1. **Master Gate & Ownership**: Every `/users/{userId}/projects/{projectId}` and `/users/{userId}/stats/{statsId}` document MUST belong to an existing parent `/users/{userId}` document (`exists(...)` on create) and have `ownerId == request.auth.uid == userId`.
2. **Verified Identity & Spoof Guard**: Every write requires `request.auth != null && request.auth.token.email_verified == true`. Admin checks require both `email_verified == true` and either the bootstrapped proprietor email (`injarapusivaraghava@gmail.com`) or a document in `/admins/{uid}`.
3. **Zero Privilege Escalation**: `UserProfile` strictly forbids `role` or `isAdmin` fields (`hasOnly(...)`). Only existing Admins can write `/admins/{userId}` or `/studioConfig/public`.
4. **PII Isolation**: User email is stored exclusively in `/users/{userId}/private/info` readable only by `isOwner(userId) || isAdmin()`. Blanket `allow read: if isSignedIn()` is forbidden everywhere.
5. **Immutable Audit & Temporal Integrity**: `uid`, `id`, `ownerId`, and `createdAt` are immutable once created. All `createdAt` and `updatedAt` timestamps MUST equal `request.time`.
6. **Volumetric & Payload Guards**: Path IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), all strings enforce explicit `.size()` ceilings, `scenes` array is bounded (`1..15` items, element `[0]` validated as map with string `id`), and `exportCount` increments only by `+1` per export action.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Project Create**: Anonymous caller tries to create `/users/u1/projects/p1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: Token has `email: "injarapusivaraghava@gmail.com"` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role (Shadow Field)**: User creates `/users/u1` with `{ uid: "u1", displayName: "Hack", role: "admin", isAdmin: true, createdAt, updatedAt }` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Project Injection**: User `u1` tries to create `/users/u2/projects/p1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
5. **OwnerId Spoofing on Create**: User `u1` creates `/users/u1/projects/p1` with `ownerId: "u2"` -> `PERMISSION_DENIED`.
6. **Orphaned Project Without Parent User**: User `u1` creates `/users/u1/projects/p1` before `/users/u1` exists -> `PERMISSION_DENIED`.
7. **PII Blanket Read / Cross-User Private Read**: User `u2` reads `/users/u1/private/info` -> `PERMISSION_DENIED`.
8. **Client-Forged Timestamp**: User `u1` writes `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
9. **Immutable OwnerId / CreatedAt Tampering**: User `u1` updates `/users/u1/projects/p1` changing `ownerId` or `createdAt` -> `PERMISSION_DENIED`.
10. **Path Variable ID Poisoning**: User `u1` writes project ID with 500-char junk string or spaces -> `PERMISSION_DENIED`.
11. **Value Poisoning / Oversized Scenes Array**: User `u1` writes `scenes: [20 items]` or `title: <500 chars>` or `exportCount: 999999` -> `PERMISSION_DENIED`.
12. **Non-Admin StudioConfig Write / Export Jump**: Regular creator attempts to update `/studioConfig/public` or set `exportCount` from `0` to `500` in one update -> `PERMISSION_DENIED`.
