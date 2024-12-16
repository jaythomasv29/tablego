import { NextResponse } from 'next/server';
import { db } from '../../../firebase';
import { collection, addDoc } from 'firebase/firestore';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export async function POST(request: Request) {
    try {
        const { formData } = await request.json();

        // Save to Firebase
        const cateringRef = await addDoc(collection(db, 'catering'), {
            ...formData,
            createdAt: new Date(),
            status: 'pending'
        });

        const readableDate = new Date(formData.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const selectedDishesHTML = formData.selectedDishes.map(dish => `
          <div style="display: inline-block; margin: 10px; text-align: center; width: 200px;">
            <img 
              src="${dish.imageUrl}" 
              alt="${dish.name}" 
              style="width: 180px; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;"
            />
            <div style="font-weight: 500; color: #374151;">${dish.name}</div>
            <div style="font-size: 14px; color: #6b7280;">${dish.description}</div>
          </div>
        `).join('');

        const emailContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Catering Inquiry</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 40px auto;">
            <tr>
              <td style="padding: 40px 30px; text-align: center; background: #4f46e5; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Thaiphoon Catering Inquiry</h1>
              </td>
            </tr>
            
            <tr>
              <td style="background: white; padding: 40px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 0 0 8px 8px;">
                <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                  Dear ${formData.name},
                </p>
                <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                  Thank you for your catering inquiry. We have received your request and will contact you shortly.
                </p>
                
                <table style="margin: 30px 0; background: #f8fafc; border-radius: 8px; padding: 24px; width: 100%;">
                  <tr>
                    <td style="padding: 12px 0;">
                      <strong style="color: #4f46e5; display: inline-block; width: 140px;">Event Date:</strong>
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
                      <span style="color: #374151;">${formData.partySize} guests</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <strong style="color: #4f46e5; display: inline-block; width: 140px;">Location:</strong>
                      <span style="color: #374151;">${formData.address}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <strong style="color: #4f46e5; display: inline-block; width: 140px;">Budget:</strong>
                      <span style="color: #374151;">$${formData.budget}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <strong style="color: #4f46e5; display: block; margin-bottom: 16px;">Selected Dishes:</strong>
                      <div style="display: block; text-align: center;">
                        ${selectedDishesHTML}
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="margin: 30px 0; padding: 20px; border-left: 4px solid #4f46e5; background: #eef2ff;">
                  <p style="margin: 0; color: #374151; font-size: 14px;">
                    Our catering team will review your request and contact you within 24-48 hours.
                  </p>
                </div>

                <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px;">
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
    `;

        // Send to customer
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: formData.email,
            subject: 'Thaiphoon Catering Inquiry Received',
            html: emailContent,
        });

        // Send to business
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'Action Required: New Catering Inquiry',
            html: emailContent,
        });

        return NextResponse.json({
            success: true,
            cateringId: cateringRef.id,
            details: {
                name: formData.name,
                date: readableDate,
                time: formData.time,
                partySize: formData.partySize,
                email: formData.email
            }
        });
    } catch (error) {
        console.error('Operation failed:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process catering inquiry' },
            { status: 500 }
        );
    }
}
