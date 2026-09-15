'use client';

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
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
  signInWithGoogle,
  signOutFromFirebase,
  subscribeToFirebaseAuth,
} from '@/lib/firebase-client';

type Allocation = {
  id: number;
  event: string;
  color: string;
  color_detail?: string;
  bib_confirm: number;
  bib_sign: number;
  rider?: string;
  club?: string;
  initial_location: string;
  current_location: string;
  current_status: string;
  craw_qty?: number;
  last_event?: string;
  remark?: string;
  stock_code: string;
  stock_color: string;
  match_status: string;
};
type Transaction = {
  id: number;
  allocation_id: number;
  action: string;
  person: string;
  from_location: string;
  to_location: string;
  note: string;
  created_at: string;
  bib_confirm: number;
  color: string;
  event: string;
};
type Stock = {
  id: number;
  code: string;
  event: string;
  color: string;
  bib: number | string;
  value: number;
};
type Payload = {
  viewer: {
    email: string;
    name: string;
    role:
      | 'god-admin'
      | 'super-admin'
      | 'admin-secretary-general'
      | 'admin-manager'
      | 'admin-tef'
      | 'admin-inspector'
      | 'general'
      | string;
    displayRole: string;
    canEnterAdminMode: boolean;
    canManageStock: boolean;
    canManageAllocations: boolean;
    canRecordTransaction: boolean;
    canComment: boolean;
    canManageUsers: boolean;
    adminModeAvailable: boolean;
  };
  allocations: Allocation[];
  transactions: Transaction[];
  stock: Stock[];
};

const locationClass = (location: string) =>
  location === 'Thai Polo'
    ? 'bg-rose-100 text-rose-800'
    : location === 'TEF Office' || location === 'สำนักงาน/สมาคม'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-sky-100 text-sky-800';
const colorDot: Record<string, string> = {
  White: 'bg-white border',
  'White (ขาว)': 'bg-white border',
  Orange: 'bg-orange-400',
  'Orange (ส้ม)': 'bg-orange-400',
  Lemon: 'bg-yellow-300',
  'Lemon (หรือ Green)': 'bg-yellow-300',
  Green: 'bg-green-500',
  Blue: 'bg-blue-600',
  Photo: 'bg-violet-500',
  'Green khaki': 'bg-lime-700',
};
const stockGroup = (item: Pick<Stock, 'code'>) =>
  item.code.startsWith('J_BLUE')
    ? 'เสื้อกรรมการ / Officials'
    : item.code.startsWith('Photo')
      ? 'เสื้อ Photo / Photo'
      : 'เสื้อ BIB / Numbered BIB';
const printedRole = (code: string) => {
  const baseCode = code.match(/^(J_BLUE\d{3}|Photo_EN)/)?.[1] ?? '';
  const roles: Record<string, string> = {
    J_BLUE001: 'President Ground Jury',
    J_BLUE002: 'Ground Jury',
    J_BLUE003: 'Technical Delegate',
    J_BLUE004: 'Chief Steward',
    J_BLUE005: 'Steward',
    J_BLUE006: 'Commission VET President',
    J_BLUE007: 'Commission VET member',
    J_BLUE008: 'Assistant VET',
    J_BLUE009: 'Treating VET President',
    J_BLUE010: 'Treating VET',
    J_BLUE011: 'VSM',
    J_BLUE012: 'TEF',
    J_BLUE013: 'OC',
    J_BLUE014: 'Track Master',
    J_BLUE015: 'Official',
    Photo_EN: 'Photographer',
  };
  return roles[baseCode] ?? '';
};
const actionDefinitions = [
  {
    value: 'เบิก',
    title: 'เบิก / Withdraw / Request',
    description: 'ขอรับเสื้อจากคลังเพื่อนำไปใช้งานตามหน้าที่',
    english: 'Request an item from stock for operational use.',
  },
  {
    value: 'จ่าย',
    title: 'จ่าย / Disburse / Issue',
    description: 'เจ้าหน้าที่ตรวจสอบแล้วส่งมอบเสื้อให้ผู้เบิกหรือผู้รับ',
    english: 'Verify and hand the requested item to the recipient.',
  },
  {
    value: 'คืน',
    title: 'คืน / Return',
    description: 'นำเสื้อที่เหลือหรือใช้เสร็จแล้วกลับเข้าคลัง',
    english: 'Return unused or completed-use items to stock.',
  },
  {
    value: 'ย้าย',
    title: 'ย้าย / Transfer',
    description: 'เปลี่ยนสถานที่เก็บหรือผู้ดูแล โดยเสื้อยังไม่ถูกใช้หมด',
    english: 'Move an item to another location or responsible owner.',
  },
] as const;

