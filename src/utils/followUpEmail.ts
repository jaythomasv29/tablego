export interface FollowUpEmailParams {
    name: string;
    readableDate: string;
    time: string;
    goodUrl: string;
    badUrl: string;
    noshowUrl: string;
}

export const buildFollowUpEmailHtml = ({ name, readableDate, time, goodUrl, badUrl, noshowUrl }: FollowUpEmailParams) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; margin-bottom: 20px;">How was your visit?</h2>

        <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
            Hi ${name},
        </p>

        <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
            Thanks for dining with us at Thaiphoon Restaurant on ${readableDate} at ${time}.
            We hope you had a great time!
        </p>

        <p style="color: #374151; font-size: 16px; margin-bottom: 16px; text-align: center;">
            <strong>How was your experience?</strong>
        </p>

        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 24px;">
            <tr>
                <td align="center" style="padding: 0 8px;">
                    <a href="${goodUrl}"
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
                              width: 200px;
                              -webkit-text-size-adjust: none;">
                        &#128522; Loved it!
                    </a>
                </td>
                <td align="center" style="padding: 0 8px;">
                    <a href="${badUrl}"
                       style="background-color: #F59E0B;
                              border-radius: 6px;
                              color: #ffffff;
                              display: inline-block;
                              font-family: Arial, sans-serif;
                              font-size: 14px;
                              font-weight: bold;
                              line-height: 50px;
                              text-align: center;
                              text-decoration: none;
                              width: 200px;
                              -webkit-text-size-adjust: none;">
                        &#128528; Could've been better
                    </a>
                </td>
            </tr>
        </table>

        <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin-bottom: 30px;">
            <a href="${noshowUrl}" style="color: #9CA3AF; text-decoration: underline;">Couldn't make it tonight?</a>
        </p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB;
                    text-align: center; color: #6B7280; font-size: 14px;">
            <p style="margin: 5px 0;">Thaiphoon Restaurant</p>
            <p style="margin: 5px 0;">543 Emerson Street, Palo Alto, CA 94301</p>
            <p style="margin: 5px 0;">(650) 323-7700</p>
        </div>
    </div>
`;
