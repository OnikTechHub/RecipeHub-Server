const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const nodemailer = require("nodemailer");

/**
 * Configure Nodemailer transporter from environment variables (.env)
 */
/**
 * Helper to sanitize environment variable values (stripping surrounding quotes and whitespace)
 */
const cleanEnvVar = (val) => {
  if (!val || typeof val !== "string") return "";
  return val.trim().replace(/^["']|["']$/g, "");
};

/**
 * Configure Nodemailer transporter from environment variables (.env / Render process.env)
 */
const getTransporter = () => {
  // Always ensure freshest environment variables are loaded
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

  const rawHost = cleanEnvVar(process.env.SMTP_HOST) || "smtp.gmail.com";
  const port = parseInt(cleanEnvVar(process.env.SMTP_PORT) || "587", 10);
  const user = cleanEnvVar(process.env.SMTP_USER);
  const pass = cleanEnvVar(process.env.SMTP_PASS).replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in environment variables on Render / .env"
    );
  }

  const isGmail = rawHost.toLowerCase().includes("gmail");

  // Automatic optimization for Gmail on cloud hosts like Render
  if (isGmail) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: port === 465 ? 465 : 587,
      secure: port === 465,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000, // 10 seconds connection timeout
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return nodemailer.createTransport({
    host: rawHost,
    port,
    secure: port === 465,
    pool: true,
    maxConnections: 5,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Format the sender FROM address cleanly for SMTP/Gmail
 */
const getSenderFrom = () => {
  const user = cleanEnvVar(process.env.SMTP_USER);
  const host = (cleanEnvVar(process.env.SMTP_HOST) || "smtp.gmail.com").toLowerCase();
  const configuredFrom = cleanEnvVar(process.env.EMAIL_FROM);

  if (host.includes("gmail") || !configuredFrom || configuredFrom.includes("noreply@recipehub.com")) {
    return `"RecipeHub" <${user}>`;
  }
  return configuredFrom;
};

/**
 * Verify current SMTP connection health
 */
const verifySmtpConnection = async () => {
  const transporter = getTransporter();
  await transporter.verify();
  return {
    success: true,
    user: cleanEnvVar(process.env.SMTP_USER),
    host: cleanEnvVar(process.env.SMTP_HOST) || "smtp.gmail.com",
  };
};

/**
 * Send 6-digit registration OTP verification email to user's real email address
 */
const sendRegistrationOtpEmail = async (toEmail, name, otp) => {
  const transporter = getTransporter();
  const from = getSenderFrom();

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f1f1; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🍳 RecipeHub</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Verify Your Email Address</p>
      </div>
      <div style="padding: 32px 28px; color: #333333;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Hello <strong>${name || "Chef"}</strong>,</p>
        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 24px 0;">
          Welcome to RecipeHub! Please use the 6-digit verification code below to complete your registration and activate your account.
        </p>
        <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ea580c; font-family: monospace;">${otp}</span>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9a3412;">This code expires in 5 minutes.</p>
        </div>
        <p style="font-size: 13px; color: #888888; line-height: 1.5; margin: 0;">
          If you did not request this registration code, please disregard this email.
        </p>
      </div>
      <div style="background: #fafafa; padding: 18px 24px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
        © ${new Date().getFullYear()} RecipeHub Inc. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `${otp} is your RecipeHub verification code`,
    html: htmlContent,
  });
};

/**
 * Send 6-digit password reset OTP email to user's real email address
 */
const sendPasswordResetOtpEmail = async (toEmail, otp) => {
  const transporter = getTransporter();
  const from = getSenderFrom();

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f1f1; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🍳 RecipeHub</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
      </div>
      <div style="padding: 32px 28px; color: #333333;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Hello,</p>
        <p style="font-size: 14px; color: #666666; line-height: 1.6; margin: 0 0 24px 0;">
          We received a request to reset the password for your RecipeHub account. Use the 6-digit code below to set your new password.
        </p>
        <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ea580c; font-family: monospace;">${otp}</span>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9a3412;">This code expires in 5 minutes.</p>
        </div>
        <p style="font-size: 13px; color: #888888; line-height: 1.5; margin: 0;">
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>
      <div style="background: #fafafa; padding: 18px 24px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
        © ${new Date().getFullYear()} RecipeHub Inc. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `${otp} is your RecipeHub password reset code`,
    html: htmlContent,
  });
};

