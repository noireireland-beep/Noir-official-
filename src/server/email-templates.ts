export interface OrderEmailData {
  orderReference: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    streetAddress: string;
    unitOrApartment?: string;
    city: string;
    county: string;
    eircode: string;
    country: string;
  };
  items: Array<{
    colorway: string;
    colorwayName: string;
    size: string;
    quantity: number;
    unitPriceEur: number;
    subtotalEur: number;
  }>;
  financials: {
    subtotalEur: number;
    shippingEur: number;
    totalEur: number;
    currency: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateCustomerEmail(order: OrderEmailData): { subject: string; text: string; html: string } {
  const rawFirstName = order.customer.fullName.trim().split(' ')[0] || 'Collector';
  const safeFirstName = escapeHtml(rawFirstName);
  const safeFullName = escapeHtml(order.customer.fullName);
  const safeStreet = escapeHtml(order.customer.streetAddress);
  const safeUnit = order.customer.unitOrApartment ? escapeHtml(order.customer.unitOrApartment) : '';
  const safeCity = escapeHtml(order.customer.city);
  const safeCounty = escapeHtml(order.customer.county);
  const safeEircode = escapeHtml(order.customer.eircode);
  const safeOrderRef = escapeHtml(order.orderReference);
  const totalStr = order.financials.totalEur.toString();
  const subject = 'Your order has found its way to NOIRÉ.';

  const text = `Hello ${rawFirstName},

Some things are made to be everywhere. We had something else in mind.

Your order has reached us. And we're glad it did.

Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.

You're now part of that story.

WHAT HAPPENS NEXT?

We'll review your order and send you a confirmation once it's accepted.

No payment has been taken. You'll pay the courier €${totalStr} upon delivery.

A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.

Thank you for choosing to be part of something that doesn't need to be everywhere.

See you on the other side.

ATELIER NOIRÉ
Designed in Ireland. Made with intention.

--------------------------------------------------
ALLOCATION DOSSIER: ${order.orderReference}
PAYMENT METHOD: Cash on Delivery (COD)
TOTAL PAYABLE UPON DELIVERY: €${totalStr}.00

GARMENTS:
${order.items.map(item => `• ${item.quantity}× Atelier NOIRÉ Archive Tracksuit — ${item.colorwayName} (Size ${item.size}) : €${item.subtotalEur}.00`).join('\n')}

DESTINATION:
${order.customer.fullName}
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#111111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#D6CCBA; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111; margin:0; padding:24px 12px;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; width:100%; background-color:#161616; border:1px solid #2B2A28; border-top:2px solid #D6CCBA; border-collapse:collapse; text-align:left;">

          <!-- Editorial Masthead -->
          <tr>
            <td style="padding:26px 28px 22px 28px; border-bottom:1px solid #262523;">
              <div style="font-family:Georgia, 'Times New Roman', serif; font-size:16px; letter-spacing:0.32em; text-transform:uppercase; color:#FFFFFF; font-weight:400; line-height:1.2;">
                NOIR&Eacute;
              </div>
              <div style="margin-top:6px; font-size:10px; letter-spacing:0.24em; text-transform:uppercase; color:#9E9689; line-height:1.4;">
                ATELIER NOIR&Eacute; &middot; ARCHIVE DROP
              </div>
            </td>
          </tr>

          <!-- Canonical Editorial Body -->
          <tr>
            <td style="padding:32px 28px 28px 28px;">

              <p style="font-size:15px; color:#FFFFFF; margin:0 0 20px 0; font-weight:400; line-height:1.7;">
                Hello ${safeFirstName},
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Some things are made to be everywhere. We had something else in mind.
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Your order has reached us. And we're glad it did.
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.
              </p>

              <p style="font-size:15px; color:#FFFFFF; margin:0; font-weight:400; line-height:1.75;">
                You're now part of that story.
              </p>

              <!-- Hairline Section Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 24px 0;">
                <tr>
                  <td style="border-top:1px solid #262523; height:1px; font-size:1px; line-height:1px;">&nbsp;</td>
                </tr>
              </table>

              <!-- Section: What Happens Next? -->
              <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#FFFFFF; margin:0 0 16px 0; font-weight:600; line-height:1.4;">
                WHAT HAPPENS NEXT?
              </div>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                We'll review your order and send you a confirmation once it's accepted.
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                No payment has been taken. You'll pay the courier <span style="color:#FFFFFF; font-weight:400;">&euro;${totalStr}</span> upon delivery.
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.
              </p>

              <p style="font-size:14.5px; color:#D6CCBA; margin:0 0 16px 0; font-weight:300; line-height:1.75;">
                Thank you for choosing to be part of something that doesn't need to be everywhere.
              </p>

              <p style="font-size:15px; color:#FFFFFF; margin:0 0 28px 0; font-weight:400; line-height:1.75;">
                See you on the other side.
              </p>

              <!-- Understated Dossier Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1B1A19; border:1px solid #2B2A28; border-collapse:collapse; margin:0;">
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#8FA9C4; margin:0 0 14px 0; font-family:'Courier New', Courier, monospace; line-height:1.4;">
                      ALLOCATION RECORD // ${safeOrderRef}
                    </div>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6;">
                      ${order.items.map(item => `
                        <tr>
                          <td style="padding:9px 16px 9px 0; color:#E8E2D7; border-bottom:1px solid #262523; vertical-align:top;">
                            ${item.quantity}&times; Atelier NOIR&Eacute; Tracksuit &mdash; ${escapeHtml(item.colorwayName)} (Size ${escapeHtml(item.size)})
                          </td>
                          <td style="padding:9px 0; text-align:right; color:#FFFFFF; font-weight:700; border-bottom:1px solid #262523; white-space:nowrap; vertical-align:top;">
                            &euro;${item.subtotalEur}.00
                          </td>
                        </tr>
                      `).join('')}
                      <tr>
                        <td style="padding:10px 12px 4px 0; color:#9A948A;">Insured Courier (Ireland)</td>
                        <td style="padding:10px 0 4px 0; text-align:right; color:#D6CCBA; white-space:nowrap;">FREE</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 12px 12px 0; color:#9A948A;">Payment Method</td>
                        <td style="padding:4px 0 12px 0; text-align:right; color:#D6CCBA;">Cash on Delivery (COD)</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 16px 2px 0; color:#FFFFFF; font-weight:700; font-size:13px; border-top:1px solid #3A3936;">Total Due to Courier</td>
                        <td style="padding:12px 0 2px 0; text-align:right; color:#FFFFFF; font-weight:700; font-size:14px; border-top:1px solid #3A3936; white-space:nowrap;">&euro;${totalStr}.00</td>
                      </tr>
                    </table>

                    <div style="margin-top:16px; padding-top:14px; border-top:1px dashed #2E2D2A; font-family:'Courier New', Courier, monospace; font-size:11.5px; color:#BEB7AB; line-height:1.65;">
                      <span style="color:#8E887E; text-transform:uppercase; font-size:9.5px; letter-spacing:0.16em; display:block; margin-bottom:5px;">Courier Destination</span>
                      ${safeFullName}<br>
                      ${safeStreet}${safeUnit ? `, ${safeUnit}` : ''}<br>
                      ${safeCity}, Co. ${safeCounty}, ${safeEircode} &middot; Ireland
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 28px 26px 28px; border-top:1px solid #262523;">
              <div style="font-size:11px; letter-spacing:0.22em; text-transform:uppercase; color:#D6CCBA; font-weight:600; margin:0 0 4px 0; line-height:1.5;">
                ATELIER NOIR&Eacute;
              </div>
              <div style="font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#88847C; margin:0; line-height:1.5;">
                Designed in Ireland. Made with intention.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function generateAdminEmail(order: OrderEmailData, adminDashboardUrl: string): { subject: string; text: string; html: string } {
  const subject = `NEW ORDER | ATELIER NOIRÉ | ${order.orderReference}`;
  const customerSubject = 'Your order has found its way to NOIRÉ.';
  const mailtoHref = `mailto:${encodeURIComponent(order.customer.email)}?subject=${encodeURIComponent(customerSubject)}`;

  const safeFullName = escapeHtml(order.customer.fullName);
  const safeEmail = escapeHtml(order.customer.email);
  const safePhone = escapeHtml(order.customer.phone);
  const safeStreet = escapeHtml(order.customer.streetAddress);
  const safeUnit = order.customer.unitOrApartment ? escapeHtml(order.customer.unitOrApartment) : '';
  const safeCity = escapeHtml(order.customer.city);
  const safeCounty = escapeHtml(order.customer.county);
  const safeEircode = escapeHtml(order.customer.eircode);
  const safeOrderRef = escapeHtml(order.orderReference);

  const text = `NEW ORDER RECEIVED — ATELIER NOIRÉ ARCHIVE DROP

Reference: ${order.orderReference}
Date: ${order.createdAt}
Payment Method: Cash on Delivery (COD)
Payment Status: UNPAID
Order Status: NEW

CUSTOMER DETAILS:
Name: ${order.customer.fullName}
Email: ${order.customer.email}
Phone: ${order.customer.phone}

MANUAL CUSTOMER EMAIL (FORWARD SEPARATELY):
Send To: ${order.customer.email}
Email Subject: ${customerSubject}
Note: Open the separate email titled "${customerSubject}" in your inbox and forward it directly to ${order.customer.email}.

DELIVERY ADDRESS:
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland

ITEMS ALLOCATED:
${order.items.map(i => `- ${i.quantity}× Tracksuit [${i.colorwayName} / Size ${i.size}] @ €${i.unitPriceEur} = €${i.subtotalEur}`).join('\n')}

Subtotal: €${order.financials.subtotalEur}.00
Shipping: €${order.financials.shippingEur}.00 (Free)
TOTAL PAYABLE BY COURIER: €${order.financials.totalEur}.00

Review and manage this order in the admin dashboard:
${adminDashboardUrl}
`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:20px 10px; background-color:#0D0D0D; color:#F0F2F4; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
  <div style="max-width:620px; margin:0 auto; background-color:#161616; border:1px solid #333333; padding:28px 24px;">
    
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #FF0800; padding-bottom:12px; margin-bottom:20px;">
      <div>
        <span style="background-color:#FF0800; color:#FFFFFF; font-size:10px; font-weight:bold; padding:2px 8px; letter-spacing:0.15em; text-transform:uppercase;">NEW ORDER</span>
        <h2 style="margin:6px 0 0 0; font-size:18px; color:#FFFFFF; letter-spacing:0.05em;">${safeOrderRef}</h2>
      </div>
      <div style="text-align:right; font-size:11px; color:#888888;">
        ${new Date(order.createdAt).toUTCString()}
      </div>
    </div>

    <div style="background-color:#1F1E1D; border:1px solid #2B2A28; padding:16px; margin-bottom:16px;">
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Customer:</td>
          <td style="color:#FFFFFF; font-weight:bold; padding:4px 0;">${safeFullName}</td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Email:</td>
          <td style="padding:4px 0;"><a href="mailto:${safeEmail}" style="color:#D6CCBA;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0;">Phone:</td>
          <td style="padding:4px 0;"><a href="tel:${safePhone}" style="color:#8FA9C4; font-weight:bold;">${safePhone}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 12px 4px 0; vertical-align:top;">Address:</td>
          <td style="color:#FFFFFF; padding:4px 0; line-height:1.4;">
            ${safeStreet}${safeUnit ? `, ${safeUnit}` : ''}<br>
            ${safeCity}, Co. ${safeCounty}<br>
            <strong style="color:#D6CCBA;">${safeEircode}</strong> &middot; Ireland
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color:#1A1D21; border:1px solid #8FA9C4; padding:14px 16px; margin-bottom:20px;">
      <div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:#8FA9C4; margin-bottom:8px; font-weight:bold;">
        MANUAL CUSTOMER EMAIL FORWARDING DETAILS
      </div>
      <table style="width:100%; font-size:12.5px; border-collapse:collapse;">
        <tr>
          <td style="color:#9BA3AD; padding:3px 12px 3px 0; white-space:nowrap;">Send To:</td>
          <td style="padding:3px 0;"><a href="${mailtoHref}" style="color:#FFFFFF; font-weight:bold; text-decoration:underline;">${safeEmail}</a></td>
        </tr>
        <tr>
          <td style="color:#9BA3AD; padding:3px 12px 3px 0; white-space:nowrap;">Email Subject:</td>
          <td style="color:#D6CCBA; font-weight:bold; padding:3px 0;">${customerSubject}</td>
        </tr>
      </table>
      <div style="margin-top:8px; font-size:11px; color:#A8B0BA; line-height:1.5;">
        Open the separate clean customer email in your inbox (&ldquo;${customerSubject}&rdquo;) and forward it directly to <strong style="color:#FFFFFF;">${safeEmail}</strong>.
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#888888; margin-bottom:8px;">ITEMS ORDERED</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${order.items.map(item => `
          <tr style="border-bottom:1px solid #222222;">
            <td style="padding:8px 12px 8px 0; color:#FFFFFF;">
              <strong>${item.quantity}&times;</strong> Tracksuit &mdash; ${escapeHtml(item.colorwayName)} (Size <strong>${escapeHtml(item.size)}</strong>)
            </td>
            <td style="padding:8px 0; text-align:right; color:#FFFFFF; font-weight:bold; white-space:nowrap;">
              &euro;${item.subtotalEur}.00
            </td>
          </tr>
        `).join('')}
        <tr>
          <td style="padding:8px 12px 8px 0; color:#888888;">Delivery (Insured Courier Ireland)</td>
          <td style="padding:8px 0; text-align:right; color:#D6CCBA;">FREE</td>
        </tr>
        <tr>
          <td style="padding:8px 12px 8px 0; color:#888888;">Payment Method</td>
          <td style="padding:8px 0; text-align:right; color:#FF0800; font-weight:bold;">CASH ON DELIVERY (UNPAID)</td>
        </tr>
        <tr style="border-top:1px solid #444444;">
          <td style="padding:12px 12px 12px 0; font-size:15px; font-weight:bold; color:#FFFFFF;">Total COD Collection:</td>
          <td style="padding:12px 0; text-align:right; font-size:16px; font-weight:bold; color:#FFFFFF; white-space:nowrap;">&euro;${order.financials.totalEur}.00</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center; padding:16px 0;">
      <a href="${adminDashboardUrl}" style="display:inline-block; background-color:#D6CCBA; color:#111111; text-decoration:none; padding:12px 24px; font-size:12px; font-weight:bold; letter-spacing:0.18em; text-transform:uppercase;">
        Open Admin Dashboard &rarr;
      </a>
    </div>

    <div style="font-size:11px; color:#555555; text-align:center; margin-top:20px; border-top:1px solid #222222; padding-top:12px;">
      Atelier NOIRÉ Order Management System &middot; noire.ireland@gmail.com
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
