export interface FollowUpEmailParams {
    name: string;
    readableDate: string;
    goodUrl: string;
    badUrl: string;
    noshowUrl: string;
}

export const buildFollowUpEmailHtml = ({ name, readableDate, goodUrl, badUrl, noshowUrl }: FollowUpEmailParams) => `
    <!DOCTYPE html>
    <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>How was your visit?</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">

                <!-- Dark Hero Header -->
                <tr>
                    <td style="background-color: #121212; padding: 48px 40px 40px; border-radius: 16px 16px 0 0; text-align: center;">
                        <p style="margin: 0 0 8px; color: #A3B18A; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">Thaiphoon · Palo Alto</p>
                        <h1 style="margin: 0; color: #F9F7F2; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: normal; font-style: italic; letter-spacing: -0.01em; line-height: 1.2;">How was your visit?</h1>
                        <div style="margin: 24px auto 0; width: 48px; height: 2px; background-color: #A3B18A;"></div>
                    </td>
                </tr>

                <!-- Main Content -->
                <tr>
                    <td style="background-color: #ffffff; padding: 40px 40px 32px;">
                        <p style="margin: 0 0 8px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #A3B18A;">Thank You</p>
                        <p style="margin: 0 0 28px; color: #121212; font-family: Georgia, serif; font-size: 22px; font-style: italic; font-weight: normal;">Dear ${name},</p>
                        <p style="margin: 0 0 32px; color: #4b4b4b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; line-height: 1.7;">
                            Thanks for dining with us on ${readableDate}. We hope you had a great time — we'd love to hear how it went.
                        </p>

                        <!-- Feedback CTA Card -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #EAE0D5; border-radius: 12px; overflow: hidden;">
                            <tr>
                                <td style="padding: 28px 28px 24px; text-align: center;">
                                    <p style="margin: 0 0 4px; font-family: Georgia, serif; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #A3B18A;">Quick Question</p>
                                    <p style="margin: 0 0 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-style: italic; font-weight: normal; color: #121212; line-height: 1.3;">How was your experience?</p>

                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                        <tr>
                                            <td align="center" style="padding: 0 6px 12px;">
                                                <a href="${goodUrl}" target="_blank" style="display: inline-block; min-width: 170px; background-color: #A3B18A; color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; padding: 14px 28px; border-radius: 100px; text-align: center;">
                                                    Loved it
                                                </a>
                                            </td>
                                            <td align="center" style="padding: 0 6px 12px;">
                                                <a href="${badUrl}" target="_blank" style="display: inline-block; min-width: 110px; background-color: #121212; color: #F9F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; padding: 14px 16px; border-radius: 100px; text-align: center;">
                                                    Could've been better
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>

                        <p style="margin: 24px 0 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #9CA3AF;">
                            <a href="${noshowUrl}" style="color: #9CA3AF; text-decoration: underline;">Couldn't make it that night?</a>
                        </p>
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
