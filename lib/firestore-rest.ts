import { allAllocationSeeds, stockSeeds } from '@/lib/seed-data';

const projectId = 'tef-inventory-bib';
let activeDatabaseId = 'tef-inventory-asia';

function getFirestoreRoot(db: string = activeDatabaseId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents`;
}

function documentName(collection: string, id: string | number) {
  return `${getFirestoreRoot()}/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`;
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: string;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function textValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  return JSON.stringify(value);
}

function firestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) {
    return { integerValue: String(value) };
  }
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: textValue(value) };
}

function firestoreFields(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]),
  );
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue ?? '';
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue ?? 0;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  return null;
}

export function firestoreRecord(document: FirestoreDocument) {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [
      key,
      fromFirestoreValue(value),
    ]),
  ) as Record<string, unknown>;
}

async function firestoreRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response = await fetch(`${getFirestoreRoot()}${path}`, { ...init, headers });

  // If tef-inventory-asia returns 404 (database not found), fallback to (default)
  if (!response.ok && response.status === 404 && activeDatabaseId === 'tef-inventory-asia') {
    const fallbackResponse = await fetch(`${getFirestoreRoot('(default)')}${path}`, { ...init, headers });
    if (fallbackResponse.ok || fallbackResponse.status !== 404) {
      activeDatabaseId = '(default)';
      response = fallbackResponse;
    }
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore request failed (${response.status}): ${detail.slice(0, 400)}`);
  }
  return (await response.json()) as T;
}

