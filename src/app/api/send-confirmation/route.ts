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
        const { formData, timezone = 'America/Los_Angeles', phoneVerified = false, smsOptIn = false } = await request.json();

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



        // Format the date before sending it back
        const formattedDate = formatDisplayDate(dateToStore);

        // Create reservation document with consistent date format
        const reservationRef = await addDoc(collection(db, 'reservations'), {
            ...formData,
            date: dateToStore, // Store as YYYY-MM-DD string in PST
            status: 'pending',
            createdAt: new Date(),
            marked: false, // Track if admin has seen this reservation
            phoneVerified: phoneVerified === true,
            smsOptIn: smsOptIn === true,
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

        // console.log('Date processing debug:', {
        //     originalFormData: formData.date,
        //     dateToStore,
        //     readableDate,
        //     formattedDate
        // });

        // Test transporter connection
        try {
            await transporter.verify();

        } catch (error) {
            console.error('SMTP verification failed:', error);
            throw new Error('Email service unavailable');
        }

        // Send email with better error handling
        try {
            // Send to customer
            const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation/${reservationRef.id}`;
            const rescheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reschedule/${reservationRef.id}`;
            const menuDownloadUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/menu-download`;

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
                        <body style="margin: 0; padding: 0; background-color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">

                                <!-- Dark Hero Header -->
                                <tr>
                                    <td style="background-color: #121212; padding: 48px 40px 40px; border-radius: 16px 16px 0 0; text-align: center;">
                                        <p style="margin: 0 0 8px; color: #A3B18A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Thaiphoon · Palo Alto</p>
                                        <h1 style="margin: 0; color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; letter-spacing: -0.01em; line-height: 1.2;">Your table is confirmed.</h1>
                                        <div style="margin: 24px auto 0; width: 48px; height: 2px; background-color: #A3B18A;"></div>
                                    </td>
                                </tr>

                                <!-- Happy Hour Banner -->
                                <tr>
                                    <td style="background-color: #A3B18A; padding: 14px 32px; text-align: center;">
                                        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #121212; line-height: 1.5;">
                                            How do we feel about Thai Tuesdays or Thai Thursdays? Just kidding. &nbsp;<strong>Thai Happy Hour every day from 4pm – 6pm.</strong>
                                        </p>
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td style="background-color: #ffffff; padding: 40px 40px 32px;">
                                        <p style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #A3B18A;">Welcome</p>
                                        <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">Dear ${formData.name},</p>
                                        <p style="margin: 0 0 32px; color: #4b4b4b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.7;">
                                            We've received your reservation request and look forward to welcoming you. Your table details are below — please review them and don't hesitate to reach out with any questions.
                                        </p>

                                        <!-- Reservation Details Card -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAE0D5; border-radius: 12px; overflow: hidden;">
                                            <tr>
                                                <td style="padding: 20px 28px 4px;">
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Reservation Details</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 28px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Guest</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.name}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Date</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${readableDate}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Time</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.time}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.guests} ${formData.guests === 1 ? 'guest' : 'guests'}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; ${formData.comments ? 'border-bottom: 1px solid rgba(163,177,138,0.3);' : ''}">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Phone</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.phone}</span>
                                                            </td>
                                                        </tr>
                                                        ${formData.comments ? `
                                                        <tr>
                                                            <td style="padding: 10px 0;">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Special Requests</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.comments}</span>
                                                            </td>
                                                        </tr>
                                                        ` : ''}
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 28px 20px;"></td>
                                            </tr>
                                        </table>

                                        <!-- Cancel / Contact -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px; border-left: 3px solid #A3B18A; background-color: #F9F7F2; border-radius: 0 8px 8px 0;">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                        Questions or changes? Call us at <strong style="color: #121212;">(650) 323-7700</strong>
                                                    </p>
                                                    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                        Need to reschedule?
                                                        <a href="${rescheduleUrl}" style="color: #121212; text-decoration: underline; margin-left: 4px;" target="_blank">Modify your reservation</a>
                                                    </p>
                                                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                        Need to cancel?
                                                        <a href="${cancelUrl}" style="color: #121212; text-decoration: underline; margin-left: 4px;" target="_blank">Cancel your reservation</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Menu Download -->
                                <tr>
                                    <td style="background-color: #ffffff; padding: 0 40px 32px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #121212; border-radius: 12px; overflow: hidden;">
                                            <tr>
                                                <td style="padding: 28px 32px; text-align: center;">
                                                    <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Before you arrive</p>
                                                    <p style="margin: 0 0 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-style: italic; font-weight: normal; color: #F9F7F2; line-height: 1.3;">Browse our menu.</p>
                                                    <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #888; line-height: 1.6;">
                                                        Take a look at what we're serving — from wok-fired classics to seasonal specials.
                                                    </p>
                                                    <a href="${menuDownloadUrl}" target="_blank" style="display: inline-block; background-color: #A3B18A; color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; padding: 12px 28px; border-radius: 100px;">
                                                        Download Menu
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Catering CTA -->
                                <tr>
                                    <td style="background-color: #EAE0D5; padding: 32px 40px; text-align: center;">
                                        <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Did you know?</p>
                                        <p style="margin: 0 0 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-style: italic; font-weight: normal; color: #121212; line-height: 1.3;">We do catering.</p>
                                        <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                            Bringing Thaiphoon to your next event, office lunch, or celebration is easier than you think.
                                        </p>
                                        <a href="https://tablego.vercel.app/cater" target="_blank" style="display: inline-block; background-color: #121212; color: #F9F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; padding: 12px 28px; border-radius: 100px;">
                                            Submit an Inquiry
                                        </a>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #121212; padding: 28px 40px; border-radius: 0 0 16px 16px; text-align: center;">
                                        <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 13px; font-style: italic; color: #A3B18A;">Thaiphoon Restaurant</p>
                                        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #888; line-height: 1.8;">
                                            543 Emerson Street · Palo Alto, CA 94301 · (650) 323-7700
                                        </p>
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
                subject: `${formData.name} · ${formData.guests}p @ ${readableDate} ${formData.time}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>New Reservation</title>
                        </head>
                        <body style="margin: 0; padding: 0; background-color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">

                                <!-- Dark Hero Header -->
                                <tr>
                                    <td style="background-color: #121212; padding: 48px 40px 40px; border-radius: 16px 16px 0 0; text-align: center;">
                                        <p style="margin: 0 0 8px; color: #A3B18A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Thaiphoon · Palo Alto</p>
                                        <h1 style="margin: 0; color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; letter-spacing: -0.01em; line-height: 1.2;">New reservation request.</h1>
                                        <div style="margin: 24px auto 0; width: 48px; height: 2px; background-color: #A3B18A;"></div>
                                    </td>
                                </tr>

                                <!-- Happy Hour Banner -->
                                <tr>
                                    <td style="background-color: #A3B18A; padding: 14px 32px; text-align: center;">
                                        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #121212; line-height: 1.5;">
                                            How do we feel about Thai Tuesdays or Thai Thursdays? Just kidding. &nbsp;<strong>Thai Happy Hour every day from 4pm – 6pm.</strong>
                                        </p>
                                    </td>
                                </tr>

                                <!-- Main Content -->
                                <tr>
                                    <td style="background-color: #ffffff; padding: 40px 40px 32px;">
                                        <p style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #A3B18A;">New Reservation</p>
                                        <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">${formData.name}</p>
                                        <p style="margin: 0 0 32px; color: #4b4b4b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.7;">
                                            A new reservation request has been submitted. Review the details below and confirm in the admin panel.
                                        </p>

                                        <!-- Reservation Details Card -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAE0D5; border-radius: 12px; overflow: hidden;">
                                            <tr>
                                                <td style="padding: 20px 28px 4px;">
                                                    <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Reservation Details</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 28px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Guest</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.name}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Email</span><br>
                                                                <a href="mailto:${formData.email}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${formData.email}</a>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Date</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${readableDate}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Time</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.time}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.guests} ${formData.guests === 1 ? 'guest' : 'guests'}</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding: 10px 0; ${formData.comments ? 'border-bottom: 1px solid rgba(163,177,138,0.3);' : ''}">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Phone</span><br>
                                                                <a href="tel:${formData.phone}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${formData.phone}</a>
                                                            </td>
                                                        </tr>
                                                        ${formData.comments ? `
                                                        <tr>
                                                            <td style="padding: 10px 0;">
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Special Requests</span><br>
                                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${formData.comments}</span>
                                                            </td>
                                                        </tr>
                                                        ` : ''}
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 28px 20px;"></td>
                                            </tr>
                                        </table>

                                        <!-- Status note -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px; border-left: 3px solid #A3B18A; background-color: #F9F7F2; border-radius: 0 8px 8px 0;">
                                            <tr>
                                                <td style="padding: 18px 20px;">
                                                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                        Status: <strong style="color: #121212;">Pending Confirmation</strong> — Review this reservation in the admin panel.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Catering CTA -->
                                <tr>
                                    <td style="background-color: #EAE0D5; padding: 32px 40px; text-align: center;">
                                        <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Did you know?</p>
                                        <p style="margin: 0 0 16px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-style: italic; font-weight: normal; color: #121212; line-height: 1.3;">We do catering.</p>
                                        <p style="margin: 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                            Bringing Thaiphoon to your next event, office lunch, or celebration is easier than you think.
                                        </p>
                                        <a href="https://tablego.vercel.app/cater" target="_blank" style="display: inline-block; background-color: #121212; color: #F9F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; padding: 12px 28px; border-radius: 100px;">
                                            Submit an Inquiry
                                        </a>
                                    </td>
                                </tr>

                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #121212; padding: 28px 40px; border-radius: 0 0 16px 16px; text-align: center;">
                                        <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 13px; font-style: italic; color: #A3B18A;">Thaiphoon Restaurant</p>
                                        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #888; line-height: 1.8;">
                                            543 Emerson Street · Palo Alto, CA 94301 · (650) 323-7700
                                        </p>
                                    </td>
                                </tr>

                            </table>
                        </body>
                    </html>
                `,
            });

            // console.log('Emails sent successfully');
        } catch (error) {
            // console.error('Failed to send email:', error);
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