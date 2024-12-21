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

export async function POST(request: Request) {
  try {
    const { formData } = await request.json();

    // Verify email configuration
    console.log('Email Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.EMAIL_USER ? 'Set' : 'Not Set',
      pass: process.env.EMAIL_PASS ? 'Set' : 'Not Set'
    });

    // Save to Firebase first
    const reservationRef = await addDoc(collection(db, 'reservations'), {
      ...formData,
      createdAt: new Date(),
      status: 'confirmed'
    });

    const readableDate = new Date(formData.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
      const info = await transporter.sendMail({
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

                    <!-- Important Notice -->
                    <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #4f46e5; background: #eef2ff;">
                      <p style="margin: 0; color: #374151; font-size: 14px;">
                        Need to modify or cancel your reservation? Please call us at (650) 323-7700
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
      console.log('Email sent:', info.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send confirmation email');
    }

    return NextResponse.json({
      success: true,
      reservationId: reservationRef.id,
      reservationDetails: {
        name: formData.name,
        date: readableDate,
        time: formData.time,
        guests: formData.guests,
        email: formData.email
      }
    });
  } catch (error) {
    console.error('Operation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process reservation',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}