/**
 * Send security alert email after successful user login
 */
const sendLoginSuccessEmail = async (toEmail, name) => {
  const transporter = getTransporter();
  const from = getSenderFrom();
  const time = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f1f1; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: #10b981; padding: 28px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">🍳 RecipeHub Security Alert</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Successful Login Detected</p>
      </div>
      <div style="padding: 28px 24px; color: #333333;">
        <p style="font-size: 15px; margin: 0 0 14px 0;">Hello <strong>${name || "Chef"}</strong>,</p>
        <p style="font-size: 14px; color: #555555; line-height: 1.6; margin: 0 0 20px 0;">
          Your RecipeHub account was successfully logged in on <strong>${time}</strong>.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; font-size: 13px; color: #166534; margin-bottom: 20px;">
          ✅ If this was you, no further action is required. Happy cooking!
        </div>
        <p style="font-size: 12px; color: #888888; line-height: 1.5; margin: 0;">
          If you did not perform this login, please reset your password immediately to protect your account.
        </p>
      </div>
      <div style="background: #fafafa; padding: 16px 24px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
        © ${new Date().getFullYear()} RecipeHub Inc.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `Security Alert: New login to your RecipeHub account`,
    html: htmlContent,
  });
};

/**
 * Send welcome / registration success email to user's real email address
 */
const sendRegistrationSuccessEmail = async (toEmail, name) => {
  const transporter = getTransporter();
  const from = getSenderFrom();

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f1f1; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🎉 Welcome to RecipeHub!</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.95;">Account Verified & Created Successfully</p>
      </div>
      <div style="padding: 32px 28px; color: #333333;">
        <p style="font-size: 16px; margin: 0 0 16px 0;">Hello <strong>${name || "Chef"}</strong>,</p>
        <p style="font-size: 14px; color: #555555; line-height: 1.6; margin: 0 0 20px 0;">
          Congratulations! Your RecipeHub account has been verified and registered successfully. You are now part of our passionate culinary community.
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #166534; font-weight: 700;">What you can do next:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.6;">
            <li>Explore thousands of trending chef recipes</li>
            <li>Publish and share your own secret culinary creations</li>
            <li>Save your favorite recipes and join premium discussions</li>
          </ul>
        </div>
        <p style="font-size: 13px; color: #888888; line-height: 1.5; margin: 0;">
          Happy cooking,<br/>
          <strong>The RecipeHub Team</strong>
        </p>
      </div>
      <div style="background: #fafafa; padding: 18px 24px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #999999;">
        © ${new Date().getFullYear()} RecipeHub Inc. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `🎉 Welcome to RecipeHub! Your Account is Ready`,
    html: htmlContent,
  });
};

/**
 * Send contact form submission directly to system administrator email
 */
const sendContactAdminEmail = async ({ name, email, subject, message }) => {
  const transporter = getTransporter();
  const from = getSenderFrom();
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || "admin@recipehub.com").trim();

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 28px 24px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800;">📬 New Contact Inquiry</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">RecipeHub Admin Notification</p>
      </div>
      <div style="padding: 28px 24px; color: #1f2937;">
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; p-4; margin-bottom: 20px; padding: 16px;">
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>From:</strong> ${name} (&lt;<a href="mailto:${email}" style="color: #ea580c;">${email}</a>&gt;)</p>
          <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
          <p style="margin: 0; font-size: 12px; color: #6b7280;"><strong>Date:</strong> ${new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}</p>
        </div>
        
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #374151;">Message Body:</h4>
        <div style="background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 6px; padding: 16px; font-size: 14px; color: #1f2937; line-height: 1.6; whitespace: pre-wrap;">
          ${message}
        </div>
        
        <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0 0; text-align: center;">
          Reply directly to this email or send a response to <a href="mailto:${email}">${email}</a>.
        </p>
      </div>
      <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} RecipeHub Server System
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"${name} via RecipeHub" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    replyTo: email,
    subject: `[Contact Form] ${subject || "Inquiry"} - from ${name}`,
    html: htmlContent,
  });
};

module.exports = {
  sendRegistrationOtpEmail,
  sendRegistrationSuccessEmail,
  sendPasswordResetOtpEmail,
  sendLoginSuccessEmail,
  sendContactAdminEmail,
  verifySmtpConnection,
};
