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

export function generateCustomerEmail(order: OrderEmailData): { subject: string; text: string; html: string } {
  const firstName = order.customer.fullName.trim().split(' ')[0] || 'Collector';
  const totalStr = order.financials.totalEur.toString();
  const subject = 'Your order has found its way to NOIRÉ.';

  const text = `Hello ${firstName},

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
${order.items.map(item => `• ${item.quantity}× Atelier NOIRÉ Archive Tracksuit — ${item.colorwayName} (Size ${item.size}) : €${item.subtotalEur}`).join('\n')}

DESTINATION:
${order.customer.fullName}
${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}
${order.customer.city}, Co. ${order.customer.county}
${order.customer.eircode}
Ireland
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:32px 12px; background-color:#111111; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#D6CCBA; line-height:1.7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#111111; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; width:100%; background-color:#161616; border:1px solid #2B2A28; text-align:left;">
          
          <!-- Header Bar -->
          <tr>
            <td style="padding:36px 36px 20px 36px; border-bottom:1px solid #2B2A28;">
              <span style="font-size:11px; letter-spacing:0.26em; text-transform:uppercase; color:#D6CCBA; display:inline-block;">
                ATELIER NOIRÉ &middot; ARCHIVE DROP
              </span>
            </td>
          </tr>

          <!-- Canonical Editorial Body -->
          <tr>
            <td style="padding:36px 36px 12px 36px;">
              
              <p style="font-size:15px; color:#FFFFFF; margin:0 0 24px 0; font-weight:400; line-height:1.7;">
                Hello ${firstName},
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Some things are made to be everywhere. We had something else in mind.
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Your order has reached us. And we're glad it did.
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Atelier NOIRÉ was built around a rather simple disagreement with the usual way things are done. Less repetition. Less noise. More intention behind what gets made and who gets to wear it.
              </p>

              <p style="font-size:15px; color:#FFFFFF; margin:0 0 36px 0; font-weight:400; line-height:1.7;">
                You're now part of that story.
              </p>

              <!-- Section: What Happens Next? -->
              <div style="font-size:11px; letter-spacing:0.24em; text-transform:uppercase; color:#FFFFFF; margin:0 0 16px 0; font-weight:600;">
                WHAT HAPPENS NEXT?
              </div>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 20px 0; font-weight:300; line-height:1.7;">
                We'll review your order and send you a confirmation once it's accepted.
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                No payment has been taken. You'll pay the courier &euro;${totalStr} upon delivery.
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                A small detail worth knowing: NOIRÉ is designed in Ireland and made in our studio in Bangladesh. We make in limited quantities, and when an edition is gone, we don't bring it back.
              </p>

              <p style="font-size:15px; color:#D6CCBA; margin:0 0 22px 0; font-weight:300; line-height:1.7;">
                Thank you for choosing to be part of something that doesn't need to be everywhere.
              </p>

              <p style="font-size:15px; color:#FFFFFF; margin:0 0 36px 0; font-weight:400; line-height:1.7;">
                See you on the other side.
              </p>

              <!-- Understated Dossier Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1B1A19; border:1px solid #2B2A28; margin:0 0 36px 0;">
                <tr>
                  <td style="padding:22px;">
                    <div style="font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#8FA9C4; margin-bottom:14px; font-family:'Courier New', Courier, monospace;">
                      ALLOCATION RECORD // ${order.orderReference}
                    </div>
                    
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6;">
                      ${order.items.map(item => `
                        <tr>
                          <td style="padding:6px 0; color:#E0D8CB; border-bottom:1px solid #262523;">
                            ${item.quantity}&times; Atelier NOIR&Eacute; Tracksuit &mdash; ${item.colorwayName} (Size ${item.size})
                          </td>
                          <td style="padding:6px 0; text-align:right; color:#FFFFFF; font-weight:bold; border-bottom:1px solid #262523; white-space:nowrap;">
                            &euro;${item.subtotalEur}.00
                          </td>
                        </tr>
                      `).join('')}
                      <tr>
                        <td style="padding:6px 0; color:#88847C;">Insured Courier Delivery (Ireland)</td>
                        <td style="padding:6px 0; text-align:right; color:#D6CCBA;">FREE</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:#88847C;">Payment Method</td>
                        <td style="padding:6px 0; text-align:right; color:#D6CCBA;">Cash on Delivery (COD)</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0 0; color:#FFFFFF; font-weight:bold; font-size:13px; border-top:1px solid #3A3936;">Total Due to Courier</td>
                        <td style="padding:10px 0 0 0; text-align:right; color:#FFFFFF; font-weight:bold; font-size:14px; border-top:1px solid #3A3936;">&euro;${totalStr}.00</td>
                      </tr>
                    </table>

                    <div style="margin-top:14px; padding-top:12px; border-top:1px dashed #2B2A28; font-family:'Courier New', Courier, monospace; font-size:11px; color:#AFA99E; line-height:1.5;">
                      <span style="color:#88847C; text-transform:uppercase; font-size:9px; letter-spacing:0.14em; display:block; margin-bottom:3px;">Courier Destination:</span>
                      ${order.customer.fullName}<br>
                      ${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}<br>
                      ${order.customer.city}, Co. ${order.customer.county}, ${order.customer.eircode} &middot; Ireland
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 36px 36px 36px; border-top:1px solid #2B2A28; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#88847C; line-height:1.8;">
              <strong style="color:#D6CCBA; font-weight:600;">ATELIER NOIRÉ</strong><br>
              Designed in Ireland. Made with intention.
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
        <h2 style="margin:6px 0 0 0; font-size:18px; color:#FFFFFF; letter-spacing:0.05em;">${order.orderReference}</h2>
      </div>
      <div style="text-align:right; font-size:11px; color:#888888;">
        ${new Date(order.createdAt).toUTCString()}
      </div>
    </div>

    <div style="background-color:#1F1E1D; border:1px solid #2B2A28; padding:16px; margin-bottom:20px;">
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr>
          <td style="color:#888888; padding:4px 0;">Customer:</td>
          <td style="color:#FFFFFF; font-weight:bold; padding:4px 0;">${order.customer.fullName}</td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0;">Email:</td>
          <td style="padding:4px 0;"><a href="mailto:${order.customer.email}" style="color:#D6CCBA;">${order.customer.email}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0;">Phone:</td>
          <td style="padding:4px 0;"><a href="tel:${order.customer.phone}" style="color:#8FA9C4; font-weight:bold;">${order.customer.phone}</a></td>
        </tr>
        <tr>
          <td style="color:#888888; padding:4px 0; vertical-align:top;">Address:</td>
          <td style="color:#FFFFFF; padding:4px 0; line-height:1.4;">
            ${order.customer.streetAddress}${order.customer.unitOrApartment ? `, ${order.customer.unitOrApartment}` : ''}<br>
            ${order.customer.city}, Co. ${order.customer.county}<br>
            <strong style="color:#D6CCBA;">${order.customer.eircode}</strong> &middot; Ireland
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#888888; margin-bottom:8px;">ITEMS ORDERED</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${order.items.map(item => `
          <tr style="border-bottom:1px solid #222222;">
            <td style="padding:8px 0; color:#FFFFFF;">
              <strong>${item.quantity}&times;</strong> Tracksuit &mdash; ${item.colorwayName} (Size <strong>${item.size}</strong>)
            </td>
            <td style="padding:8px 0; text-align:right; color:#FFFFFF; font-weight:bold;">
              &euro;${item.subtotalEur}.00
            </td>
          </tr>
        `).join('')}
        <tr>
          <td style="padding:8px 0; color:#888888;">Delivery (Insured Courier Ireland)</td>
          <td style="padding:8px 0; text-align:right; color:#D6CCBA;">FREE</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#888888;">Payment Method</td>
          <td style="padding:8px 0; text-align:right; color:#FF0800; font-weight:bold;">CASH ON DELIVERY (UNPAID)</td>
        </tr>
        <tr style="border-top:1px solid #444444;">
          <td style="padding:12px 0; font-size:15px; font-weight:bold; color:#FFFFFF;">Total COD Collection:</td>
          <td style="padding:12px 0; text-align:right; font-size:16px; font-weight:bold; color:#FFFFFF;">&euro;${order.financials.totalEur}.00</td>
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
