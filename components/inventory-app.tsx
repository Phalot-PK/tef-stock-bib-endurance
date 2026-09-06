'use client';

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  Building2,
  History,
  Loader2,
  MapPin,
  Search,
  Shirt,
} from 'lucide-react';
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

type Allocation = {
  id: number;
  event: string;
  color: string;
  bib_confirm: number;
  bib_sign: number;
  club: string;
  initial_location: string;
  current_location: string;
  current_status: string;
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
  viewer: { email: string; role: 'admin' | 'user' };
  allocations: Allocation[];
  transactions: Transaction[];
  stock: Stock[];
};

const locationClass = (location: string) =>
  location === 'Thai Polo'
    ? 'bg-rose-100 text-rose-800'
    : location === 'สำนักงาน/สมาคม'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-sky-100 text-sky-800';
const colorDot: Record<string, string> = {
  White: 'bg-white border',
  Orange: 'bg-orange-400',
  Lemon: 'bg-yellow-300',
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
}: {
  initialStockOnly?: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('ทั้งหมด');
  const [color, setColor] = useState('ทั้งหมด');
  const [stockGroupFilter, setStockGroupFilter] = useState('ทั้งหมด');
  const [tab, setTab] = useState<'q3' | 'stock' | 'history'>(
    initialStockOnly ? 'stock' : 'q3',
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    allocationId: '',
    action: 'เบิก',
    person: '',
    destination: 'สำนักงาน/สมาคม',
    note: '',
  });

  const load = async () => {
    try {
      const response = await fetch('/api/inventory', { cache: 'no-store' });
      if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      setData(await response.json());
      setError('');
    } catch {
      setError('ยังเชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่');
    }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return data.allocations.filter(
      (item) =>
        (!q ||
          [item.bib_confirm, item.bib_sign, item.event, item.color].some((v) =>
            String(v).toLowerCase().includes(q),
          )) &&
        (location === 'ทั้งหมด' || item.current_location === location) &&
        (color === 'ทั้งหมด' || item.color === color),
    );
  }, [data, search, location, color]);
  const stockFiltered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.stock.filter(
      (item) =>
        (!q ||
          [item.code, item.event, item.color, item.bib].some((v) =>
            String(v).toLowerCase().includes(q),
          )) &&
        (stockGroupFilter === 'ทั้งหมด' || stockGroup(item) === stockGroupFilter),
    );
  }, [data, search, stockGroupFilter]);
  const isAdmin = data?.viewer.role === 'admin';

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        allocationId: Number(form.allocationId),
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
          <Loader2 className="size-5 animate-spin" />
          กำลังเตรียมข้อมูลสต๊อก
        </div>
      </div>
    );
  if (!data && error)
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="w-full max-w-lg rounded-2xl border bg-card p-7 text-center shadow-sm">
          <Shirt className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="text-xl font-semibold">
            ยินดีต้อนรับเข้าสู่ TEF Stock BIB Endurance Inventory
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error} / Please sign in with an approved account.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            ระบบนี้ใช้บัญชีที่ Sites อนุญาต เช่น Gmail/Workspace account / Use an allowed
            Gmail or Workspace account.
          </p>
        </section>
      </main>
    );

  const thaiPolo =
    data?.allocations.filter((i) => i.current_location === 'Thai Polo')
      .length ?? 0;
  const office =
    data?.allocations.filter((i) => i.current_location === 'สำนักงาน/สมาคม')
      .length ?? 0;
  const summaryCards: Array<{
    Icon: LucideIcon;
    label: string;
    value: number;
    unit: string;
  }> = [
    {
      Icon: Archive,
      label: 'สต๊อกตั้งต้น',
      value: data?.stock.length ?? 63,
      unit: 'ตัว',
    },
    {
      Icon: Shirt,
      label: 'รายการ DPE ล่าสุด',
      value: data?.allocations.length ?? 44,
      unit: 'ตัว',
    },
    { Icon: MapPin, label: 'Thai Polo', value: thaiPolo, unit: 'ตัว' },
    { Icon: Building2, label: 'สำนักงาน/สมาคม', value: office, unit: 'ตัว' },
  ];

  return (
    <main className="tef-theme min-h-screen text-foreground">
      <header className="border-b border-white/15 bg-slate-950/25 text-primary-foreground backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/12">
              <Shirt className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-300">
                Thai Equestrian Federation
              </p>
              <h1 className="text-xl font-semibold tracking-tight">
                ระบบสต๊อกเสื้อ BIB / BIB Shirt Inventory
              </h1>
              {data?.viewer.email && (
                <p className="mt-1 text-xs text-primary-foreground/70">
                  Signed in / เข้าสู่ระบบ: {data.viewer.email} ·{' '}
                  {data.viewer.role === 'admin' ? 'God Admin' : 'View only'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={initialStockOnly ? '/' : '/stock'}
              className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm font-semibold text-primary-foreground hover:bg-white/10"
            >
              {initialStockOnly
                ? 'กลับหน้าหลัก / Home'
                : 'สต๊อกตั้งต้น / Initial stock'}
            </a>
            <button
              disabled={!isAdmin}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              onClick={() => setOpen(true)}
            >
              <ArrowLeftRight className="size-4" />
              {isAdmin
                ? 'เบิก–จ่าย–คืน–ย้าย / Transactions'
                : 'View only / ดูอย่างเดียว'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              ยินดีต้อนรับสู่ TEF Stock BIB Endurance Inventory
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ค้นหาเสื้อจากหมายเลข BIB เพื่อดูตำแหน่งล่าสุดและสี / Search a BIB number to
              see its latest location and color.
            </p>
          </div>
          <label className="flex min-w-[300px] items-center gap-2 rounded-xl border bg-card px-3 shadow-sm">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full border-0 bg-transparent px-0 text-sm outline-none"
              placeholder="ค้นหา BIB หรือรหัสเสื้อ / Search BIB or code"
            />
          </label>
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
          {summaryCards.map(({ Icon, label, value, unit }) => (
            <article
              key={label}
              className="rounded-2xl border bg-card p-5 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="grid size-9 place-items-center rounded-xl bg-secondary">
                  <Icon className="size-4" />
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

        {!initialStockOnly && (
          <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-xl border bg-card p-1 shadow-sm">
              {(
                [
                  ['q3', 'ตำแหน่งล่าสุด / Latest location'],
                  ['stock', 'สต๊อกตั้งต้น / Initial stock'],
                  ['history', 'ประวัติรายการ / History'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'q3' && (
              <div className="flex gap-2">
                <NativeSelect
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <NativeSelectOption>ทั้งหมด</NativeSelectOption>
                  <NativeSelectOption>Thai Polo</NativeSelectOption>
                  <NativeSelectOption>สำนักงาน/สมาคม</NativeSelectOption>
                </NativeSelect>
                <NativeSelect
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                >
                  <NativeSelectOption>ทั้งหมด</NativeSelectOption>
                  {['Green', 'Orange'].map((c) => (
                    <NativeSelectOption key={c}>{c}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
            {tab === 'stock' && (
              <NativeSelect
                value={stockGroupFilter}
                onChange={(e) => setStockGroupFilter(e.target.value)}
              >
                <NativeSelectOption>ทั้งหมด / All groups</NativeSelectOption>
                <NativeSelectOption>เสื้อ BIB / Numbered BIB</NativeSelectOption>
                <NativeSelectOption>เสื้อกรรมการ / Officials</NativeSelectOption>
                <NativeSelectOption>เสื้อ Photo / Photo</NativeSelectOption>
              </NativeSelect>
            )}
          </section>
        )}

        {!initialStockOnly && tab === 'q3' && (
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-semibold">
                  รายการที่ใช้ล่าสุด · กีฬาระหว่างโรงเรียน กรมพลศึกษา ประจำปีการศึกษา 2569
                  (DPE 2026)
                </h3>
                <p className="text-sm text-muted-foreground">
                  พบ {filtered.length} รายการ
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                <AlertTriangle className="size-3.5" />
                BIB 27 สีต่างจากสต๊อกตั้งต้น
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/70">
                  <TableHead>BIB</TableHead>
                  <TableHead>สี</TableHead>
                  <TableHead>รายการ</TableHead>
                  <TableHead>ตำแหน่งปัจจุบัน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>เทียบสต๊อก</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!search.trim() ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground"
                    >
                      พิมพ์หมายเลข BIB เพื่อค้นหาตำแหน่งล่าสุด / Enter a BIB number to
                      search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-lg font-semibold">
                          {item.bib_confirm}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`size-3 rounded-full ${colorDot[item.color]}`}
                          />
                          {item.color}
                        </span>
                      </TableCell>
                      <TableCell>{item.event}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${locationClass(item.current_location)}`}
                        >
                          {item.current_location}
                        </span>
                      </TableCell>
                      <TableCell>{item.current_status}</TableCell>
                      <TableCell>
                        <p
                          className={
                            item.match_status === 'ตรงกับสต๊อกตั้งต้น'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {item.match_status}
                        </p>
                        {item.stock_code && (
                          <p className="text-xs text-muted-foreground">
                            {item.stock_code}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          disabled={!isAdmin}
                          title={isAdmin ? 'ทำรายการ' : 'เฉพาะ God Admin เท่านั้น'}
                          className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
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

        {tab === 'stock' && (
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h3 className="font-semibold">สต๊อกตั้งต้น / Initial stock</h3>
                <p className="text-sm text-muted-foreground">
                  จาก En เสื้อ.xlsx และ TEF BIB 16jun.xlsx ·{' '}
                  {data?.stock.length ?? 0} รายการ
                </p>
              </div>
              {initialStockOnly && (
                <NativeSelect
                  value={stockGroupFilter}
                  onChange={(e) => setStockGroupFilter(e.target.value)}
                >
                  <NativeSelectOption>ทั้งหมด / All groups</NativeSelectOption>
                  <NativeSelectOption>
                    เสื้อ BIB / Numbered BIB
                  </NativeSelectOption>
                  <NativeSelectOption>
                    เสื้อกรรมการ / Officials
                  </NativeSelectOption>
                  <NativeSelectOption>เสื้อ Photo / Photo</NativeSelectOption>
                </NativeSelect>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/70">
                  <TableHead>รหัส</TableHead>
                  <TableHead>กลุ่ม / Group</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สี</TableHead>
                  <TableHead>BIB</TableHead>
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
              <h3 className="flex items-center gap-2 font-semibold">
                <History className="size-4" />
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
                  <History className="mx-auto mb-3 size-8 opacity-50" />
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
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            ข้อมูลที่ควรทราบ
          </h3>
          <ul className="grid gap-1.5 md:grid-cols-2">
            <li>• Latest list: 44 BIBs; 43 at Thai Polo</li>
            <li>• BIB 22 is at the office/association</li>
            <li>
              • BIB 27 is Green in the latest image but Orange in initial stock
            </li>
            <li>• TEF_EN_0024 is duplicated in the initial stock</li>
          </ul>
        </div>
      </div>

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
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-0 text-foreground shadow-2xl"
          >
            <form onSubmit={submit} className="p-5">
              <div className="mb-5">
                <h2 id="transaction-title" className="text-lg font-semibold">
                  ทำรายการเสื้อ BIB / BIB transaction
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  บันทึกการเบิก จ่าย คืน หรือย้ายสถานที่ / Record each withdrawal, issue,
                  return, or transfer.
                </p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1.5 text-sm font-medium">
                  <label htmlFor="allocation-select">เสื้อ BIB</label>
                  <NativeSelect
                    id="allocation-select"
                    required
                    className="w-full"
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
                <div className="grid gap-1.5 text-sm font-medium">
                  <label htmlFor="action-select">ประเภทรายการ</label>
                  <NativeSelect
                    id="action-select"
                    className="w-full"
                    value={form.action}
                    onChange={(e) =>
                      setForm({ ...form, action: e.target.value })
                    }
                  >
                    {actionDefinitions.map((item) => (
                      <NativeSelectOption key={item.value} value={item.value}>
                        {item.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                  ชื่อผู้เบิก / ผู้รับ / ผู้ทำรายการ
                  <input
                    required
                    value={form.person}
                    onChange={(e) =>
                      setForm({ ...form, person: e.target.value })
                    }
                    className="h-9 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="ชื่อ–นามสกุล"
                  />
                </label>
                {['คืน', 'ย้าย'].includes(form.action) && (
                  <div className="grid gap-1.5 text-sm font-medium">
                    <label htmlFor="destination-select">ปลายทาง</label>
                    <NativeSelect
                      id="destination-select"
                      className="w-full"
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
                <label className="grid gap-1.5 text-sm font-medium">
                  หมายเหตุ
                  <input
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="h-9 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="ถ้ามี"
                  />
                </label>
                {message && <p className="text-sm text-red-700">{message}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  onClick={() => setOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  disabled={saving}
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
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
