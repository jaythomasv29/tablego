import { getServerDatabase } from '../serverFirebase';
import { mergeInventoryGoods, type CheckGood } from './model';
export { mergeInventoryGoods, type CheckGood } from './model';
export async function getInventoryGoods(): Promise<CheckGood[]> {
  const saved = await getServerDatabase().collection('inventoryOperations/goods/records').limit(1000).get();
  return mergeInventoryGoods(saved.docs.map(doc => ({ ...doc.data(), id: doc.id }) as CheckGood));
}
