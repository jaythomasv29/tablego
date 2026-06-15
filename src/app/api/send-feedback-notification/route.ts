import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { formatReadableDatePST } from '@/utils/dateUtils';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export async function POST(request: Request) {
    try {
        const { name, email, phone, date, time, guests, feedback } = await request.json();
        const readableDate = formatReadableDatePST(date);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Guest feedback: ${name} (${readableDate})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #F59E0B; margin-bottom: 20px;">A guest left feedback about their visit</h2>

                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                        ${phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>` : ''}
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${readableDate}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0;"><strong>Party Size:</strong> ${guests} guests</p>
                    </div>

                    <p style="color: #374151; font-size: 16px; margin-bottom: 10px;"><strong>Feedback:</strong></p>
                    <p style="color: #374151; font-size: 16px; white-space: pre-wrap; background-color: #FFFBEB; padding: 16px; border-radius: 8px; border-left: 4px solid #F59E0B;">${feedback}</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to send feedback notification:', error);
        return NextResponse.json({ success: false, error: 'Failed to send notification' }, { status: 500 });
    }
}
