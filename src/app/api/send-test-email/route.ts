import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '../../../firebase';
import { collection, addDoc } from 'firebase/firestore';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const mock = {
    name: 'Jamie Chen',
    phone: '(650) 555-0192',
    dateStr: '2026-05-24',
    dateReadable: 'Saturday, May 24, 2026',
    time: '7:30 PM',
    guests: 4,
    comments: 'Celebrating a birthday — would love a quiet corner table if possible.',
};

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tablego.vercel.app';
const menuDownloadUrl = `${baseUrl}/api/menu-download`;

const buildCustomerHtml = (cancelUrl: string, rescheduleUrl: string) => `
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
                        <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">Dear ${mock.name},</p>
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
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.name}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Date</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.dateReadable}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Time</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.time}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.guests} guests</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Phone</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.phone}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0;">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Special Requests</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.comments}</span>
                                            </td>
                                        </tr>
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
`;

const buildRestaurantHtml = (guestEmail: string) => `
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
                        <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">${mock.name}</p>
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
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.name}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Email</span><br>
                                                <a href="mailto:${guestEmail}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${guestEmail}</a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Date</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.dateReadable}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Time</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.time}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.guests} guests</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Phone</span><br>
                                                <a href="tel:${mock.phone}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${mock.phone}</a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0;">
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Special Requests</span><br>
                                                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${mock.comments}</span>
                                            </td>
                                        </tr>
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
`;

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
        }

        await transporter.verify();

        // Create a real Firestore reservation so cancel/reschedule links work
        const reservationRef = await addDoc(collection(db, 'reservations'), {
            name: mock.name,
            email,
            phone: mock.phone,
            date: mock.dateStr,
            time: mock.time,
            guests: mock.guests,
            comments: mock.comments,
            status: 'pending',
            isTest: true,
            createdAt: new Date(),
            marked: false,
            phoneVerified: false,
            smsOptIn: false,
        });

        const cancelUrl = `${baseUrl}/cancel-reservation/${reservationRef.id}`;
        const rescheduleUrl = `${baseUrl}/reschedule/${reservationRef.id}`;

        // Customer copy
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: '[TEST] Your Thaiphoon Restaurant Reservation Confirmation',
            html: buildCustomerHtml(cancelUrl, rescheduleUrl),
        });

        // Restaurant copy
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: `[TEST] ${mock.name} · ${mock.guests}p @ ${mock.dateReadable} ${mock.time}`,
            html: buildRestaurantHtml(email),
        });

        return NextResponse.json({ success: true, reservationId: reservationRef.id });
    } catch (error) {
        console.error('Test email error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send test email' }, { status: 500 });
    }
}
