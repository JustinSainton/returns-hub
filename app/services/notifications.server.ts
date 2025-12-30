import type { ReturnRequest, ReturnItem } from "@prisma/client";

export interface NotificationConfig {
  provider: "console" | "sendgrid" | "smtp";
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface ReturnNotificationData {
  returnRequest: ReturnRequest & { items: ReturnItem[] };
  shopName: string;
  trackingUrl?: string;
  labelUrl?: string;
}

const DEFAULT_FROM_EMAIL = "noreply@returns-hub.app";
const DEFAULT_FROM_NAME = "Returns Hub";

function getConfig(): NotificationConfig {
  return {
    provider: (process.env.EMAIL_PROVIDER as NotificationConfig["provider"]) || "console",
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL,
    fromName: process.env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME,
  };
}

async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<boolean> {
  const config = getConfig();

  switch (config.provider) {
    case "sendgrid":
      return sendViaSendGrid(to, subject, htmlContent, textContent, config);
    case "smtp":
      console.log(`[SMTP] Would send email to ${to}: ${subject}`);
      return true;
    case "console":
    default:
      console.log("=== Email Notification ===");
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content: ${textContent}`);
      console.log("========================");
      return true;
  }
}

async function sendViaSendGrid(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  config: NotificationConfig
): Promise<boolean> {
  if (!config.apiKey) {
    console.error("SendGrid API key not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: config.fromEmail, name: config.fromName },
        subject,
        content: [
          { type: "text/plain", value: textContent },
          { type: "text/html", value: htmlContent },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`SendGrid error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("SendGrid send failed:", error);
    return false;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function generateReturnConfirmationEmail(data: ReturnNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const { returnRequest, shopName, items } = { ...data, items: data.returnRequest.items };
  const itemsList = items
    .map((item) => `- ${item.title} (Qty: ${item.quantity}) - ${formatCurrency(item.pricePerItem)}`)
    .join("\n");

  const itemsHtml = items
    .map(
      (item) =>
        `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formatCurrency(item.pricePerItem)}</td></tr>`
    )
    .join("");

  return {
    subject: `Return Request Received - ${returnRequest.shopifyOrderName}`,
    text: `
Your Return Request Has Been Received

Hi ${returnRequest.customerName},

Thank you for submitting your return request for order ${returnRequest.shopifyOrderName}.

Return ID: ${returnRequest.id}
Status: ${returnRequest.status.charAt(0).toUpperCase() + returnRequest.status.slice(1)}

Items:
${itemsList}

Total Refund Amount: ${formatCurrency(returnRequest.totalRefundAmount)}

What's Next:
1. We will review your return request within 1-2 business days.
2. Once approved, you will receive a prepaid shipping label via email.
3. Pack your items securely and ship them using the provided label.
4. Your refund will be processed within 5-7 business days after we receive the items.

Thank you for shopping with ${shopName}!
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #000; font-size: 24px; margin-bottom: 20px;">Your Return Request Has Been Received</h1>
  
  <p>Hi ${returnRequest.customerName},</p>
  
  <p>Thank you for submitting your return request for order <strong>${returnRequest.shopifyOrderName}</strong>.</p>
  
  <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px;"><strong>Return ID:</strong> ${returnRequest.id}</p>
    <p style="margin: 0;"><strong>Status:</strong> ${returnRequest.status.charAt(0).toUpperCase() + returnRequest.status.slice(1)}</p>
  </div>
  
  <h2 style="font-size: 18px; margin-top: 24px;">Items</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="background: #f0f0f0;">
        <th style="padding: 8px; text-align: left;">Item</th>
        <th style="padding: 8px; text-align: left;">Qty</th>
        <th style="padding: 8px; text-align: left;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  
  <p style="font-size: 18px; margin-top: 16px;"><strong>Total Refund Amount:</strong> ${formatCurrency(returnRequest.totalRefundAmount)}</p>
  
  <h2 style="font-size: 18px; margin-top: 24px;">What's Next</h2>
  <ol style="padding-left: 20px;">
    <li>We will review your return request within 1-2 business days.</li>
    <li>Once approved, you will receive a prepaid shipping label via email.</li>
    <li>Pack your items securely and ship them using the provided label.</li>
    <li>Your refund will be processed within 5-7 business days after we receive the items.</li>
  </ol>
  
  <p style="margin-top: 24px; color: #666;">Thank you for shopping with ${shopName}!</p>
</body>
</html>
    `.trim(),
  };
}

function generateReturnApprovedEmail(data: ReturnNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const { returnRequest, shopName, labelUrl } = data;

  const labelSection = labelUrl
    ? `\n\nYour prepaid shipping label is ready: ${labelUrl}\n\nPlease print the label and attach it to your package.`
    : "";

  const labelHtml = labelUrl
    ? `<div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0 0 8px;"><strong>Your prepaid shipping label is ready!</strong></p><a href="${labelUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Download Shipping Label</a></div>`
    : "";

  return {
    subject: `Return Approved - ${returnRequest.shopifyOrderName}`,
    text: `
Your Return Has Been Approved

Hi ${returnRequest.customerName},

Great news! Your return request for order ${returnRequest.shopifyOrderName} has been approved.

Return ID: ${returnRequest.id}
Total Refund Amount: ${formatCurrency(returnRequest.totalRefundAmount)}
${labelSection}

Next Steps:
1. Pack your items securely in a box or padded envelope.
2. Include any original packaging if possible.
3. Drop off your package at any authorized shipping location.
4. Your refund will be processed within 5-7 business days after we receive the items.

Thank you for shopping with ${shopName}!
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #22c55e; font-size: 24px; margin-bottom: 20px;">Your Return Has Been Approved!</h1>
  
  <p>Hi ${returnRequest.customerName},</p>
  
  <p>Great news! Your return request for order <strong>${returnRequest.shopifyOrderName}</strong> has been approved.</p>
  
  <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px;"><strong>Return ID:</strong> ${returnRequest.id}</p>
    <p style="margin: 0;"><strong>Total Refund Amount:</strong> ${formatCurrency(returnRequest.totalRefundAmount)}</p>
  </div>
  
  ${labelHtml}
  
  <h2 style="font-size: 18px; margin-top: 24px;">Next Steps</h2>
  <ol style="padding-left: 20px;">
    <li>Pack your items securely in a box or padded envelope.</li>
    <li>Include any original packaging if possible.</li>
    <li>Drop off your package at any authorized shipping location.</li>
    <li>Your refund will be processed within 5-7 business days after we receive the items.</li>
  </ol>
  
  <p style="margin-top: 24px; color: #666;">Thank you for shopping with ${shopName}!</p>
</body>
</html>
    `.trim(),
  };
}

function generateReturnDeclinedEmail(data: ReturnNotificationData & { reason?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { returnRequest, shopName, reason } = data;

  return {
    subject: `Return Request Update - ${returnRequest.shopifyOrderName}`,
    text: `
Return Request Update

Hi ${returnRequest.customerName},

We've reviewed your return request for order ${returnRequest.shopifyOrderName}.

Unfortunately, we are unable to approve this return request at this time.
${reason ? `\nReason: ${reason}` : ""}

Return ID: ${returnRequest.id}

If you have any questions, please contact our customer support team.

Thank you for shopping with ${shopName}.
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #000; font-size: 24px; margin-bottom: 20px;">Return Request Update</h1>
  
  <p>Hi ${returnRequest.customerName},</p>
  
  <p>We've reviewed your return request for order <strong>${returnRequest.shopifyOrderName}</strong>.</p>
  
  <p>Unfortunately, we are unable to approve this return request at this time.</p>
  
  ${reason ? `<div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0;"><p style="margin: 0;"><strong>Reason:</strong> ${reason}</p></div>` : ""}
  
  <p style="color: #666;">Return ID: ${returnRequest.id}</p>
  
  <p>If you have any questions, please contact our customer support team.</p>
  
  <p style="margin-top: 24px; color: #666;">Thank you for shopping with ${shopName}.</p>
</body>
</html>
    `.trim(),
  };
}

function generateReturnCompletedEmail(data: ReturnNotificationData): {
  subject: string;
  html: string;
  text: string;
} {
  const { returnRequest, shopName } = data;

  return {
    subject: `Refund Processed - ${returnRequest.shopifyOrderName}`,
    text: `
Your Refund Has Been Processed

Hi ${returnRequest.customerName},

We've received your returned items and your refund has been processed.

Return ID: ${returnRequest.id}
Order: ${returnRequest.shopifyOrderName}
Refund Amount: ${formatCurrency(returnRequest.totalRefundAmount)}

The refund will appear on your original payment method within 5-10 business days, depending on your financial institution.

Thank you for shopping with ${shopName}!
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #22c55e; font-size: 24px; margin-bottom: 20px;">Your Refund Has Been Processed</h1>
  
  <p>Hi ${returnRequest.customerName},</p>
  
  <p>We've received your returned items and your refund has been processed.</p>
  
  <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px;"><strong>Return ID:</strong> ${returnRequest.id}</p>
    <p style="margin: 0 0 8px;"><strong>Order:</strong> ${returnRequest.shopifyOrderName}</p>
    <p style="margin: 0; font-size: 20px;"><strong>Refund Amount:</strong> ${formatCurrency(returnRequest.totalRefundAmount)}</p>
  </div>
  
  <p>The refund will appear on your original payment method within 5-10 business days, depending on your financial institution.</p>
  
  <p style="margin-top: 24px; color: #666;">Thank you for shopping with ${shopName}!</p>
</body>
</html>
    `.trim(),
  };
}

export async function sendReturnConfirmation(data: ReturnNotificationData): Promise<boolean> {
  const email = generateReturnConfirmationEmail(data);
  return sendEmail(data.returnRequest.customerEmail, email.subject, email.html, email.text);
}

export async function sendReturnApproved(data: ReturnNotificationData): Promise<boolean> {
  const email = generateReturnApprovedEmail(data);
  return sendEmail(data.returnRequest.customerEmail, email.subject, email.html, email.text);
}

export async function sendReturnDeclined(data: ReturnNotificationData & { reason?: string }): Promise<boolean> {
  const email = generateReturnDeclinedEmail(data);
  return sendEmail(data.returnRequest.customerEmail, email.subject, email.html, email.text);
}

export async function sendReturnCompleted(data: ReturnNotificationData): Promise<boolean> {
  const email = generateReturnCompletedEmail(data);
  return sendEmail(data.returnRequest.customerEmail, email.subject, email.html, email.text);
}

export async function notifyMerchantNewReturn(
  merchantEmail: string,
  data: ReturnNotificationData
): Promise<boolean> {
  const { returnRequest } = data;
  const items = returnRequest.items;

  const subject = `New Return Request - ${returnRequest.shopifyOrderName}`;
  const text = `
New return request received:

Order: ${returnRequest.shopifyOrderName}
Customer: ${returnRequest.customerName} (${returnRequest.customerEmail})
Items: ${items.length}
Total Value: ${formatCurrency(returnRequest.totalRefundAmount)}
Reason: ${returnRequest.reason || "Not specified"}

View in Returns Hub to approve or decline.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2>New Return Request</h2>
  <p><strong>Order:</strong> ${returnRequest.shopifyOrderName}</p>
  <p><strong>Customer:</strong> ${returnRequest.customerName} (${returnRequest.customerEmail})</p>
  <p><strong>Items:</strong> ${items.length}</p>
  <p><strong>Total Value:</strong> ${formatCurrency(returnRequest.totalRefundAmount)}</p>
  <p><strong>Reason:</strong> ${returnRequest.reason || "Not specified"}</p>
  <p>View in Returns Hub to approve or decline.</p>
</body>
</html>
  `.trim();

  return sendEmail(merchantEmail, subject, html, text);
}
