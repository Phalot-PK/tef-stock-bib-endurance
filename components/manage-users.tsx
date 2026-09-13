'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getFirebaseIdToken,
  isFirebaseAuthEnabled,
  subscribeToFirebaseAuth,
} from '@/lib/firebase-client';

type RoleOption = { role: string; label: string };
type UserRow = {
  email: string;
  name: string;
  role: string;
  displayRole?: string;
  active?: boolean;
  source?: string;
};

const ROLE_BADGE: Record<string, string> = {
  'god-admin': 'bg-[#c9a227] text-[#1f2a24]',
  'super-admin': 'bg-[#c9a227] text-[#1f2a24]',
  'admin-secretary-general': 'bg-[#e6f6ec] text-[#1a7a43]',
  'admin-manager': 'bg-[#e6f6ec] text-[#1a7a43]',
  'admin-tef': 'bg-[#e6f6ec] text-[#1a7a43]',
  'admin-inspector': 'bg-[#e8f0fe] text-[#1e4fb8]',
  general: 'bg-[#eef1ef] text-[#6b756f]',
};

export function ManageUsers() {
  const [firebaseAuthEnabled, setFirebaseAuthEnabled] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<{ email?: string } | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingEmail, setSavingEmail] = useState('');
  const [form, setForm] = useState({ email: '', name: '', role: 'general' });
  const [adding, setAdding] = useState(false);

  const requestHeaders = async (extra: Record<string, string> = {}) => {
    const token = await getFirebaseIdToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  };

  const load = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        cache: 'no-store',
        headers: await requestHeaders(),
      });
      const body = (await response.json()) as { users?: UserRow[]; roles?: RoleOption[]; error?: string };
      if (!response.ok) {
        setError(body.error || 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ');
        return;
      }
      setUsers(body.users ?? []);
      setRoles(body.roles ?? []);
      setError('');
    } catch {
      setError('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  useEffect(() => {
    const enabled = isFirebaseAuthEnabled();
    setFirebaseAuthEnabled(enabled);
    if (!enabled) {
      setFirebaseAuthReady(true);
      return;
    }
    return subscribeToFirebaseAuth((user) => {
      setFirebaseUser(user ? { email: user.email ?? '' } : null);
      setFirebaseAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!firebaseAuthReady) return;
    if (firebaseAuthEnabled && !firebaseUser) {
      setError('กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาต');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseAuthEnabled, firebaseAuthReady, firebaseUser]);

  const saveRole = async (email: string, name: string, role: string, active: boolean) => {
    setSavingEmail(email);
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: await requestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email, name, role, active }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      setMessage(`อัปเดตสิทธิ์ของ ${email} เรียบร้อย`);
      await load();
    } finally {
      setSavingEmail('');
    }
  };

  const addUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.email.trim()) return;
    setAdding(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: await requestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim() || form.email.trim(),
          role: form.role,
          active: true,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error || 'เพิ่มผู้ใช้งานไม่สำเร็จ');
        return;
      }
      setMessage(`เพิ่ม ${form.email} เรียบร้อย`);
      setForm({ email: '', name: '', role: 'general' });
      await load();
    } finally {
      setAdding(false);
    }
  };

  return (
    <main className="tef-theme min-h-screen text-foreground">
      <header className="border-b border-white/15 bg-[var(--tef-green-dark)] text-primary-foreground">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Manage Users — จัดการสิทธิ์ผู้ใช้งาน</h1>
            <p className="text-sm font-semibold text-[#eafaf0]">
              Database V2 · เปลี่ยนบทบาทมีผลทันทีโดยไม่ต้อง deploy โค้ดใหม่
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
          >
            ← กลับสู่ Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-5 py-7 lg:px-8">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <section className="mb-6 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-1 font-semibold">เพิ่มผู้ใช้งานใหม่ / Add user</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            เพิ่มด้วยอีเมล Google ของผู้ใช้งาน — บทบาทมีผลตั้งแต่ครั้งแรกที่เข้าสู่ระบบ
          </p>
          <form onSubmit={addUser} className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
            <div className="grid gap-1">
              <label className="text-xs font-semibold text-muted-foreground">อีเมล / Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@tefthailand.com"
                className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--tef-green)]"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-semibold text-muted-foreground">ชื่อ / Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ชื่อ-นามสกุล"
                className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--tef-green)]"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-semibold text-muted-foreground">บทบาท / Role</label>
              <NativeSelect value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {(roles.length ? roles : []).map((r) => (
                  <NativeSelectOption key={r.role} value={r.role}>
                    {r.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="h-10 rounded-lg bg-[var(--tef-green)] px-5 text-sm font-semibold text-white hover:bg-[var(--tef-green-dark)] disabled:opacity-60"
            >
              {adding ? 'กำลังเพิ่ม…' : '+ เพิ่มผู้ใช้งาน'}
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">รายชื่อผู้ใช้งานทั้งหมด / All users</h2>
            <p className="text-sm text-muted-foreground">
              เปลี่ยนบทบาทได้ทันทีจากเมนูด้านล่าง — ระบบจะบันทึกลง Firestore (admin_users)
            </p>
          </div>
          {!users ? (
            <div className="p-6 text-sm text-muted-foreground">กำลังโหลดรายชื่อผู้ใช้งาน…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>บทบาทปัจจุบัน</TableHead>
                    <TableHead>เปลี่ยนบทบาท</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.email}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground'}`}>
                          {u.displayRole ?? u.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          value={u.role}
                          disabled={savingEmail === u.email}
                          onChange={(e) => void saveRole(u.email, u.name, e.target.value, u.active !== false)}
                        >
                          {(roles.length ? roles : []).map((r) => (
                            <NativeSelectOption key={r.role} value={r.role}>
                              {r.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          disabled={savingEmail === u.email}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            u.active === false
                              ? 'bg-[#e6f6ec] text-[#1a7a43] hover:bg-[#d5f0e0]'
                              : 'bg-[#fdf1de] text-[#a4650b] hover:bg-[#fbe6c4]'
                          }`}
                          onClick={() => void saveRole(u.email, u.name, u.role, u.active === false)}
                        >
                          {u.active === false ? 'เปิดใช้งาน / Activate' : 'ระงับ / Deactivate'}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
