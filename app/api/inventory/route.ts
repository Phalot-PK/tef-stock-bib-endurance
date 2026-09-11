import { getAllowedUser } from '@/lib/access';
import {
  applyFirestoreTransaction,
  loadFirestoreInventory,
} from '@/lib/firestore-rest';

export const runtime = 'nodejs';

type AllowedUser = NonNullable<ReturnType<typeof getAllowedUser>>;

type FirebaseSession = {
  token: string;
  viewer: AllowedUser;
};

function authenticatedEmail(request: Request) {
  return request.headers.get('oai-authenticated-user-email')?.trim() || '';
}

function firebaseSession(request: Request): FirebaseSession | null {
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
    const viewer = decoded.email ? getAllowedUser(decoded.email) : null;
    return viewer ? { token, viewer } : null;
  } catch {
    return null;
  }
}

function viewerPayload(viewer: AllowedUser) {
  return {
    email: viewer.email,
    name: viewer.name,
    role: viewer.role === 'secret-admin' ? 'viewer' : viewer.role,
    displayRole: viewer.displayRole,
    canEnterAdminMode: viewer.canEnterAdminMode,
    canComment: viewer.canComment,
    adminModeAvailable: Boolean(
      process.env.ADMIN_MODE_PASSWORD_PRIMARY ||
        process.env.ADMIN_MODE_PASSWORD_SECONDARY,
    ),
  };
}

function isAdminPasswordValid(password: string) {
  const configured = [
    process.env.ADMIN_MODE_PASSWORD_PRIMARY,
    process.env.ADMIN_MODE_PASSWORD_SECONDARY,
  ].filter((value): value is string => Boolean(value));
  return Boolean(password) && configured.some((candidate) => candidate === password);
}

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 403 });
}

export async function GET(request: Request) {
  const firebase = firebaseSession(request);
  if (!firebase) {
    const allowed = getAllowedUser(authenticatedEmail(request));
    return unauthorized(
      allowed
        ? 'กรุณาเข้าสู่ระบบด้วย Google เพื่อเชื่อมต่อ Firestore'
        : 'บัญชีนี้ยังไม่ได้รับอนุญาตให้ใช้ระบบ',
    );
  }

  try {
    const inventory = await loadFirestoreInventory(firebase.token);
    return Response.json({ viewer: viewerPayload(firebase.viewer), ...inventory });
  } catch (error) {
    return Response.json(
      { error: 'เชื่อมต่อ Firestore ไม่สำเร็จ', detail: String(error) },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const firebase = firebaseSession(request);
  if (!firebase) return unauthorized('กรุณาเข้าสู่ระบบด้วย Google');

  const viewer = firebase.viewer;
  if (!viewer.canEnterAdminMode) {
    return unauthorized('บัญชีนี้ไม่มีสิทธิ์เข้าสู่โหมด Admin');
  }

  const body = (await request.json()) as {
    intent?: 'enter-admin' | 'transaction';
    allocationId?: number;
    action?: string;
    person?: string;
    destination?: string;
    note?: string;
    adminPassword?: string;
  };

  if (!isAdminPasswordValid(body.adminPassword ?? '')) {
    return unauthorized('รหัสโหมด Admin ไม่ถูกต้อง หรือยังไม่ได้ตั้งค่ารหัสใน API');
  }
  if (body.intent === 'enter-admin') return Response.json({ ok: true });

  if (!body.allocationId || !body.action || !body.person?.trim()) {
    return Response.json(
      { error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ' },
      { status: 400 },
    );
  }
  if (!['เบิก', 'จ่าย', 'คืน', 'ย้าย'].includes(body.action)) {
    return Response.json({ error: 'ประเภทรายการไม่ถูกต้อง' }, { status: 400 });
  }

  try {
    const result = await applyFirestoreTransaction(
      firebase.token,
      Number(body.allocationId),
      body.action,
      body.person.trim(),
      body.destination?.trim() ?? '',
      body.note?.trim() ?? '',
    );
    return Response.json(
      'error' in result ? { error: result.error } : result,
      'status' in result ? { status: result.status } : undefined,
    );
  } catch (error) {
    return Response.json(
      { error: 'บันทึกรายการลง Firestore ไม่สำเร็จ', detail: String(error) },
      { status: 502 },
    );
  }
}
