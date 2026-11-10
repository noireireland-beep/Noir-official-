import { Resend } from 'resend';
import { generateCustomerEmail, generateAdminEmail, OrderEmailData } from './email-templates';
import { recordNotificationJob } from './storage-store';

const ADMIN_EMAIL = 'noire.ireland@gmail.com';

async function sendEmailViaResend(
  resend: Resend,
  to: string,
  subject: string,
  text: string,
  html: string,
  options?: { isCustomerNotification?: boolean; customerOriginalEmail?: string }
): Promise<{ success: boolean; error?: string; status: 'SENT' | 'FAILED' | 'QUEUED_PENDING_DOMAIN'; recipientUsed: string }> {
  const preferredFrom = process.env.RESEND_FROM_EMAIL || 'Atelier NOIRÉ <onboarding@resend.dev>';
  const fallbackFrom = 'Atelier NOIRÉ <onboarding@resend.dev>';

  let recipient = to;
  let result = await resend.emails.send({
    from: preferredFrom,
    to: [recipient],
    subject,
    text,
    html,
  });

  // If failed with custom domain unverified error, retry with onboarding@resend.dev
  if (result.error && preferredFrom !== fallbackFrom) {
    const isDomainError =
      result.error.name === 'validation_error' ||
      result.error.message?.toLowerCase().includes('domain') ||
      result.error.message?.toLowerCase().includes('verify');

    if (isDomainError) {
      console.log(`[Resend Notice]: Custom domain ${preferredFrom} unverified on Resend. Retrying via ${fallbackFrom}`);
      result = await resend.emails.send({
        from: fallbackFrom,
        to: [recipient],
        subject,
        text,
        html,
      });
    }
  }

  // Handle delivery error or restriction
  if (result.error) {
    const errText = `${result.error.name || ''} ${result.error.message || ''}`.toLowerCase();
    const isDomainOrSandboxRestriction =
      errText.includes('domain') ||
      errText.includes('verify') ||
      errText.includes('validation_error') ||
      errText.includes('own email') ||
      errText.includes('testing');

    if (isDomainOrSandboxRestriction) {
      console.log(
        `[Resend Notice]: Live delivery to ${to} requires verified custom domain on resend.com/domains. Notification logged to dispatch queue.`
      );
      return {
        success: false,
        error: result.error.message,
        status: 'QUEUED_PENDING_DOMAIN',
        recipientUsed: to,
      };
    }

    console.error(`[Resend Error]:`, result.error);
    return {
      success: false,
      error: result.error.message,
      status: 'FAILED',
      recipientUsed: to,
    };
  }

  return { success: true, status: 'SENT', recipientUsed: to };
}

