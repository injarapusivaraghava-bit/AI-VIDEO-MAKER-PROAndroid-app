/**
 * Phase 0 Security Rules Verification Matrix ("Dirty Dozen" Payloads)
 * Intended for validation against Firebase Rules Emulator (`@firebase/rules-unit-testing`).
 */
export const DIRTY_DOZEN_CASES = [
  {
    id: 1,
    name: 'Unauthenticated project create',
    path: '/users/user1/projects/proj_1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email spoofing admin email',
    path: '/studioConfig/public',
    auth: { uid: 'attacker', email: 'injarapusivaraghava@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-assigned admin role shadow field in UserProfile',
    path: '/users/user1',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    payload: { uid: 'user1', displayName: 'User 1', role: 'admin', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-tenant project write',
    path: '/users/victim/projects/proj_1',
    auth: { uid: 'attacker', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'OwnerId mismatch on project create',
    path: '/users/user1/projects/proj_1',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    payload: { id: 'proj_1', ownerId: 'victim' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned project create without parent /users/{userId}',
    path: '/users/no_profile_user/projects/proj_1',
    auth: { uid: 'no_profile_user', email: 'orphan@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Cross-user PII read on /users/{userId}/private/info',
    path: '/users/user1/private/info',
    auth: { uid: 'user2', email: 'user2@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged createdAt timestamp instead of request.time',
    path: '/users/user1',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable createdAt tampering on project update',
    path: '/users/user1/projects/proj_1',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Path ID poisoning (>128 chars or invalid characters)',
    path: `/users/user1/projects/${'a'.repeat(160)}`,
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Oversized scenes array (>15 items) or oversized title (>200 chars)',
    path: '/users/user1/projects/proj_1',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-admin studioConfig update or arbitrary exportCount jump',
    path: '/studioConfig/public',
    auth: { uid: 'user1', email: 'user1@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
] as const;
