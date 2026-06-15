import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { formatReadableDatePST, getReservationDateTime, getTodayInTimezone } from '@/utils/dateUtils';
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

const logRun = async (result: { sent: number; skipped: number; failed: number; total: number; note?: string }) => {
    await addDoc(collection(db, 'cronLogs'), {
        type: 'follow-up',
        runAt: Timestamp.now(),
        ...result,
    });
};

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};
        const timezone = settings.timezone || 'America/Los_Angeles';

        if (!settings.followUpEnabled) {
            await logRun({ sent: 0, skipped: 0, failed: 0, total: 0, note: 'disabled' });
            return NextResponse.json({ success: true, note: 'Follow-up emails are disabled' });
        }

        const delayMinutes = settings.followUpDelayMinutes ?? 90;
        const today = getTodayInTimezone(timezone);
        const yesterday = getTodayInTimezone(timezone, -1);

        const q = query(collection(db, 'reservations'), where('date', 'in', [today, yesterday]));
        const snapshot = await getDocs(q);

        const now = new Date();
        let sent = 0;
        let failed = 0;
        let skipped = 0;
        let total = 0;

        for (const reservationDoc of snapshot.docs) {
            const data = reservationDoc.data();

            if (data.status === 'cancelled' || data.followUpSent) {
                continue;
            }

            total += 1;

            const reservationTime = getReservationDateTime(data.date, data.time, timezone);
            const dueAt = new Date(reservationTime.getTime() + delayMinutes * 60 * 1000);
            if (now < dueAt) {
                skipped += 1;
                continue;
            }

            if (!data.email) {
                skipped += 1;
                continue;
            }

            try {
                const id = reservationDoc.id;
                const readableDate = formatReadableDatePST(data.date, timezone);
                const html = buildFollowUpEmailHtml({
                    name: data.name || 'Guest',
                    readableDate,
                    time: data.time,
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

                await updateDoc(doc(db, 'reservations', id), {
                    followUpSent: true,
                    followUpSentAt: Timestamp.now(),
                });

                sent += 1;
            } catch (err) {
                console.error(`Failed to send follow-up for reservation ${reservationDoc.id}:`, err);
                failed += 1;
            }
        }

        await logRun({ sent, skipped, failed, total });

        return NextResponse.json({ success: true, sent, skipped, failed, total });
    } catch (error) {
        console.error('Follow-up cron error:', error);
        await logRun({ sent: 0, skipped: 0, failed: 0, total: 0, note: 'error' });
        return NextResponse.json({ success: false, error: 'Failed to run follow-up job' }, { status: 500 });
    }
}