export async function getFirestoreDocument(
  token: string,
  collection: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const document = await firestoreRequest<FirestoreDocument>(
      token,
      `/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    );
    return firestoreRecord(document);
  } catch (error) {
    void error;
    return null;
  }
}

export async function listFirestoreCollection(token: string, collection: string) {
  const documents: FirestoreDocument[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await firestoreRequest<{
      documents?: FirestoreDocument[];
      nextPageToken?: string;
    }>(token, `/${encodeURIComponent(collection)}?${query.toString()}`);
    documents.push(...(result.documents ?? []));
    pageToken = result.nextPageToken ?? '';
  } while (pageToken);
  return documents;
}

export async function writeFirestoreDocuments(
  token: string,
  writes: Array<{ collection: string; id: string | number; record: Record<string, unknown> }>,
) {
  for (let start = 0; start < writes.length; start += 400) {
    const chunk = writes.slice(start, start + 400);
    await firestoreRequest(token, ':batchWrite', {
      method: 'POST',
      body: JSON.stringify({
        writes: chunk.map(({ collection, id, record }) => ({
          update: {
            name: documentName(collection, id),
            fields: firestoreFields(record),
          },
        })),
      }),
    });
  }
}

export async function seedFirestore(token: string, force = false) {
  if (!force) {
    const [stockDocuments, allocationDocuments] = await Promise.all([
      listFirestoreCollection(token, 'stock_items').catch(() => []),
      listFirestoreCollection(token, 'allocations').catch(() => []),
    ]);
    if (stockDocuments.length > 0 && allocationDocuments.length >= 87) {
      return { seeded: false, count: allocationDocuments.length };
    }
  }

  const writes = [
    ...stockSeeds.map((item, index) => ({
      collection: 'stock_items',
      id: item.code,
      record: { id: index + 1, ...item },
    })),
    ...allAllocationSeeds.map((item, index) => ({
      collection: 'allocations',
      id: item.id ?? index + 1,
      record: {
        id: item.id ?? index + 1,
        event: item.event,
        color: item.color,
        color_detail: item.colorDetail ?? item.color,
        bib_confirm: item.bibConfirm,
        bib_sign: item.bibSign,
        rider: item.rider,
        club: item.club,
        initial_location: item.location,
        current_location: item.location,
        current_status: item.currentStatus || 'คงคลังตั้งต้น',
        craw_qty: item.crawQty ?? 5,
        last_event: item.lastEvent ?? '',
        remark: item.remark ?? '',
        stock_code: item.stockCode,
        stock_color: item.stockColor,
        match_status: item.matchStatus,
      },
    })),
    {
      collection: 'app_meta',
      id: 'seed_version',
      record: { value: 'tef-database-v2', updated_at: new Date().toISOString() },
    },
  ];
  await writeFirestoreDocuments(token, writes);
  return { seeded: true, count: allAllocationSeeds.length };
}

export async function seedFirestoreIfEmpty(token: string) {
  return seedFirestore(token, false);
}

export async function loadFirestoreInventory(token: string) {
  try {
    await seedFirestoreIfEmpty(token);
  } catch (seedErr) {
    console.warn('Seed notice (proceeding to read):', seedErr);
  }

  const [allocationDocuments, transactionDocuments, stockDocuments] =
    await Promise.all([
      listFirestoreCollection(token, 'allocations').catch(() => []),
      listFirestoreCollection(token, 'transactions').catch(() => []),
      listFirestoreCollection(token, 'stock_items').catch(() => []),
    ]);

  const allocations = allocationDocuments.map((document) => ({
    id: Number(document.name.split('/').pop()),
    ...firestoreRecord(document),
  })) as Array<Record<string, unknown> & { id: number }>;
  allocations.sort((a, b) => Number(a.bib_confirm) - Number(b.bib_confirm));
  const allocationById = new Map(allocations.map((item) => [item.id, item]));
  const transactions = transactionDocuments.map((document) => {
    const item = firestoreRecord(document);
    const allocation = allocationById.get(Number(item.allocation_id));
    return {
      id: Number(item.id ?? document.name.split('/').pop()),
      ...item,
      bib_confirm: allocation?.bib_confirm ?? null,
      color: allocation?.color ?? '',
      event: allocation?.event ?? '',
    };
  }) as Array<Record<string, unknown>>;
  transactions.sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  transactions.splice(100);
  const stock = stockDocuments.map((document) => {
    const record = firestoreRecord(document);
    return { id: Number(record.id ?? 0), ...record };
  }) as Array<Record<string, unknown> & { id: number }>;
  stock.sort(
    (a, b) =>
      String(a.event).localeCompare(String(b.event)) ||
      String(a.bib).localeCompare(String(b.bib)),
  );

  // If collections are still empty in Firestore, use seed data as baseline
  const finalStock =
    stock.length > 0
      ? stock
      : stockSeeds.map((item, idx) => ({ id: idx + 1, ...item }));
  const finalAllocations =
    allocations.length > 0
      ? allocations
      : allAllocationSeeds.map((item, idx) => ({
          id: item.id ?? idx + 1,
          event: item.event,
          color: item.color,
          color_detail: item.colorDetail ?? item.color,
          bib_confirm: item.bibConfirm,
          bib_sign: item.bibSign,
          rider: item.rider,
          club: item.club,
          initial_location: item.location,
          current_location: item.location,
          current_status: item.currentStatus || 'คงคลังตั้งต้น',
          craw_qty: item.crawQty ?? 5,
          last_event: item.lastEvent ?? '',
          remark: item.remark ?? '',
          stock_code: item.stockCode,
          stock_color: item.stockColor,
          match_status: item.matchStatus,
        }));

  return { allocations: finalAllocations, transactions, stock: finalStock };
}

export async function applyFirestoreTransaction(
  token: string,
  allocationId: number,
  action: string,
  person: string,
  destination: string,
  note: string,
) {
  const allocationDocuments = await listFirestoreCollection(token, 'allocations');
  const allocationDocument = allocationDocuments.find(
    (document) => Number(document.name.split('/').pop()) === allocationId,
  );
  if (!allocationDocument) return { error: 'ไม่พบเสื้อ BIB ที่เลือก', status: 404 } as const;

  const allocation = firestoreRecord(allocationDocument);
  const fromLocation = textValue(allocation.current_location);
  let toLocation = destination || fromLocation;
  let nextStatus = textValue(allocation.current_status) || 'พร้อมใช้งาน';
  if (action === 'เบิก') {
    toLocation = `ผู้เบิก: ${person}`;
    nextStatus = 'ถูกเบิก';
  } else if (action === 'จ่าย') {
    toLocation = `ผู้รับ: ${person}`;
    nextStatus = 'จ่ายแล้ว';
  } else if (action === 'คืน') {
    toLocation = destination || 'สำนักงาน/สมาคม';
    nextStatus = 'พร้อมใช้งาน';
  }

  const now = new Date().toISOString();
  const transactionId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const updatedAllocation = {
    ...allocation,
    current_location: toLocation,
    current_status: nextStatus,
  };
  await writeFirestoreDocuments(token, [
    {
      collection: 'transactions',
      id: transactionId,
      record: {
        id: transactionId,
        allocation_id: allocationId,
        action,
        person,
        from_location: fromLocation,
        to_location: toLocation,
        note,
        created_at: now,
      },
    },
    { collection: 'allocations', id: allocationId, record: updatedAllocation },
  ]);
  return { ok: true } as const;
}
