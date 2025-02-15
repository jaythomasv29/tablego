import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export async function POST(request: Request) {
    try {
        const { email, name, date, time, guests } = await request.json();

        const readableDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send cancellation confirmation to customer
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reservation Cancellation Confirmation - Thaiphoon',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Reservation Cancelled</h2>
                    <p>Your reservation has been cancelled:</p>
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Date:</strong> ${readableDate}</p>
                        <p><strong>Time:</strong> ${time}</p>
                        <p><strong>Party Size:</strong> ${guests} guests</p>
                    </div>
                    <p>We hope to see you another time at Thaiphoon!</p>
                    <p>If you'd like to make a new reservation, please visit our website.</p>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to send cancellation email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send cancellation email' },
            { status: 500 }
        );
    }
} 