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
        const { email, name, date, time, guests, reservationId } = await request.json();
        const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation/${reservationId}`;

        // Convert Firestore Timestamp to Date string
        const readableDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Upcoming Reservation Confirmation - Thaiphoon Restaurant',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5; margin-bottom: 20px;">Upcoming Reservation Confirmation</h2>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Hi ${name},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        We're excited to welcome you to Thaiphoon Restaurant for your upcoming reservation! 
                        Your booking is confirmed, and we're looking forward to serving you.
                    </p>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${readableDate}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0;"><strong>Party Size:</strong> ${guests} guests</p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        We understand that plans can change. If you need to cancel your reservation, 
                        simply click the button below:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${cancelUrl}" 
                           style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 6px; display: inline-block;">
                            Cancel Reservation
                        </a>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Otherwise, no further action is needed – we'll see you soon!
                    </p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; 
                                text-align: center; color: #6B7280; font-size: 14px;">
                        <p>Thaiphoon Restaurant</p>
                        <p>543 Emerson Street, Palo Alto, CA 94301</p>
                        <p>(650) 323-7700</p>
                    </div>
                </div>
            `,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to send reminder email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send reminder email' },
            { status: 500 }
        );
    }
} 