import { NextResponse } from 'next/server';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function DELETE() {
    try {
        const q = query(collection(db, 'reservations'), where('isTest', '==', true));
        const snapshot = await getDocs(q);

        const deletes = snapshot.docs.map((d) => deleteDoc(doc(db, 'reservations', d.id)));
        await Promise.all(deletes);

        return NextResponse.json({ success: true, deleted: snapshot.size });
    } catch (error) {
        console.error('Delete test reservations error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete test reservations' }, { status: 500 });
    }
}
