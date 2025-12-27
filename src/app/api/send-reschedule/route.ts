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

// Helper function to format date without timezone issues
const formatDateForEmail = (dateString: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export async function POST(request: Request) {
    try {
        const { email, name, date, time, guests, reservationId } = await request.json();
        const readableDate = formatDateForEmail(date);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Reservation Rescheduled - Thaiphoon Restaurant',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5; margin-bottom: 20px;">Reservation Rescheduled Successfully</h2>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Hi ${name},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Your reservation has been successfully rescheduled. Here are your new reservation details:
                    </p>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${readableDate}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0;"><strong>Party Size:</strong> ${guests} guests</p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        If you need to make any changes to your reservation, please don't hesitate to contact us.
                    </p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; 
                                text-align: center; color: #6B7280; font-size: 14px;">
                        <p style="margin: 5px 0;">Thaiphoon Restaurant</p>
                        <p style="margin: 5px 0;">543 Emerson Street, Palo Alto, CA 94301</p>
                        <p style="margin: 5px 0;">(650) 323-7700</p>
                    </div>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to send rescheduling confirmation email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send rescheduling confirmation email' },
            { status: 500 }
        );
    }
} 