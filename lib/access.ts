import { getFirestoreDocument, writeFirestoreDocuments } from '@/lib/firestore-rest';

export type AccessRole =
  | 'god-admin'
  | 'super-admin'
  | 'admin-secretary-general'
  | 'admin-manager'
  | 'admin-tef'
  | 'admin-inspector'
  | 'general';

export type AllowedUser = {
  email: string;
  name: string;
  role: AccessRole;
  displayRole: string;
  /** Must enter Admin mode (API password) before recording any transaction. */
  canEnterAdminMode: boolean;
  /** Create/edit master stock_items records. No UI/API wired up for this yet. */
  canManageStock: boolean;
  /** Create new allocations (assign a BIB to a rider). No UI/API wired up for this yet. */
  canManageAllocations: boolean;
  /** Record เบิก/จ่าย/คืน/ย้าย transactions (updates an existing allocation's location/status). */
  canRecordTransaction: boolean;
  canComment: boolean;
  /** Add/edit/deactivate other users' roles via the Manage Users screen. */
  canManageUsers: boolean;
};

export type Capabilities = Pick<
  AllowedUser,
  | 'canEnterAdminMode'
  | 'canManageStock'
  | 'canManageAllocations'
  | 'canRecordTransaction'
  | 'canComment'
  | 'canManageUsers'
>;

const NONE: Capabilities = {
  canEnterAdminMode: false,
  canManageStock: false,
  canManageAllocations: false,
  canRecordTransaction: false,
  canComment: false,
  canManageUsers: false,
};

/** God/Super Admin: full control, but must re-enter the Admin-mode password before every transaction. */
const TOP_ADMIN: Capabilities = {
  canEnterAdminMode: true,
  canManageStock: true,
  canManageAllocations: true,
  canRecordTransaction: true,
  canComment: true,
  canManageUsers: true,
};

/** Office-level Admin User (Secretary General / Manager / TEF): full day-to-day management, no password gate. */
const OFFICE_ADMIN: Capabilities = {
  canEnterAdminMode: false,
  canManageStock: true,
  canManageAllocations: true,
  canRecordTransaction: true,
  canComment: true,
  canManageUsers: false,
};

/** Field role (Riding Establishment Inspector): can log movements/status on existing BIBs only. */
const FIELD_ADMIN: Capabilities = {
  canEnterAdminMode: false,
  canManageStock: false,
  canManageAllocations: false,
  canRecordTransaction: true,
  canComment: true,
  canManageUsers: false,
};

function user(
  email: string,
  name: string,
  role: AccessRole,
  displayRole: string,
  capabilities: Capabilities = NONE,
): AllowedUser {
  return { email, name, role, displayRole, ...capabilities };
}

/**
 * Bootstrap / fail-safe list. This is Database V2's fallback layer only —
 * the source of truth for role assignments is the Firestore `admin_users`
 * collection (see resolveAllowedUser below), which the "Manage Users" screen
 * edits directly with no code deploy required. Keep at minimum the God Admin
 * and Super Admin rows here so there is always a way in even if Firestore is
 * unreachable or a deploy reverts this file.
 */
const FALLBACK_USERS: AllowedUser[] = [
  user('sweetminty1@gmail.com', 'God Admin', 'god-admin', 'God Admin', TOP_ADMIN),
  user('info@tefthailand.com', 'Super Admin', 'super-admin', 'Super Admin', TOP_ADMIN),
  user(
    'nara.k@tefthailand.com',
    'Nara Ketusingha',
    'admin-secretary-general',
    'เลขาธิการ (Secretary General)',
    OFFICE_ADMIN,
  ),
  user(
    'davin.s@tefthailand.com',
    'Davin S.',
    'admin-manager',
    'ผู้จัดการ (Manager)',
    OFFICE_ADMIN,
  ),
  user(
    'phalot.k@tefthailand.com',
    'Phalot Kerdsin',
    'admin-tef',
    'เจ้าหน้าที่ TEF (Admin User TEF)',
    OFFICE_ADMIN,
  ),
  user(
    'piyathida.y@tefthailand.com',
    'Piyathida Yodteerak',
    'admin-inspector',
    'ผู้ตรวจสอบสนามม้า (Riding Establishment Inspector)',
    FIELD_ADMIN,
  ),
  user(
    'surakij.u@tefthailand.com',
    'Surakij Udomphuech',
    'admin-inspector',
    'ผู้ตรวจสอบสนามม้า (Riding Establishment Inspector)',
    FIELD_ADMIN,
  ),
  // TBC: two more Riding Establishment Inspector seats — add them the same way once emails are known.
  user('gunwalada.m@tefthailand.com', 'Gunwalada M.', 'general', 'ผู้ใช้งานทั่วไป (General)'),
  user('angela.a@tefthailand.com', 'Angela A.', 'general', 'ผู้ใช้งานทั่วไป (General)'),
  user('ryan.e@tefthailand.com', 'Ryan E.', 'general', 'ผู้ใช้งานทั่วไป (General)'),
];

