import { NextResponse } from 'next/server';
import { db } from '../../../firebase';
import { collection, addDoc } from 'firebase/firestore';
import nodemailer from 'nodemailer';

// Create reusable transporter with error handling
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true, // Enable debug output
    logger: true // Enable logger
});

// Add the date formatter
const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';

    // Split the date string to get year, month, day
    const [year, month, day] = dateString.split('-').map(Number);

    // Create date object with explicit UTC time at noon to avoid timezone shifts
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    });
};

export async function POST(request: Request) {
    try {
        const { formData, timezone = 'America/Los_Angeles' } = await request.json();

        // Improved date handling - extract just the date part using the restaurant's timezone
        let dateToStore = '';
        let originalDate = null;

        if (typeof formData.date === 'string') {
            // If it's already in YYYY-MM-DD format, use it directly
            if (/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
                dateToStore = formData.date;
                originalDate = new Date(formData.date + 'T12:00:00');
            } else if (formData.date.includes('T')) {
                // It's a full ISO timestamp - convert to restaurant timezone
                originalDate = new Date(formData.date);
                dateToStore = originalDate.toLocaleDateString('en-CA', { timeZone: timezone });
            } else {
                // Other string format
                originalDate = new Date(formData.date);
                dateToStore = originalDate.toLocaleDateString('en-CA', { timeZone: timezone });
            }
        } else if (formData.date instanceof Date) {
            originalDate = formData.date;
            dateToStore = formData.date.toLocaleDateString('en-CA', { timeZone: timezone });
        }
        
        console.log('Date processing:', {
            input: formData.date,
            timezone,
            dateToStore
        });

        // Format the date before sending it back
        const formattedDate = formatDisplayDate(dateToStore);

        // Create reservation document with consistent date format
        const reservationRef = await addDoc(collection(db, 'reservations'), {
            ...formData,
            date: dateToStore, // Store as YYYY-MM-DD string in PST
            status: 'pending',
            createdAt: new Date()
        });

        // Improved date formatting for email - use the clean date string and restaurant's timezone
        let readableDate = '';
        try {
            if (dateToStore && /^\d{4}-\d{2}-\d{2}$/.test(dateToStore)) {
                // We have a clean YYYY-MM-DD string, create a proper date at noon
                const dateForEmail = new Date(dateToStore + 'T12:00:00');
                readableDate = dateForEmail.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: timezone
                });
            } else if (originalDate) {
                // Use the original date object
                readableDate = originalDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: timezone
                });
            } else {
                // Fallback to formatted date
                readableDate = formattedDate || 'Date not available';
            }
        } catch (error) {
            console.error('Error formatting date for email:', error);
            console.error('dateToStore:', dateToStore);
            console.error('originalDate:', originalDate);
            readableDate = formattedDate || 'Date not available';
        }

        console.log('Date processing debug:', {
            originalFormData: formData.date,
            dateToStore,
            readableDate,
            formattedDate
        });

        // Test transporter connection
        try {
            await transporter.verify();
            console.log('SMTP connection verified');
        } catch (error) {
            console.error('SMTP verification failed:', error);
            throw new Error('Email service unavailable');
        }

        // Send email with better error handling
        try {
            // Send to customer
            const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation/${reservationRef.id}`;

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: formData.email,
                subject: 'Your Thaiphoon Restaurant Reservation Confirmation',
                html: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Reservation Confirmation</title>
                        </head>
                        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">
                                <!-- Logo and Header -->
                                <tr>
                                    <td style="padding: 40px 30px; text-align: center; background: #4f46e5; border-radius: 8px 8px 0 0;">
                                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Thaiphoon Restaurant</h1>
                                    </td>
                                </tr>
                                
                                <!-- Main Content -->
                                <tr>
                                    <td style="background: white; padding: 40px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 0 0 8px 8px;">
                                        <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 24px;">
                                            Dear ${formData.name},
                                        </p>
                                        <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 24px;">
                                            Your reservation has been confirmed! We're looking forward to serving you.
                                        </p>
                                        
                                        <!-- Reservation Details Card -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0; background: #f8fafc; border-radius: 8px; padding: 24px;">
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Name:</strong>
                                                    <span style="color: #374151;">${formData.name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Email:</strong>
                                                    <span style="color: #374151;">${formData.email}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Date:</strong>
                                                    <span style="color: #374151;">${readableDate}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Time:</strong>
                                                    <span style="color: #374151;">${formData.time}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Party Size:</strong>
                                                    <span style="color: #374151;">${formData.guests} guests</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Phone:</strong>
                                                    <span style="color: #374151;">${formData.phone}</span>
                                                </td>
                                            </tr>
                                            ${formData.comments ? `
                                                <tr>
                                                    <td style="padding: 12px 0;">
                                                        <strong style="color: #4f46e5; display: inline-block; width: 140px;">Special Requests:</strong>
                                                        <span style="color: #374151;">${formData.comments}</span>
                                                    </td>
                                                </tr>
                                            ` : ''}
                                        </table>

                                        <!-- Important Information -->
                                        <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #4f46e5; background: #eef2ff;">
                                            <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">
                                                For assistance or modifications, please call us at (650) 323-7700
                                            </p>
                                            <p style="margin: 0; color: #374151; font-size: 14px;">
                                                Need to cancel? 
                                                <a 
                                                    href="${cancelUrl}" 
                                                    style="color: #4F46E5; text-decoration: underline; margin-left: 5px;"
                                                    target="_blank"
                                                >
                                                    Click here to cancel your reservation
                                                </a>
                                            </p>
                                        </div>

                                        <!-- Restaurant Info -->
                                        <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px; line-height: 20px;">
                                            <p style="margin: 0;">
                                                Thaiphoon Restaurant<br>
                                                543 Emerson Street<br>
                                                Palo Alto, CA 94301<br>
                                                (650) 323-7700
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </body>
                    </html>
                `,
            });

            // Send copy to restaurant
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: process.env.EMAIL_USER,
                subject: `New Reservation Request - ${formData.name}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <title>New Reservation Request</title>
                        </head>
                        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">
                                <tr>
                                    <td style="padding: 40px 30px; text-align: center; background: #4f46e5; border-radius: 8px 8px 0 0;">
                                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Reservation Request</h1>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td style="background: white; padding: 40px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 0 0 8px 8px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0; background: #f8fafc; border-radius: 8px; padding: 24px;">
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Customer:</strong>
                                                    <span style="color: #374151;">${formData.name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Email:</strong>
                                                    <span style="color: #374151;">${formData.email}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Date:</strong>
                                                    <span style="color: #374151;">${readableDate}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Time:</strong>
                                                    <span style="color: #374151;">${formData.time}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Party Size:</strong>
                                                    <span style="color: #374151;">${formData.guests} guests</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Phone:</strong>
                                                    <span style="color: #374151;">${formData.phone}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <strong style="color: #4f46e5; display: inline-block; width: 140px;">Status:</strong>
                                                    <span style="color: #374151;">Pending Confirmation</span>
                                                </td>
                                            </tr>
                                        </table>

                                        <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #4f46e5; background: #eef2ff;">
                                            <p style="margin: 0; color: #374151; font-size: 14px;">
                                                Please review and confirm this reservation in the admin panel.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </body>
                    </html>
                `,
            });

            console.log('Emails sent successfully');
        } catch (error) {
            console.error('Failed to send email:', error);
            throw new Error('Failed to send confirmation email');
        }

        return NextResponse.json({
            success: true,
            reservationId: reservationRef.id,
            reservationDetails: {
                ...formData,
                date: dateToStore, // Send back the clean date string
                formattedDate, // Also send the formatted date
                reservationId: reservationRef.id
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process reservation' },
            { status: 500 }
        );
    }
}