export function InventoryApp({
  initialStockOnly = false,
  initialHistoryOnly = false,
}: {
  initialStockOnly?: boolean;
  initialHistoryOnly?: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [firebaseAuthEnabled, setFirebaseAuthEnabled] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<{ email?: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('ทั้งหมด');
  const [color, setColor] = useState('ทั้งหมด');
  const [stockGroupFilter, setStockGroupFilter] = useState('ทั้งหมด');
  const tab: 'q3' | 'stock' | 'history' = initialStockOnly
    ? 'stock'
    : initialHistoryOnly
      ? 'history'
      : 'q3';
  const [open, setOpen] = useState(false);
  const [adminGateOpen, setAdminGateOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    allocationId: '',
    action: 'เบิก',
    person: '',
    destination: 'สำนักงาน/สมาคม',
    note: '',
  });

  const requestHeaders = async (extra: Record<string, string> = {}) => {
    const token = await getFirebaseIdToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  };

  const load = async () => {
    try {
      const response = await fetch('/api/inventory', {
        cache: 'no-store',
        headers: await requestHeaders(),
      });
      if (!response.ok) {
        const errorJson = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const errorMsg = errorJson.detail
          ? `${errorJson.error || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ'}: ${errorJson.detail}`
          : errorJson.error || 'โหลดข้อมูลไม่สำเร็จ';
        throw new Error(errorMsg);
      }
      setData(await response.json());
      setError('');
    } catch (loadError) {
      setError(
        firebaseAuthEnabled && !firebaseUser
          ? 'กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาต'
          : loadError instanceof Error
            ? loadError.message
            : 'ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่',
      );
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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [firebaseAuthEnabled, firebaseAuthReady, firebaseUser]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.allocations.filter((item) => {
      const matchesQuery =
        !q ||
        [
          item.bib_confirm,
          item.bib_sign,
          item.event,
          item.color,
          item.color_detail,
          item.stock_code,
          item.stock_color,
          item.current_location,
          item.current_status,
          item.remark,
          item.rider,
          item.club,
        ].some((v) => String(v ?? '').toLowerCase().includes(q));

      const matchesLocation =
        location === 'ทั้งหมด' || item.current_location === location;

      const matchesColor =
        color === 'ทั้งหมด' ||
        item.color.toLowerCase() === color.toLowerCase() ||
        String(item.color_detail ?? '').toLowerCase().includes(color.toLowerCase());

      return matchesQuery && matchesLocation && matchesColor;
    });
  }, [data, search, location, color]);
  const stockFiltered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.stock.filter(
      (item) =>
        (!q ||
          [
            item.code,
            item.event,
            item.color,
            item.bib,
            printedRole(item.code),
          ].some((v) => String(v).toLowerCase().includes(q))) &&
        (stockGroupFilter === 'ทั้งหมด' || stockGroupFilter === 'ทั้งหมด / All groups' || stockGroup(item) === stockGroupFilter),
    );
  }, [data, search, stockGroupFilter]);
  const isAdmin = Boolean(
    (data?.viewer.canEnterAdminMode && adminMode) ||
      (data?.viewer.canRecordTransaction && !data?.viewer.canEnterAdminMode),
  );
  const canEnterAdmin = Boolean(data?.viewer.canEnterAdminMode);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: await requestHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ...form,
        allocationId: Number(form.allocationId),
        adminPassword,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || 'บันทึกไม่สำเร็จ');
      setSaving(false);
      return;
    }
    await load();
    setSaving(false);
    setOpen(false);
    setMessage('บันทึกรายการเรียบร้อย');
    setForm({
      allocationId: '',
      action: 'เบิก',
      person: '',
      destination: 'สำนักงาน/สมาคม',
      note: '',
    });
  };

  if (!data && !error)
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          กำลังเตรียมข้อมูลสต๊อก
        </div>
      </div>
    );
  if (!data && error)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="w-full max-w-lg rounded-2xl border bg-card p-7 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
            🏇
          </div>
          <h1 className="text-xl font-semibold">
            ลงชื่อเข้าใช้ผ่านบัญชี Gmail
          </h1>
          <p className="mt-1 text-sm font-semibold text-rose-700">
            @tefthailand.com เท่านั้น / Approved TEF account only
          </p>

          {firebaseUser?.email && (
            <div
              className={`mt-4 rounded-xl border p-3 text-left text-xs ${
                firebaseUser.email.endsWith('@tefthailand.com')
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              <div className="font-semibold flex items-center justify-between">
                <span>ลงชื่อเข้าใช้ด้วย: {firebaseUser.email}</span>
                {firebaseUser.email.endsWith('@tefthailand.com') && (
                  <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">
                    บัญชีเจ้าหน้าที่ TEF
                  </span>
                )}
              </div>
              {!firebaseUser.email.endsWith('@tefthailand.com') && (
                <p className="mt-1 text-amber-800">
                  บัญชีนี้ไม่ใช่ @tefthailand.com กรุณาสลับไปใช้อีเมลเจ้าหน้าที่ TEF
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-900 border border-rose-200 text-left">
              <div className="font-bold flex items-center justify-between">
                <span>ข้อผิดพลาดจากฐานข้อมูล:</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-[11px] bg-rose-700 text-white px-2.5 py-0.5 rounded hover:bg-rose-800 font-medium"
                >
                  กดลองโหลดใหม่ (Retry)
                </button>
              </div>
              <div className="mt-1.5 font-mono text-[11px] break-all opacity-90">{error}</div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={authBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1a73e8] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#1557b0] disabled:opacity-60"
              onClick={async () => {
                setAuthBusy(true);
                setMessage('');
                try {
                  await signInWithGoogle();
                } catch (signInError) {
                  setMessage(
                    signInError instanceof Error
                      ? signInError.message
                      : 'เข้าสู่ระบบ Google ไม่สำเร็จ',
                  );
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              {authBusy ? 'กำลังเข้าสู่ระบบ…' : firebaseUser ? 'สลับบัญชี Google อื่น' : 'Sign in with Google'}
            </button>

            {firebaseUser && (
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={async () => {
                  await signOutFromFirebase();
                  setFirebaseUser(null);
                  setError('กรุณาเข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาต (@tefthailand.com)');
                  setMessage('');
                }}
              >
                ออกจากระบบ
              </button>
            )}
          </div>

          {message && (
            <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 text-left">
              {message}
            </div>
          )}
        </section>
      </main>
    );

  const totalBibItems = data?.allocations.length ?? 87;
  const totalCrawCount =
    data?.allocations.reduce((sum, item) => sum + (item.craw_qty ?? 5), 0) ?? 434;
  const officialsCount =
    data?.stock.filter((item) => stockGroup(item) === 'เสื้อกรรมการ / Officials')
      .length ?? 69;
  const photoCount =
    data?.stock.filter((item) => stockGroup(item) === 'เสื้อ Photo / Photo')
      .length ?? 5;
  const summaryCards: Array<{ label: string; value: number; unit: string }> = [
    {
      label: 'เสื้อ BIB ทั้งหมด',
      value: totalBibItems,
      unit: 'ตัว',
    },
    {
      label: 'CRAW ทั้งหมด',
      value: totalCrawCount,
      unit: 'ตัว',
    },
    {
      label: 'Officials (กรรมการ)',
      value: officialsCount,
      unit: 'ตัว',
    },
    { label: 'Photo Shirts', value: photoCount, unit: 'ตัว' },
  ];

  return (
    <main className="tef-theme min-h-screen text-foreground">
      <header className="border-b border-white/15 bg-[#0b6e4f] text-primary-foreground">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                TEF Stock BIB Endurance Inventory
              </h1>
              <p className="text-sm font-semibold text-[#c9a227]">
                ระบบจัดการเสื้อสำหรับการแข่งขัน Endurance (BIB) สำหรับนักกีฬา เจ้าหน้าที่ และกรรมการตัดสิน
              </p>
              {data?.viewer.email && (
                <p className="mt-1 text-xs text-primary-foreground/80">
                  {data.viewer.name} · {data.viewer.email} · {data.viewer.displayRole}
                  {adminMode ? ' · Admin mode' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {adminMode && (
              <button
                disabled={saving}
                title="นำเข้า / ซิงค์ข้อมูลทั้งหมด 87 รายการจาก TEF Data Base V2 เข้าสู่ Database"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                onClick={async () => {
                  if (!confirm('ยืนยันการนำเข้า / ซิงค์ข้อมูลตั้งต้น 87 รายการจาก TEF Data Base V2 เข้าสู่ Firestore หรือไม่?')) return;
                  setSaving(true);
                  setMessage('');
                  try {
                    const res = await fetch('/api/inventory', {
                      method: 'POST',
                      headers: await requestHeaders({ 'Content-Type': 'application/json' }),
                      body: JSON.stringify({ intent: 'reseed', adminPassword }),
                    });
                    const resJson = (await res.json()) as { error?: string; message?: string };
                    if (!res.ok) throw new Error(resJson.error || 'ซิงค์ข้อมูลไม่สำเร็จ');
                    setMessage(resJson.message || 'ซิงค์ข้อมูลเข้าสู่ Database สำเร็จเรียบร้อย');
                    await load();
                  } catch (syncErr: unknown) {
                    const msg = syncErr instanceof Error ? syncErr.message : 'ซิงค์ข้อมูลไม่สำเร็จ';
                    setMessage(`ข้อผิดพลาด: ${msg}`);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'กำลังซิงค์…' : '🔄 ซิงค์เข้า Database (Seed V2)'}
              </button>
            )}
            <button
              disabled={!canEnterAdmin}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#c9a227] px-4 text-sm font-semibold text-slate-950 hover:bg-[#d8b139] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => (adminMode ? setOpen(true) : setAdminGateOpen(true))}
            >
              {adminMode
                ? 'เบิก–จ่าย–คืน–ย้าย / Transactions'
                : canEnterAdmin
                  ? 'เข้าสู่โหมด Admin / Admin mode'
                  : 'View only / ดูอย่างเดียว'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-7 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 rounded-2xl border bg-[#075a40] p-3 text-white shadow-sm lg:sticky lg:top-5 lg:h-fit lg:w-56">
          <nav aria-label="เมนูหลัก / Main navigation" className="grid gap-1">
            <Link
              href="/"
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === 'q3' ? 'bg-white/15 text-white border-l-4 border-[#c9a227]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              Dashboard
              <span className="mt-0.5 block text-xs font-normal opacity-80">ภาพรวมและค้นหา BIB</span>
            </Link>
            <Link
              href="/stock"
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === 'stock' ? 'bg-white/15 text-white border-l-4 border-[#c9a227]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              Initial Stock
              <span className="mt-0.5 block text-xs font-normal opacity-80">สต๊อกตั้งต้นตามสถานที่</span>
            </Link>
            <Link
              href="/#latest-dpe-cei"
              className="rounded-xl px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Latest DPE/CEI
              <span className="mt-0.5 block text-xs font-normal opacity-80">รายการล่าสุด</span>
            </Link>
            <button
              type="button"
              className="rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              onClick={() => (isAdmin ? setOpen(true) : setAdminGateOpen(true))}
            >
              Transactions
              <span className="mt-0.5 block text-xs font-normal opacity-80">เบิก / จ่าย / คืน / ย้าย</span>
            </button>
            <Link
              href="/history"
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === 'history' ? 'bg-white/15 text-white border-l-4 border-[#c9a227]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              History
              <span className="mt-0.5 block text-xs font-normal opacity-80">ประวัติการทำรายการ</span>
            </Link>
            {data?.viewer.canManageUsers && (
              <Link
                href="/admin/users"
                className="rounded-xl px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Manage Users
                <span className="mt-0.5 block text-xs font-normal opacity-80">จัดการสิทธิ์ผู้ใช้งาน</span>
              </Link>
            )}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
        <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              ยินดีต้อนรับสู่ TEF Stock BIB Endurance Inventory
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ค้นหารายการ / Search เพื่อดูตำแหน่งล่าสุด สี และรหัสเสื้อที่เกี่ยวข้อง
              / Search to see the latest location, color, and related shirt code.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch((value) => value.trim());
            }}
            id="search-bib"
            aria-label="ค้นหา BIB หรือรหัสเสื้อ / Search BIB or code"
            className="flex min-w-[300px] items-center gap-2 rounded-xl border bg-card px-3 shadow-sm"
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full border-0 bg-transparent px-0 text-sm outline-none"
              placeholder="ค้นหาด้วย CEI/CEN80/CEN40"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-[#0b6e4f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#075a40]"
            >
              ค้นหา / Search
            </button>
          </form>
        </section>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{error}</span>
            <button
              className="rounded-lg border bg-white px-3 py-2"
              onClick={() => void load()}
            >
              ลองใหม่
            </button>
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, unit }) => (
            <article
              key={label}
              className="rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
              </div>
              <p className="text-3xl font-semibold">
                {value}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {unit}
                </span>
              </p>
            </article>
          ))}
        </section>

        <section className="mb-7 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold">คำอธิบายรายการ / Transaction guide</h3>
            <p className="text-sm text-muted-foreground">
              ใช้คำอธิบายนี้เพื่อเลือกประเภทการทำรายการให้ตรงกับขั้นตอนจริง / Choose the
              action that matches the real stock movement.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {actionDefinitions.map((item) => (
              <article
                key={item.value}
                className="rounded-xl bg-secondary/60 p-4"
              >
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-foreground/80">
                  {item.description}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {item.english}
                </p>
              </article>
            ))}
          </div>
        </section>

        {!initialStockOnly && !initialHistoryOnly && (
          <section className="mb-5 flex flex-wrap items-center justify-end gap-2">
            <NativeSelect
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <NativeSelectOption>ทั้งหมด</NativeSelectOption>
              <NativeSelectOption>Thai Polo</NativeSelectOption>
              <NativeSelectOption>TEF Office</NativeSelectOption>
              <NativeSelectOption>สำนักงาน/สมาคม</NativeSelectOption>
            </NativeSelect>
            <NativeSelect
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              <NativeSelectOption>ทั้งหมด</NativeSelectOption>
              {['White', 'Orange', 'Lemon', 'Green'].map((c) => (
                <NativeSelectOption key={c}>{c}</NativeSelectOption>
              ))}
            </NativeSelect>
          </section>
        )}

        {initialStockOnly && (
          <section className="mb-5 flex flex-wrap items-center justify-end gap-2">
            <NativeSelect
              value={stockGroupFilter}
              onChange={(e) => setStockGroupFilter(e.target.value)}
            >
              <NativeSelectOption value="ทั้งหมด">ทั้งหมด / All groups</NativeSelectOption>
              <NativeSelectOption>เสื้อ BIB / Numbered BIB</NativeSelectOption>
              <NativeSelectOption>เสื้อกรรมการ / Officials</NativeSelectOption>
              <NativeSelectOption>เสื้อ Photo / Photo</NativeSelectOption>
            </NativeSelect>
          </section>
        )}

        {!initialStockOnly && !initialHistoryOnly && tab === 'q3' && (
          <section id="latest-dpe-cei" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-semibold">
                  รายการเสื้อ BIB ทั้งหมด · TEF Database ({filtered.length} รายการ)
                </h3>
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? `ผลการค้นหา "${search.trim()}": พบ ${filtered.length} รายการ`
                    : `แสดง ${filtered.length} รายการตามตัวกรอง`}
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                ฐานข้อมูล TEF Data Base V2
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/70">
                  <TableHead>BIB</TableHead>
                  <TableHead>สี</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ตำแหน่งปัจจุบัน</TableHead>
                  <TableHead>สถานะล่าสุด</TableHead>
                  <TableHead>CRAW</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead>เทียบสต๊อก</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-12 text-center text-muted-foreground"
                    >
                      ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-lg font-semibold">
                          {item.bib_confirm}
                        </p>
                        {item.rider && (
                          <p className="text-xs text-muted-foreground">
                            {item.rider} {item.club ? `(${item.club})` : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`size-3 rounded-full ${colorDot[item.color] ?? 'bg-slate-300'}`}
                          />
                          {item.color_detail || item.color}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{item.event}</span>
                        {item.last_event && item.last_event !== item.event && (
                          <span className="block text-[11px] text-muted-foreground">
                            Last: {item.last_event}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${locationClass(item.current_location)}`}
                        >
                          {item.current_location}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{item.current_status}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{item.craw_qty ?? 5}</span> ตัว
                      </TableCell>
                      <TableCell>
                        {item.remark ? (
                          <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {item.remark}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p
                          className={
                            item.match_status === 'ตรงกับสต๊อกตั้งต้น'
                              ? 'text-emerald-700 font-medium'
                              : 'text-amber-700'
                          }
                        >
                          {item.match_status}
                        </p>
                        {item.stock_code && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.stock_code}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          disabled={!isAdmin}
                          title={isAdmin ? 'ทำรายการ' : 'เฉพาะ Admin เท่านั้น'}
                          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              allocationId: String(item.id),
                            }));
                            setOpen(true);
                          }}
                        >
                          {isAdmin ? 'ทำรายการ' : 'ดูอย่างเดียว'}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </section>
        )}

        {!initialHistoryOnly && tab === 'stock' && (
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-semibold">สต๊อกตั้งต้น / Initial stock</h3>
                <p className="text-sm text-muted-foreground">
                  จาก En เสื้อ.xlsx และ TEF BIB 16jun.xlsx ·{' '}
                  {data?.stock.length ?? 0} รายการ
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/70">
                  <TableHead>รหัส</TableHead>
                  <TableHead>กลุ่ม / Group</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สี</TableHead>
                  <TableHead>BIB</TableHead>
                  <TableHead>ชื่อ/ตำแหน่งบนเสื้อ / Printed role</TableHead>
                  <TableHead>มูลค่า</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockFiltered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.code}
                    </TableCell>
                    <TableCell>{stockGroup(item)}</TableCell>
                    <TableCell>{item.event}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`size-3 rounded-full ${colorDot[item.color]}`}
                        />
                        {item.color}
                      </span>
                    </TableCell>
                    <TableCell className="text-lg font-semibold">
                      {item.bib}
                    </TableCell>
                    <TableCell>{printedRole(item.code) || '—'}</TableCell>
                    <TableCell>
                      {item.value.toLocaleString('th-TH')} บาท
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {!initialStockOnly && tab === 'history' && (
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h3 className="font-semibold">
                ประวัติเบิก–จ่าย–คืน–ย้าย / Transaction history
              </h3>
              <p className="text-sm text-muted-foreground">
                แสดง 100 รายการล่าสุด
              </p>
            </div>
            {data?.transactions.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/70">
                    <TableHead>วันเวลา</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>BIB</TableHead>
                    <TableHead>ผู้ทำรายการ/ผู้รับ</TableHead>
                    <TableHead>จาก</TableHead>
                    <TableHead>ไปยัง</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {new Date(item.created_at).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {item.action}
                      </TableCell>
                      <TableCell>
                        {item.color} {item.bib_confirm}
                      </TableCell>
                      <TableCell>{item.person}</TableCell>
                      <TableCell>{item.from_location}</TableCell>
                      <TableCell>{item.to_location}</TableCell>
                      <TableCell>{item.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid min-h-56 place-items-center text-center text-muted-foreground">
                <div>
                  <p>ยังไม่มีประวัติรายการ / No transactions yet</p>
                  <p className="text-sm">
                    เริ่มจากปุ่ม “เบิก–จ่าย–คืน–ย้าย / Transactions”
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h3 className="mb-2 font-semibold">
            ข้อมูลที่ควรทราบ
          </h3>
          <ul className="grid gap-1.5 md:grid-cols-2">
            <li>• Latest list: 44 BIBs; 43 at Thai Polo</li>
            <li>• BIB 22 is at the office/association</li>
            <li>
              • BIB 27 is Green in the latest image but Orange in initial stock
            </li>
            <li>• Initial-stock codes are unique and each item is valued at 500 THB</li>
          </ul>
        </div>
        </div>
      </div>

      {adminGateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="ปิดหน้าต่างโหมด Admin"
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm"
            onClick={() => setAdminGateOpen(false)}
          />
          <dialog
            open
            aria-labelledby="admin-mode-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setMessage('');
                const response = await fetch('/api/inventory', {
                  method: 'POST',
                  headers: await requestHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({
                    intent: 'enter-admin',
                    adminPassword,
                  }),
                });
                const result = (await response.json()) as { error?: string };
                if (!response.ok) {
                  setMessage(result.error || 'เข้าสู่โหมด Admin ไม่สำเร็จ');
                  return;
                }
                setAdminMode(true);
                setAdminGateOpen(false);
                setMessage('เข้าสู่โหมด Admin แล้ว');
              }}
              className="grid gap-4"
            >
              <div>
                <h2 id="admin-mode-title" className="text-lg font-semibold">
                  เข้าสู่โหมด Admin / Admin mode
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  ยืนยันรหัสผ่านฝั่ง API ก่อนทำรายการสต๊อก
                </p>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                <span>รหัสโหมด Admin</span>
                <input
                  required
                  type="password"
                  value={adminPassword}
                  placeholder="ใส่รหัสผ่านโหมด Admin"
                  onChange={(event) => setAdminPassword(event.target.value)}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
                  autoComplete="current-password"
                />
              </label>
              {message && <p className="text-sm text-red-700">{message}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  onClick={() => setAdminGateOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </dialog>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="ปิดหน้าต่างทำรายการ"
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <dialog
            open
            aria-labelledby="transaction-title"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
          >
            <form onSubmit={submit} className="p-5">
              <div className="mb-5">
                <h2 id="transaction-title" className="text-lg font-semibold text-slate-900">
                  ทำรายการเสื้อ BIB / BIB transaction
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  บันทึกการเบิก จ่าย คืน หรือย้ายสถานที่ / Record each withdrawal, issue,
                  return, or transfer.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1.5 text-sm font-medium text-slate-800">
                  <label htmlFor="allocation-select">เสื้อ BIB</label>
                  <NativeSelect
                    id="allocation-select"
                    required
                    className="w-full border-slate-300 bg-white text-slate-900"
                    value={form.allocationId}
                    onChange={(e) =>
                      setForm({ ...form, allocationId: e.target.value })
                    }
                  >
                    <NativeSelectOption value="">เลือก BIB</NativeSelectOption>
                    {data?.allocations.map((i) => (
                      <NativeSelectOption key={i.id} value={i.id}>
                        {i.color} {i.bib_confirm} — {i.event}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <fieldset className="grid gap-2 text-sm font-medium text-slate-800">
                  <legend>ประเภทรายการ / Transaction type</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {actionDefinitions.map((item) => {
                      const selected = form.action === item.value;
                      const tone =
                        item.value === 'เบิก'
                          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          : item.value === 'จ่าย'
                            ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            : item.value === 'คืน'
                              ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                              : 'bg-violet-50 border-violet-200 hover:bg-violet-100';
                      return (
                        <button
                          key={item.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setForm({ ...form, action: item.value })}
                          className={`min-h-24 rounded-xl border p-3 text-left transition ${tone} ${selected ? 'ring-2 ring-[#8f1028] ring-offset-2' : ''}`}
                        >
                          <span className="block text-sm font-semibold text-slate-900">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs font-normal leading-5 text-slate-600">
                            {item.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                  ชื่อผู้เบิก / ผู้รับ / ผู้ทำรายการ
                  <input
                    required
                    value={form.person}
                    onChange={(e) =>
                      setForm({ ...form, person: e.target.value })
                    }
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
                    placeholder="ชื่อ–นามสกุล"
                  />
                </label>
                {['คืน', 'ย้าย'].includes(form.action) && (
                  <div className="grid gap-1.5 text-sm font-medium text-slate-800">
                    <label htmlFor="destination-select">ปลายทาง</label>
                    <NativeSelect
                      id="destination-select"
                      className="w-full border-slate-300 bg-white text-slate-900"
                      value={form.destination}
                      onChange={(e) =>
                        setForm({ ...form, destination: e.target.value })
                      }
                    >
                      <NativeSelectOption>สำนักงาน/สมาคม</NativeSelectOption>
                      <NativeSelectOption>Thai Polo</NativeSelectOption>
                    </NativeSelect>
                  </div>
                )}
                <label className="grid gap-1.5 text-sm font-medium text-slate-800">
                  หมายเหตุ
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
                    placeholder="ถ้ามี"
                  />
                </label>
                {message && <p className="text-sm text-red-700">{message}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  disabled={saving}
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  บันทึกรายการ
                </button>
              </div>
            </form>
          </dialog>
        </div>
      )}
    </main>
  );
}
