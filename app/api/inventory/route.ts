import { env } from 'cloudflare:workers';
import { allocationSeeds, allAllocationSeeds, stockSeeds } from '@/lib/seed-data';
import { getAllowedUser } from '@/lib/access';

export const runtime = 'edge';
// Database repair migrations are applied on the first authenticated request.
function authenticatedEmail(request: Request) {
  return request.headers.get('oai-authenticated-user-email')?.trim() || '';
}

function authenticatedUser(request: Request) {
  return getAllowedUser(authenticatedEmail(request));
}

async function isAdminPasswordValid(password: string) {
  const configured = [
    (env as unknown as { ADMIN_MODE_PASSWORD_PRIMARY?: string })
      .ADMIN_MODE_PASSWORD_PRIMARY,
    (env as unknown as { ADMIN_MODE_PASSWORD_SECONDARY?: string })
      .ADMIN_MODE_PASSWORD_SECONDARY,
  ].filter((value): value is string => Boolean(value));
  if (!password || configured.length === 0) return false;
  return configured.some((candidate) => candidate === password);
}

async function prepareDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, event TEXT NOT NULL,
      color TEXT NOT NULL, bib INTEGER NOT NULL, value INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL, color TEXT NOT NULL,
      bib_confirm INTEGER NOT NULL, bib_sign INTEGER NOT NULL, rider TEXT NOT NULL,
      club TEXT NOT NULL, initial_location TEXT NOT NULL, current_location TEXT NOT NULL,
      current_status TEXT NOT NULL, stock_code TEXT NOT NULL, stock_color TEXT NOT NULL,
      match_status TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, allocation_id INTEGER NOT NULL,
      action TEXT NOT NULL, person TEXT NOT NULL, from_location TEXT NOT NULL,
      to_location TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_allocations_location ON allocations(current_location)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_allocations_bib ON allocations(bib_confirm)',
    ),
    db.prepare(
      'CREATE INDEX IF NOT EXISTS idx_transactions_allocation_created ON transactions(allocation_id, created_at)',
    ),
  ]);

  const seedVersion = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'seed_version'")
    .first<{ value: string }>();
  if (seedVersion?.value !== 'dpe-aug-2026-v4') {
    await db.batch(
      allAllocationSeeds.map((item) =>
        db
          .prepare(`INSERT INTO allocations
      (event,color,bib_confirm,bib_sign,rider,club,initial_location,current_location,current_status,stock_code,stock_color,match_status)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (
        SELECT 1 FROM allocations WHERE event = ? AND bib_confirm = ? AND color = ?
      )`)
          .bind(
            item.event,
            item.color,
            item.bibConfirm,
            item.bibSign,
            item.rider,
            item.club,
            item.location,
            item.location,
            'พร้อมใช้งาน',
            item.stockCode,
            item.stockColor,
            item.matchStatus,
            item.event,
            item.bibConfirm,
            item.color,
          ),
      ),
    );
    await db
      .prepare(
        "INSERT INTO app_meta (key,value) VALUES ('seed_version','dpe-aug-2026-v4') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run();

    // Keep existing DPE allocation references aligned after correcting the
    // duplicate CEN stock-code range. This updates references only; it does
    // not remove allocations or transaction history.
    await db.batch(
      allocationSeeds
        .filter((item) => item.event === 'DPE Aug 2026')
        .map((item) => {
          const stock = stockSeeds.find(
            (candidate) =>
              candidate.bib === item.bibConfirm &&
              candidate.color.toLowerCase() === item.color.toLowerCase(),
          ) ?? stockSeeds.find((candidate) => candidate.bib === item.bibConfirm);
          const exact = stock && stock.color.toLowerCase() === item.color.toLowerCase();
          return db
            .prepare(
              'UPDATE allocations SET stock_code = ?, stock_color = ?, match_status = ? WHERE event = ? AND bib_confirm = ? AND color = ?',
            )
            .bind(
              stock?.code ?? '',
              stock?.color ?? '',
              exact
                ? 'ตรงกับสต๊อกตั้งต้น'
                : stock
                  ? `สีต่างกัน (${stock.color}/${item.color})`
                  : 'ไม่พบในสต๊อกตั้งต้น',
              item.event,
              item.bibConfirm,
              item.color,
            );
        }),
    );
  }
  const stockCount = await db
    .prepare('SELECT COUNT(*) AS count FROM stock_items')
    .first<{ count: number }>();
  if (!stockCount?.count) {
    await db.batch(
      stockSeeds.map((item) =>
        db
          .prepare(
            'INSERT INTO stock_items (code,event,color,bib,value) VALUES (?,?,?,?,?)',
          )
          .bind(item.code, item.event, item.color, item.bib, item.value),
      ),
    );
  }
  const stockSeedVersion = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'stock_seed_version'")
    .first<{ value: string }>();
  if (stockSeedVersion?.value !== 'tef-bib-16jun-v4') {
    const tefStockSeeds = stockSeeds.filter(
      (item) => item.event === 'TEF BIB 16 Jun',
    );
    await db.batch(
      tefStockSeeds.map((item) =>
        db
          .prepare(`INSERT INTO stock_items (code,event,color,bib,value)
            SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM stock_items WHERE code = ?)`)
          .bind(
            item.code,
            item.event,
            item.color,
            item.bib,
            item.value,
            item.code,
          ),
      ),
    );
    await db.batch(
      tefStockSeeds.map((item) =>
        db
          .prepare(
            'UPDATE stock_items SET event = ?, color = ?, bib = ?, value = ? WHERE code = ?',
          )
          .bind(item.event, item.color, item.bib, item.value, item.code),
      ),
    );

    // Correct legacy prices and normalize all initial-stock prices to the
    // requested 500 THB without deleting any stock rows.
    await db.prepare('UPDATE stock_items SET value = 500').run();

    // Repair the legacy duplicate CEN 40/CEN 80 code range in-place.
    const cen40Seeds = stockSeeds.filter((item) => item.event === 'CEN 40 KM');
    await db.batch(
      cen40Seeds.map((item) =>
        db
          .prepare('UPDATE stock_items SET code = ?, value = ? WHERE event = ? AND bib = ?')
          .bind(item.code, item.value, item.event, item.bib),
      ),
    );
    await db
      .prepare(
        "INSERT INTO app_meta (key,value) VALUES ('stock_seed_version','tef-bib-16jun-v4') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run();
  }
  await db.prepare('PRAGMA optimize').run();
}

export async function GET(request: Request) {
  const viewer = authenticatedUser(request);
  if (!viewer)
    return Response.json(
      { error: 'บัญชีนี้ยังไม่ได้รับอนุญาตให้ใช้ระบบ' },
      { status: 403 },
    );
  await prepareDatabase();
  const [allocations, transactions, stock] = await Promise.all([
    env.DB.prepare(
      `SELECT id,event,color,bib_confirm,bib_sign,club,initial_location,
        current_location,current_status,stock_code,stock_color,match_status
       FROM allocations ORDER BY event, bib_confirm`,
    ).all(),
    env.DB.prepare(`SELECT t.*, a.bib_confirm, a.color, a.event
      FROM transactions t JOIN allocations a ON a.id = t.allocation_id
      ORDER BY t.created_at DESC, t.id DESC LIMIT 100`).all(),
    env.DB.prepare('SELECT * FROM stock_items ORDER BY event, bib').all(),
  ]);
  return Response.json({
    viewer: {
      email: viewer.email,
      name: viewer.name,
      // Keep the secondary Admin account visually classified as a general user;
      // the capability is enforced server-side and is not advertised in the UI.
      role: viewer.role === 'secret-admin' ? 'viewer' : viewer.role,
      displayRole: viewer.displayRole,
      canEnterAdminMode: viewer.canEnterAdminMode,
      canComment: viewer.canComment,
      adminModeAvailable: Boolean(
        (env as unknown as { ADMIN_MODE_PASSWORD_PRIMARY?: string })
          .ADMIN_MODE_PASSWORD_PRIMARY ||
          (env as unknown as { ADMIN_MODE_PASSWORD_SECONDARY?: string })
            .ADMIN_MODE_PASSWORD_SECONDARY,
      ),
    },
    allocations: allocations.results,
    transactions: transactions.results,
    stock: stock.results,
  });
}

export async function POST(request: Request) {
  const viewer = authenticatedUser(request);
  if (!viewer)
    return Response.json(
      { error: 'บัญชีนี้ยังไม่ได้รับอนุญาตให้ทำรายการ' },
      { status: 403 },
    );
  if (!viewer.canEnterAdminMode)
    return Response.json(
      { error: 'บัญชีนี้ไม่มีสิทธิ์เข้าสู่โหมด Admin' },
      { status: 403 },
    );
  const body = (await request.json()) as {
    intent?: 'enter-admin' | 'transaction';
    allocationId?: number;
    action?: string;
    person?: string;
    destination?: string;
    note?: string;
    adminPassword?: string;
  };
  if (!(await isAdminPasswordValid(body.adminPassword ?? '')))
    return Response.json(
      { error: 'รหัสโหมด Admin ไม่ถูกต้อง หรือยังไม่ได้ตั้งค่ารหัสใน API' },
      { status: 403 },
    );
  if (body.intent === 'enter-admin') return Response.json({ ok: true });
  await prepareDatabase();
  if (!body.allocationId || !body.action || !body.person?.trim())
    return Response.json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ' }, { status: 400 });
  if (!['เบิก', 'จ่าย', 'คืน', 'ย้าย'].includes(body.action))
    return Response.json({ error: 'ประเภทรายการไม่ถูกต้อง' }, { status: 400 });
  const item = await env.DB.prepare('SELECT * FROM allocations WHERE id = ?')
    .bind(body.allocationId)
    .first<Record<string, unknown>>();
  if (!item)
    return Response.json({ error: 'ไม่พบเสื้อ BIB ที่เลือก' }, { status: 404 });

  const fromLocation = String(item.current_location);
  let toLocation = body.destination?.trim() || fromLocation;
  let nextStatus = String(item.current_status);
  if (body.action === 'เบิก') {
    toLocation = `ผู้เบิก: ${body.person.trim()}`;
    nextStatus = 'ถูกเบิก';
  }
  if (body.action === 'จ่าย') {
    toLocation = `ผู้รับ: ${body.person.trim()}`;
    nextStatus = 'จ่ายแล้ว';
  }
  if (body.action === 'คืน') {
    toLocation = body.destination?.trim() || 'สำนักงาน/สมาคม';
    nextStatus = 'พร้อมใช้งาน';
  }
  if (body.action === 'ย้าย') {
    toLocation = body.destination?.trim() || fromLocation;
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO transactions (allocation_id,action,person,from_location,to_location,note,created_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(
      body.allocationId,
      body.action,
      body.person.trim(),
      fromLocation,
      toLocation,
      body.note?.trim() || '',
      now,
    ),
    env.DB.prepare(
      'UPDATE allocations SET current_location = ?, current_status = ? WHERE id = ?',
    ).bind(toLocation, nextStatus, body.allocationId),
  ]);
  return Response.json({ ok: true });
}