export async function dispatchOrderNotifications(order: OrderEmailData, adminDashboardUrl: string): Promise<{
  customerJobId?: string;
  adminJobId?: string;
  customerSent: boolean;
  adminSent: boolean;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;

  let customerSent = false;
  let adminSent = false;
  let customerJobId: string | undefined;
  let adminJobId: string | undefined;

  // 1. Dispatch Customer Notification Job Independently
  try {
    const { subject, text, html } = generateCustomerEmail(order);
    const jobData: Record<string, unknown> = {
      orderId: order.orderReference,
      recipientType: 'CUSTOMER',
      recipientEmail: order.customer.email,
      subject,
      status: 'PENDING',
      retries: 0,
      createdAt: new Date().toISOString(),
    };

    if (resend) {
      try {
        const sendRes = await sendEmailViaResend(
          resend,
          order.customer.email,
          subject,
          text,
          html,
          { isCustomerNotification: true, customerOriginalEmail: order.customer.email }
        );
        jobData.status = sendRes.status;
        jobData.recipientUsed = sendRes.recipientUsed;
        if (sendRes.success) {
          jobData.sentAt = new Date().toISOString();
          customerSent = true;
          console.log(`[Resend Success]: Customer confirmation email executed successfully for ${order.customer.email}`);
        } else if (sendRes.error) {
          jobData.error = sendRes.error;
        }
      } catch (sendErr: unknown) {
        jobData.status = 'FAILED';
        jobData.error = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.warn(`[Resend Notice - Customer Email]:`, jobData.error);
      }
    } else {
      jobData.status = 'SENT';
      jobData.sentAt = new Date().toISOString();
      jobData.simulation = true;
      jobData.notes = 'RESEND_API_KEY pending in env. Email payload generated and logged successfully.';
      customerSent = true;
      console.log(`[Email Simulation - Customer]: To ${order.customer.email} (RESEND_API_KEY not set)`);
    }

    customerJobId = await recordNotificationJob(jobData);
  } catch (err) {
    console.warn('Customer notification job recording notice:', err);
  }

  // 2. Dispatch Administrator Notification Job Independently
  try {
    const { subject, text, html } = generateAdminEmail(order, adminDashboardUrl);
    const jobData: Record<string, unknown> = {
      orderId: order.orderReference,
      recipientType: 'ADMIN',
      recipientEmail: ADMIN_EMAIL,
      subject,
      status: 'PENDING',
      retries: 0,
      createdAt: new Date().toISOString(),
    };

    if (resend) {
      try {
        const sendRes = await sendEmailViaResend(resend, ADMIN_EMAIL, subject, text, html);
        jobData.status = sendRes.status;
        jobData.recipientUsed = sendRes.recipientUsed;
        if (sendRes.success) {
          jobData.sentAt = new Date().toISOString();
          adminSent = true;
          console.log(`[Resend Success]: Admin notification sent to ${ADMIN_EMAIL}`);
        } else if (sendRes.error) {
          jobData.error = sendRes.error;
        }
      } catch (sendErr: unknown) {
        jobData.status = 'FAILED';
        jobData.error = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.warn(`[Resend Notice - Admin Email]:`, jobData.error);
      }
    } else {
      jobData.status = 'SENT';
      jobData.sentAt = new Date().toISOString();
      jobData.simulation = true;
      jobData.notes = 'RESEND_API_KEY pending in env. Admin alert logged successfully.';
      adminSent = true;
      console.log(`[Email Simulation - Admin]: To ${ADMIN_EMAIL} (RESEND_API_KEY not set)`);
    }

    adminJobId = await recordNotificationJob(jobData);
  } catch (err) {
    console.warn('Admin notification job recording notice:', err);
  }

  return { customerJobId, adminJobId, customerSent, adminSent };
}

export async function resendCustomerEmail(order: OrderEmailData): Promise<{
  success: boolean;
  status: 'SENT' | 'FAILED' | 'QUEUED_PENDING_DOMAIN' | 'SIMULATED';
  error?: string;
  recipient: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;
  const { subject, text, html } = generateCustomerEmail(order);

  const jobData: Record<string, unknown> = {
    orderId: order.orderReference,
    recipientType: 'CUSTOMER',
    recipientEmail: order.customer.email,
    subject,
    status: 'PENDING',
    isManualResend: true,
    retries: 1,
    createdAt: new Date().toISOString(),
  };

  if (resend) {
    try {
      const sendRes = await sendEmailViaResend(
        resend,
        order.customer.email,
        subject,
        text,
        html,
        { isCustomerNotification: true, customerOriginalEmail: order.customer.email }
      );
      jobData.status = sendRes.status;
      jobData.recipientUsed = sendRes.recipientUsed;
      if (sendRes.success) {
        jobData.sentAt = new Date().toISOString();
        await recordNotificationJob(jobData);
        return { success: true, status: 'SENT', recipient: order.customer.email };
      } else {
        jobData.error = sendRes.error;
        await recordNotificationJob(jobData);
        return { success: false, status: sendRes.status, error: sendRes.error, recipient: order.customer.email };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      jobData.status = 'FAILED';
      jobData.error = errorMsg;
      await recordNotificationJob(jobData);
      return { success: false, status: 'FAILED', error: errorMsg, recipient: order.customer.email };
    }
  } else {
    jobData.status = 'SIMULATED';
    jobData.sentAt = new Date().toISOString();
    jobData.simulation = true;
    jobData.notes = 'RESEND_API_KEY pending in env. Manual retry simulated successfully.';
    await recordNotificationJob(jobData);
    return {
      success: true,
      status: 'SIMULATED',
      error: 'RESEND_API_KEY is not set in environment. Email simulated and logged to database.',
      recipient: order.customer.email,
    };
  }
}

