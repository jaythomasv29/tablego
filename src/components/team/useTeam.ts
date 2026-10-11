'use client';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import type { Employee, WeeklyShift } from './model';
export function useTeam() {
  const [employees, setEmployees] = useState<Employee[]>([]), [weeklyShifts, setWeeklyShifts] = useState<WeeklyShift[]>([]);
  const [loading, setLoading] = useState(true), [dataError, setDataError] = useState('');
  useEffect(() => {
    const failed = () => { setDataError('Team schedules could not be loaded. Refresh before making changes.'); setLoading(false); };
    const employees = onSnapshot(collection(db, 'employees'), snapshot => setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)).sort((a, b) => a.name.localeCompare(b.name))), failed);
    const schedule = onSnapshot(collection(db, 'weeklySchedule'), snapshot => { setWeeklyShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyShift))); setLoading(false); }, failed);
    return () => { employees(); schedule(); };
  }, []);
  return { employees, weeklyShifts, loading, dataError };
}
