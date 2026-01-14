// services/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPassword = async (email, password, projectName) => {
  const mailOptions = {
    from: `"${projectName}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Votre mot de passe",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Bienvenue sur ${projectName} ! </h2>
        <p>Voici votre mot de passe pour vous connecter :</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center;">
          <h1 style="letter-spacing: 8px; color: #333;">${password}</h1>
        </div>
        <p style="color: #666; margin-top: 20px;">
          ⚠️ Nous vous conseillons de changer ce mot de passe après votre première connexion.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendPassword };
