import { InventoryApp } from '@/components/inventory-app';

export const dynamic = 'force-dynamic';

export default function StockPage() {
  return <InventoryApp initialStockOnly />;
}
