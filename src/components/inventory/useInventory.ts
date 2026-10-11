'use client';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase';
import type { InventoryItem, Vendor, LocationDoc, OrderRecord } from './model';
export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]), [vendors, setVendors] = useState<Vendor[]>([]);
  const [locations, setLocations] = useState<LocationDoc[]>([]), [orderHistory, setOrderHistory] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true), [dataError, setDataError] = useState('');
  useEffect(() => {
    const failed = () => { setDataError('Inventory data could not be loaded. Refresh before changing stock or orders.'); setLoading(false); };
    const unsubs = [
      onSnapshot(collection(db, 'inventoryVendors'), snap => setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor))), failed),
      onSnapshot(query(collection(db, 'inventoryLocations'), orderBy('sortOrder')), snap => setLocations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LocationDoc))), failed),
      onSnapshot(collection(db, 'inventoryItems'), snap => { setItems(snap.docs.map(doc => ({ id: doc.id, isHot: false, ...doc.data() } as InventoryItem))); setLoading(false); }, failed),
      onSnapshot(query(collection(db, 'inventoryOrders'), orderBy('createdAt', 'desc'), limit(100)), snap => setOrderHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderRecord))), failed),
    ];
    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, []);
  return { items, vendors, locations, orderHistory, loading, dataError };
}
