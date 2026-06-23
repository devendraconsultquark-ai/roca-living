/**
 * HTML email layout template generator to ensure design consistency.
 * Uses ROCA Living brand guidelines (#0c2340 Primary Navy).
 */
const getBaseLayout = ({ title, previewText, contentHtml, buttonText, buttonUrl }) => {
  const buttonMarkup = (buttonText && buttonUrl) ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${buttonUrl}" style="background-color: #f55b00; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px; border: 1px solid #f55b00; box-shadow: 0 2px 4px rgba(245, 91, 0, 0.2);">${buttonText}</a>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #f55b00;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #f55b00; /* Roca Living Brand Navy */
      color: #ffffff;
      padding: 30px 40px;
      text-align: center;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.05em;
      margin: 0;
      color: #ffffff !important;
      text-decoration: none;
    }
    .logo-subtext {
      font-size: 11px;
      color: #ffffff;
      letter-spacing: 0.1em;
      margin: 4px 0 0 0;
      text-transform: uppercase;
    }
    .content {
      padding: 40px;
      font-size: 15px;
      line-height: 1.6;
      color: #000000;
    }
    .content h2 {
      color: #000000;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <span style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText || title}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-text">ROCA Living</div>
        <p class="logo-subtext">Secure Portal Communications</p>
      </div>
      <div class="content">
        ${contentHtml}
        ${buttonMarkup}
      </div>
      <div class="footer">
        <p>This is an automated system notification. Please do not reply directly to this email.</p>
        <p>Roca Living Ltd © 2026. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * 1. Forgot Password Template
 */
export const getForgotPasswordEmail = (name, resetUrl) => {
  const contentHtml = `
    <h2>Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password for your Roca Living account. Please click the button below to set a new password:</p>
    <p style="color: #64748b; font-size: 13px; margin-top: 25px;">This password reset link is valid for 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
  `;

  return getBaseLayout({
    title: "Reset Your Roca Living Password",
    previewText: "Use the link inside to set a new password for your account.",
    contentHtml,
    buttonText: "Reset Password",
    buttonUrl: resetUrl
  });
};

/**
 * 2. Successful Login Alert Template
 */
export const getLoginAlertEmail = (name, { ipAddress, time, userAgent }) => {
  const contentHtml = `
    <h2>Security Alert: New Sign-in Detected</h2>
    <p>Hello ${name},</p>
    <p>Your Roca Living account was successfully logged into recently. Below are the sign-in details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #64748b; width: 100px;">Date & Time:</td>
        <td style="padding: 8px 0; color: #1e293b;">${time}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #64748b;">IP Address:</td>
        <td style="padding: 8px 0; color: #1e293b; font-family: monospace;">${ipAddress}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Device details:</td>
        <td style="padding: 8px 0; color: #1e293b;">${userAgent}</td>
      </tr>
    </table>
    <p style="color: #ef4444; font-weight: 500;">If this activity wasn't you, please change your password immediately or reach out to administration.</p>
  `;

  return getBaseLayout({
    title: "New Sign-in to Roca Living Account",
    previewText: "We detected a new sign-in to your Roca Living profile.",
    contentHtml
  });
};

/**
 * 3. Password Reset Success Confirmation Template
 */
export const getPasswordResetSuccessEmail = (name) => {
  const contentHtml = `
    <h2>Password Updated Successfully</h2>
    <p>Hello ${name},</p>
    <p>This is a confirmation that the password for your Roca Living account was changed successfully.</p>
    <p>If you made this change, no further action is required.</p>
    <p style="color: #ef4444; font-weight: 500; margin-top: 20px;">If you did not change your password, please contact support immediately to secure your account.</p>
  `;

  return getBaseLayout({
    title: "Roca Living - Password Changed",
    previewText: "Your account password was updated successfully.",
    contentHtml
  });
};
