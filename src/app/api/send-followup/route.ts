import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { formatReadableDatePST } from '@/utils/dateUtils';
import { buildFollowUpEmailHtml } from '@/utils/followUpEmail';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tablego.vercel.app';

export async function POST(request: Request) {
    try {
        const { reservationIds } = await request.json();

        if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No reservations provided' }, { status: 400 });
        }

        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};
        const timezone = settings.timezone || 'America/Los_Angeles';

        let sent = 0;
        let failed = 0;
        const results: { id: string; success: boolean; error?: string }[] = [];

        for (const id of reservationIds) {
            try {
                const reservationRef = doc(db, 'reservations', id);
                const reservationDoc = await getDoc(reservationRef);

                if (!reservationDoc.exists()) {
                    results.push({ id, success: false, error: 'Not found' });
                    failed += 1;
                    continue;
                }

                const data = reservationDoc.data();

                if (data.status === 'cancelled' || data.followUpSent) {
                    results.push({ id, success: false, error: 'Not eligible' });
                    failed += 1;
                    continue;
                }

                if (!data.email) {
                    results.push({ id, success: false, error: 'No email on file' });
                    failed += 1;
                    continue;
                }

                const readableDate = formatReadableDatePST(data.date, timezone);
                const html = buildFollowUpEmailHtml({
                    name: data.name || 'Guest',
                    readableDate,
                    goodUrl: `${baseUrl}/api/feedback/${id}?s=good`,
                    badUrl: `${baseUrl}/api/feedback/${id}?s=bad`,
                    noshowUrl: `${baseUrl}/api/feedback/${id}?s=noshow`,
                });

                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: data.email,
                    subject: 'How was your visit to Thaiphoon Restaurant?',
                    html,
                });

                await updateDoc(reservationRef, {
                    followUpSent: true,
                    followUpSentAt: Timestamp.now(),
                });

                results.push({ id, success: true });
                sent += 1;
            } catch (err) {
                console.error(`Failed to send follow-up for reservation ${id}:`, err);
                results.push({ id, success: false, error: 'Send failed' });
                failed += 1;
            }
        }

        await addDoc(collection(db, 'cronLogs'), {
            type: 'follow-up',
            runAt: Timestamp.now(),
            sent,
            skipped: 0,
            failed,
            total: reservationIds.length,
            note: 'manual',
        });

        return NextResponse.json({ success: true, sent, failed, results });
    } catch (error) {
        console.error('Follow-up send error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send follow-up emails' }, { status: 500 });
    }
}
