import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const formatDateForEmail = (dateString: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
        });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
};

export async function POST(request: Request) {
    try {
        const { email, name, date, time, guests, phone } = await request.json();
        const readableDate = formatDateForEmail(date);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tablego.vercel.app';

        // Customer email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Thaiphoon Reservation Has Been Cancelled',
            html: `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Reservation Cancelled</title>
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">

                            <!-- Header -->
                            <tr>
                                <td style="background-color: #121212; padding: 48px 40px 40px; border-radius: 16px 16px 0 0; text-align: center;">
                                    <p style="margin: 0 0 8px; color: #A3B18A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Thaiphoon · Palo Alto</p>
                                    <h1 style="margin: 0; color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; letter-spacing: -0.01em; line-height: 1.2;">Reservation cancelled.</h1>
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
                                    <p style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #A3B18A;">We'll miss you</p>
                                    <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">Dear ${name},</p>
                                    <p style="margin: 0 0 32px; color: #4b4b4b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.7;">
                                        Your reservation has been cancelled. We hope to welcome you another time — the table will always be waiting.
                                    </p>

                                    <!-- Cancelled Details Card -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAE0D5; border-radius: 12px; overflow: hidden;">
                                        <tr>
                                            <td style="padding: 20px 28px 4px;">
                                                <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Cancelled Reservation</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 12px 28px;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Guest</span><br>
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${name}</span>
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
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${time}</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 10px 0;">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${guests} ${guests === 1 ? 'guest' : 'guests'}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr><td style="padding: 4px 28px 20px;"></td></tr>
                                    </table>

                                    <!-- Rebook CTA -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px; border-left: 3px solid #A3B18A; background-color: #F9F7F2; border-radius: 0 8px 8px 0;">
                                        <tr>
                                            <td style="padding: 18px 20px;">
                                                <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                    Changed your mind? We'd love to have you.
                                                    <a href="${baseUrl}" style="color: #121212; text-decoration: underline; margin-left: 4px;" target="_blank">Make a new reservation</a>
                                                </p>
                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                    Questions? Call us at <strong style="color: #121212;">(650) 323-7700</strong>
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

        // Restaurant notification
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: `Cancelled — ${name} · ${guests}p @ ${readableDate} ${time}`,
            html: `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Reservation Cancelled</title>
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">

                            <!-- Header -->
                            <tr>
                                <td style="background-color: #121212; padding: 48px 40px 40px; border-radius: 16px 16px 0 0; text-align: center;">
                                    <p style="margin: 0 0 8px; color: #A3B18A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Thaiphoon · Palo Alto</p>
                                    <h1 style="margin: 0; color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; letter-spacing: -0.01em; line-height: 1.2;">Reservation cancelled.</h1>
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
                                    <p style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #A3B18A;">Cancellation</p>
                                    <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">${name}</p>
                                    <p style="margin: 0 0 32px; color: #4b4b4b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.7;">
                                        A guest has cancelled their reservation via self-service.
                                    </p>

                                    <!-- Details Card -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAE0D5; border-radius: 12px; overflow: hidden;">
                                        <tr>
                                            <td style="padding: 20px 28px 4px;">
                                                <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Cancelled Reservation</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 12px 28px;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Guest</span><br>
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${name}</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Email</span><br>
                                                            <a href="mailto:${email}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${email}</a>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(163,177,138,0.3);">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Phone</span><br>
                                                            <a href="tel:${phone}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; text-decoration: none; margin-top: 3px; display: block;">${phone || '—'}</a>
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
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${time}</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 10px 0;">
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6b6b;">Party Size</span><br>
                                                            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #121212; margin-top: 3px; display: block;">${guests} ${guests === 1 ? 'guest' : 'guests'}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                        <tr><td style="padding: 4px 28px 20px;"></td></tr>
                                    </table>

                                    <!-- Status note -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 28px; border-left: 3px solid #A3B18A; background-color: #F9F7F2; border-radius: 0 8px 8px 0;">
                                        <tr>
                                            <td style="padding: 18px 20px;">
                                                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #4b4b4b; line-height: 1.6;">
                                                    Status updated to <strong style="color: #121212;">Cancelled</strong> — no further action required.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to send cancellation email:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to send cancellation email' },
            { status: 500 }
        );
    }
}
