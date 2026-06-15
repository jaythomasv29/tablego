import { NextResponse } from 'next/server';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tablego.vercel.app';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const sentiment = new URL(request.url).searchParams.get('s');

    try {
        const reservationRef = doc(db, 'reservations', id);
        const reservationDoc = await getDoc(reservationRef);

        if (!reservationDoc.exists()) {
            return NextResponse.redirect(baseUrl);
        }

        if (sentiment === 'good') {
            await updateDoc(reservationRef, {
                attendanceStatus: 'show',
                feedbackSentiment: 'good',
                feedbackRespondedAt: Timestamp.now(),
            });

            const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
            const reviewUrl = settingsDoc.exists() ? settingsDoc.data().reviewUrl : null;
            return NextResponse.redirect(reviewUrl || baseUrl);
        }

        if (sentiment === 'bad') {
            await updateDoc(reservationRef, {
                attendanceStatus: 'show',
                feedbackSentiment: 'bad',
                feedbackRespondedAt: Timestamp.now(),
            });
            return NextResponse.redirect(`${baseUrl}/feedback/${id}`);
        }

        if (sentiment === 'noshow') {
            await updateDoc(reservationRef, {
                attendanceStatus: 'no-show',
                feedbackRespondedAt: Timestamp.now(),
            });
            return NextResponse.redirect(`${baseUrl}/feedback/${id}`);
        }

        return NextResponse.redirect(baseUrl);
    } catch (error) {
        console.error('Feedback link error:', error);
        return NextResponse.redirect(baseUrl);
    }
}
