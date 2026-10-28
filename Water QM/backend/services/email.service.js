const nodemailer = require('nodemailer');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: { user, pass }
    });
  }
  return null;
}

async function sendContactForwardEmail({ name, email, subject, message }) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@aquamonitor.in';
  const transporter = getTransporter();

  const mailOptions = {
    from: process.env.SMTP_FROM || 'AquaMonitor Admin <alerts@aquamonitor.in>',
    to: adminEmail,
    replyTo: email,
    subject: `[AquaMonitor Contact] [${subject}] from ${name}`,
    text: `New contact submission on AquaMonitor Pro:\n\nSender: ${name} (${email})\nSubject: ${subject}\n\nMessage:\n${message}\n\nDate: ${new Date().toISOString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #2563eb;">New AquaMonitor Contact Message</h2>
        <p><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
        <p><strong>Topic / Subject:</strong> ${subject}</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
        <p style="color: #64748b; font-size: 12px;">Submitted on ${new Date().toLocaleString()}</p>
      </div>
    `
  };

  if (!transporter) {
    console.log(`[Email Sandbox] Contact forwarded to Admin (${adminEmail}) from ${name} <${email}>: "${subject}"`);
    return { success: true, sandbox: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Forwarded to ${adminEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed sending contact forward:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendAlertEmail({ toEmail, station, parameter, value, threshold, severity }) {
  const transporter = getTransporter();
  const mailOptions = {
    from: process.env.SMTP_FROM || 'AquaMonitor Alerts <alerts@aquamonitor.in>',
    to: toEmail,
    subject: `[ALERT] ${severity.toUpperCase()} Water Quality at ${station}`,
    text: `AquaMonitor Alert:\nStation: ${station}\nParameter: ${parameter} is ${value} (Threshold: ${threshold})\nSeverity: ${severity}\nTime: ${new Date().toLocaleString()}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: ${severity === 'Critical' ? '#dc2626' : '#d97706'};">⚠️ Water Quality Alert: ${severity}</h2>
        <p><strong>Station:</strong> ${station}</p>
        <p><strong>Parameter:</strong> ${parameter}</p>
        <p><strong>Current Value:</strong> <span style="font-weight: bold; color: #dc2626;">${value}</span></p>
        <p><strong>Safe Limit:</strong> ${threshold}</p>
        <p style="color: #64748b; font-size: 12px;">Recorded at ${new Date().toLocaleString()} by AquaMonitor Pro IoT Station.</p>
      </div>
    `
  };

  if (!transporter) {
    console.log(`[Email Sandbox] Alert email dispatched to ${toEmail}: [${severity}] ${station} ${parameter}=${value}`);
    return { success: true, sandbox: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed sending alert to ${toEmail}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendContactForwardEmail,
  sendAlertEmail
};
