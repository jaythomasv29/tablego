import { getInventory } from './repository';
import { dailyStockBoard } from './dailyStock';
export async function getDailyStock() {
  const inventory = await getInventory();
  return dailyStockBoard(inventory.goods, inventory.items, inventory.today, inventory.timezone);
}
