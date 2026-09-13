import {
  capabilitiesForRole,
  listAllowedEmails,
  ROLE_LABELS,
  resolveAllowedUser,
  type AccessRole,
} from '@/lib/access';
import { listFirestoreCollection, writeFirestoreDocuments, firestoreRecord } from '@/lib/firestore-rest';

export const runtime = 'nodejs';

const ROLES = Object.keys(ROLE_LABELS) as AccessRole[];

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

async function requireManager(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    ) as { email?: string };
    if (!decoded.email) return null;
    const viewer = await resolveAllowedUser(decoded.email, token);
    if (!viewer || !viewer.canManageUsers) return null;
    return { token, viewer };
  } catch {
    return null;
  }
}

// GET: list every user this org has assigned a role to — merges live
// Firestore admin_users records with the hardcoded bootstrap list (for any
// account that hasn't logged in yet, and so has no Firestore doc).
export async function GET(request: Request) {
  const manager = await requireManager(request);
  if (!manager) return unauthorized('เฉพาะ God Admin / Super Admin เท่านั้นที่จัดการผู้ใช้งานได้');

  try {
    const documents = await listFirestoreCollection(manager.token, 'admin_users');
    const byEmail = new Map<string, Record<string, unknown>>();
    for (const document of documents) {
      const email = document.name.split('/').pop() ?? '';
      byEmail.set(email, { email, ...firestoreRecord(document) });
    }
    for (const email of listAllowedEmails()) {
      if (!byEmail.has(email)) {
        const fallbackViewer = await resolveAllowedUser(email, manager.token).catch(() => null);
        if (fallbackViewer) {
          byEmail.set(email, {
            email,
            name: fallbackViewer.name,
            role: fallbackViewer.role,
            displayRole: fallbackViewer.displayRole,
            active: true,
            source: 'bootstrap',
          });
        }
      }
    }
    const users = Array.from(byEmail.values()).sort((a, b) =>
      String(a.email).localeCompare(String(b.email)),
    );
    return Response.json({ users, roles: ROLES.map((role) => ({ role, label: ROLE_LABELS[role] })) });
  } catch (error) {
    return Response.json(
      { error: 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ', detail: String(error) },
      { status: 502 },
    );
  }
}

// POST: create or update one user's role assignment.
export async function POST(request: Request) {
  const manager = await requireManager(request);
  if (!manager) return unauthorized('เฉพาะ God Admin / Super Admin เท่านั้นที่จัดการผู้ใช้งานได้');

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    role?: string;
    active?: boolean;
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) return badRequest('กรุณาระบุอีเมลให้ถูกต้อง');
  if (!body.role || !ROLES.includes(body.role as AccessRole)) {
    return badRequest('กรุณาเลือกบทบาท (role) ที่ถูกต้อง');
  }
  const role = body.role as AccessRole;
  const name = body.name?.trim() || email;
  const active = body.active !== false;

  try {
    await writeFirestoreDocuments(manager.token, [
      {
        collection: 'admin_users',
        id: email,
        record: {
          name,
          role,
          displayRole: ROLE_LABELS[role],
          active,
          source: 'manage-users',
          updatedBy: manager.viewer.email,
          updatedAt: new Date().toISOString(),
        },
      },
    ]);
    return Response.json({ ok: true, user: { email, name, role, ...capabilitiesForRole(role), active } });
  } catch (error) {
    return Response.json(
      { error: 'บันทึกสิทธิ์ผู้ใช้งานไม่สำเร็จ', detail: String(error) },
      { status: 502 },
    );
  }
}