const ROLE_CAPABILITIES: Record<AccessRole, Capabilities> = {
  'god-admin': TOP_ADMIN,
  'super-admin': TOP_ADMIN,
  'admin-secretary-general': OFFICE_ADMIN,
  'admin-manager': OFFICE_ADMIN,
  'admin-tef': OFFICE_ADMIN,
  'admin-inspector': FIELD_ADMIN,
  general: NONE,
};

export const ROLE_LABELS: Record<AccessRole, string> = {
  'god-admin': 'God Admin',
  'super-admin': 'Super Admin',
  'admin-secretary-general': 'เลขาธิการ (Secretary General)',
  'admin-manager': 'ผู้จัดการ (Manager)',
  'admin-tef': 'เจ้าหน้าที่ TEF (Admin User TEF)',
  'admin-inspector': 'ผู้ตรวจสอบสนามม้า (Riding Establishment Inspector)',
  general: 'ผู้ใช้งานทั่วไป (General)',
};

export function capabilitiesForRole(role: AccessRole): Capabilities {
  return ROLE_CAPABILITIES[role] ?? NONE;
}

/** Sync, hardcoded-only lookup. Used only where no Firebase token is available. */
export function getAllowedUser(email: string) {
  const normalized = email.trim().toLowerCase();
  return FALLBACK_USERS.find((allowedUser) => allowedUser.email === normalized) ?? null;
}

export function listAllowedEmails() {
  return FALLBACK_USERS.map((allowedUser) => allowedUser.email);
}

function fallbackFor(normalizedEmail: string) {
  return (
    FALLBACK_USERS.find((allowedUser) => allowedUser.email === normalizedEmail) ?? null
  );
}

type AdminUserDoc = {
  name?: unknown;
  role?: unknown;
  displayRole?: unknown;
  active?: unknown;
};

function isAccessRole(value: unknown): value is AccessRole {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ROLE_CAPABILITIES, value)
  );
}

/**
 * Database V2 lookup: Firestore `admin_users/{email}` is the source of truth,
 * editable live from the Manage Users screen with no code deploy. Falls back
 * to the hardcoded bootstrap list when Firestore has no record yet (or is
 * unreachable), and lazily self-seeds that fallback into Firestore so future
 * edits persist. Never overwrites an existing Firestore doc.
 */
export async function resolveAllowedUser(
  email: string,
  token: string,
): Promise<AllowedUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  let doc: AdminUserDoc | null = null;
  try {
    doc = (await getFirestoreDocument(token, 'admin_users', normalized)) as AdminUserDoc | null;
  } catch (error) {
    void error; // Firestore unreachable — fall through to the hardcoded list.
  }

  if (doc && isAccessRole(doc.role) && doc.active !== false) {
    const role = doc.role;
    const name = typeof doc.name === 'string' && doc.name ? doc.name : normalized;
    const displayRole =
      typeof doc.displayRole === 'string' && doc.displayRole ? doc.displayRole : ROLE_LABELS[role];
    return { email: normalized, name, role, displayRole, ...capabilitiesForRole(role) };
  }
  if (doc && doc.active === false) return null; // explicitly deactivated

  const fallback = fallbackFor(normalized);
  if (fallback && !doc) {
    // First time we've seen this account resolve — seed Firestore so the
    // Manage Users screen can find and edit it going forward. Best-effort:
    // if this fails (e.g. rules reject it), the fallback still authorizes
    // this request from the hardcoded list.
    void writeFirestoreDocuments(token, [
      {
        collection: 'admin_users',
        id: normalized,
        record: {
          name: fallback.name,
          role: fallback.role,
          displayRole: fallback.displayRole,
          active: true,
          source: 'bootstrap',
        },
      },
    ]).catch(() => undefined);
  }
  return fallback;
}
