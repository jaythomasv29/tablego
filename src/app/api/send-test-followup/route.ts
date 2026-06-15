import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { formatReadableDatePST, getLocalDateString, formatTimeInTimezone } from '@/utils/dateUtils';
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
        const { email } = await request.json();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
        }

        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        const settings = settingsDoc.exists() ? settingsDoc.data() : {};
        const timezone = settings.timezone || 'America/Los_Angeles';
        const delayMinutes = settings.followUpDelayMinutes ?? 90;

        // Backdate the "visit" so it's already past the follow-up delay.
        const visitTime = new Date(Date.now() - (delayMinutes + 5) * 60 * 1000);
        const dateStr = getLocalDateString(visitTime, timezone);
        const timeStr = formatTimeInTimezone(visitTime, timezone);

        const reservationRef = await addDoc(collection(db, 'reservations'), {
            name: 'Jamie Chen',
            email,
            phone: '(650) 555-0192',
            date: dateStr,
            time: timeStr,
            guests: 2,
            comments: '',
            status: 'pending',
            isTest: true,
            followUpSent: false,
            createdAt: new Date(),
        });

        const id = reservationRef.id;
        const readableDate = formatReadableDatePST(dateStr, timezone);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '[TEST] How was your visit to Thaiphoon Restaurant?',
            html: buildFollowUpEmailHtml({
                name: 'Jamie Chen',
                readableDate,
                goodUrl: `${baseUrl}/api/feedback/${id}?s=good`,
                badUrl: `${baseUrl}/api/feedback/${id}?s=bad`,
                noshowUrl: `${baseUrl}/api/feedback/${id}?s=noshow`,
            }),
        });

        await updateDoc(doc(db, 'reservations', id), {
            followUpSent: true,
            followUpSentAt: Timestamp.now(),
        });

        return NextResponse.json({ success: true, reservationId: id });
    } catch (error) {
        console.error('Test follow-up error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send test follow-up' }, { status: 500 });
    }
}
