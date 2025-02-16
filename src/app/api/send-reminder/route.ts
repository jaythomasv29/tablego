import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from "@/firebase";
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

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
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        const reservationUrl = `${baseUrl}/reservation/${reservationId}`;

        const readableDate = new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Please Confirm Your Upcoming Reservation - Thaiphoon Restaurant',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5; margin-bottom: 20px;">Upcoming Reservation Reminder</h2>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Hi ${name},
                    </p>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        This is a friendly reminder about your upcoming reservation at Thaiphoon Restaurant. 
                        Please confirm if you'll be joining us.
                    </p>
                    
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${readableDate}</p>
                        <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
                        <p style="margin: 5px 0;"><strong>Party Size:</strong> ${guests} guests</p>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                        Please let us know if your plans have changed:
                    </p>
                    
                    <!-- Action Buttons -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
                        <tr>
                            <!-- All buttons now point to the same URL -->
                            <td align="center" style="padding: 0 10px;">
                                <a href="${reservationUrl}"
                                   style="background-color: #22C55E;
                                          border-radius: 6px;
                                          color: #ffffff;
                                          display: inline-block;
                                          font-family: Arial, sans-serif;
                                          font-size: 14px;
                                          font-weight: bold;
                                          line-height: 50px;
                                          text-align: center;
                                          text-decoration: none;
                                          width: 160px;
                                          -webkit-text-size-adjust: none;">
                                    Manage Reservation
                                </a>
                            </td>
                        </tr>
                    </table>
                    
                    <p style="color: #374151; font-size: 16px; margin: 30px 0;">
                        If you're planning to join us as scheduled, please click the "Manage Reservation" button above. 
                        If you need to make changes, you can manage your reservation.
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

        // Update the reservation document to mark reminder as sent
        await updateDoc(doc(db, 'reservations', reservationId), {
            reminderSent: true,
            reminderSentAt: Timestamp.now()
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