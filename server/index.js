import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../lib/firebase.js';
import { collection, addDoc } from 'firebase/firestore';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.post('/api/send-confirmation', async (req, res) => {
  const { formData } = req.body;

  // Format the time from 24-hour to 12-hour format with AM/PM
  const formatTime = (time24) => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Format the date to be more readable
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  try {
    // Save to Firebase first
    const reservationRef = await addDoc(collection(db, 'reservations'), {
      ...formData,
      createdAt: new Date(),
      status: 'confirmed'
    });

    const readableTime = formatTime(formData.time);
    const readableDate = formatDate(formData.date);

    const emailContent = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>Reservation Confirmation</title>
        </head>
        <body bgcolor="#f3f4f6" style="margin:0; padding:0;">
          <!-- Outer Table -->
          <table width="100%" bgcolor="#f3f4f6" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <!-- Card Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="border: 1px solid #e5e7eb;">
                  <!-- Header -->
                  <tr>
                    <td align="center" bgcolor="#ffffff" style="padding: 40px 0; border-bottom: 1px solid #e5e7eb;">
                      <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 28px; color: #111827;">Thaiphoon</h1>
                      <p style="margin: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #6b7280;">CREATIVE ASIAN</p>
                    </td>
                  </tr>

                  <!-- Welcome Message -->
                  <tr>
                    <td align="center" bgcolor="#ffffff" style="padding: 30px 40px;">
                      <h2 style="margin: 0; font-family: Arial, sans-serif; font-size: 20px; color: #111827;">Reservation Confirmation</h2>
                      <p style="margin: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #4b5563;">Thank you for choosing to dine with us</p>
                    </td>
                  </tr>

                  <!-- Reservation Details -->
                  <tr>
                    <td style="padding: 0 40px 30px 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9fafb" style="border: 1px solid #e5e7eb;">
                        <tr>
                          <td style="padding: 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <!-- Date & Time -->
                              <tr>
                                <td style="padding: 10px 0;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td width="24">📅</td>
                                      <td style="padding-left: 10px;">
                                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Date & Time</p>
                                        <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827;"><strong>${readableDate} at ${readableTime}</strong></p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>

                              <!-- Guests -->
                              <tr>
                                <td style="padding: 10px 0;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td width="24">👥</td>
                                      <td style="padding-left: 10px;">
                                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Number of Guests</p>
                                        <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827;"><strong>${formData.guests} ${formData.guests === 1 ? 'Guest' : 'Guests'}</strong></p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>

                              <!-- Contact -->
                              <tr>
                                <td style="padding: 10px 0;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td width="24">📞</td>
                                      <td style="padding-left: 10px;">
                                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Contact</p>
                                        <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827;"><strong>${formData.phone}</strong></p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>

                              ${formData.comments ? `
                              <!-- Special Requests -->
                              <tr>
                                <td style="padding: 10px 0;">
                                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td width="24">📝</td>
                                      <td style="padding-left: 10px;">
                                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Special Requests</p>
                                        <p style="margin: 5px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; color: #111827;"><strong>${formData.comments}</strong></p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              ` : ''}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Button -->
                  <tr>
                    <td align="center" style="padding: 0 0 30px 0;">
                      <table border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" bgcolor="#4f46e5" style="padding: 12px 30px;">
                            <a href="https://thaiphoonpaloalto.com" style="color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; text-decoration: none;">Visit Our Website</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td bgcolor="#f9fafb" style="padding: 30px; border-top: 1px solid #e5e7eb;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="font-family: Arial, sans-serif; font-size: 14px; color: #6b7280; line-height: 24px;">
                            543 Emerson St, Palo Alto, CA 94301<br>
                            Phone: (650) 323-7700<br>
                            Email: ${process.env.EMAIL_USER}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // First email - to customer
    console.log('Sending email to customer:', formData.email);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: formData.email,
      subject: 'Your Thaiphoon Restaurant Reservation Confirmation',
      html: emailContent,
    });

    // Second email - to restaurant (exact same content)
    console.log('Sending copy to restaurant:', process.env.EMAIL_USER);
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // thaiphoonpaloalto@gmail.com
      subject: `New Reservation: ${formData.name} - ${readableDate} at ${readableTime}`,
      html: emailContent,
      replyTo: formData.email, // So restaurant can reply directly to customer
    });

    // Return the reservation ID with success response
    res.json({
      success: true,
      reservationId: reservationRef.id,
      reservationDetails: {
        name: formData.name,
        date: readableDate,
        time: readableTime,
        guests: formData.guests,
        email: formData.email
      }
    });
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process reservation'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});