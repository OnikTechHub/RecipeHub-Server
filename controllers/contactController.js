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

    await sendContactAdminEmail({ name, email, subject, message });
    console.log(`✉️ Contact form message from ${email} delivered to admin.`);

    return res.status(200).json({
      success: true,
      message: "Message sent successfully! We will get back to you soon.",
    });
  } catch (error) {
    console.error("❌ Contact Form Dispatch Error:", error.message || error);
    return res.status(500).json({
      success: false,
      message: error.message
        ? `Failed to send message: ${error.message}`
        : "Failed to send message. Please try again later.",
    });
  }
};

module.exports = {
  handleContactForm,
};
