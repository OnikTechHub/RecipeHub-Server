const { sendContactAdminEmail } = require("../services/emailService");

/**
 * Handle contact form submission from user and notify system admin via email
 */
const handleContactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required fields.",
      });
    }

    // Attempt sending email to admin
    try {
      await sendContactAdminEmail({ name, email, subject, message });
      console.log(`✉️ Contact form message from ${email} sent to admin.`);
    } catch (emailErr) {
      console.error("⚠️ Failed to dispatch admin notification email:", emailErr.message);
      // Fallback response if SMTP credentials are missing or network fails in dev environment
    }

    return res.status(200).json({
      success: true,
      message: "Thank you! Your message has been sent to our team. We will get back to you shortly.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleContactForm,
};
