import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const signatureHeader = req.headers['paymongo-signature'];
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SIGNING_SECRET;

  // Signature verification for PayMongo payload security
  if (webhookSecret && signatureHeader) {
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = v;
      if (k === 'te' || k === 'li') signature = v;
    }

    const rawBody = JSON.stringify(req.body);
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    if (computedSignature !== signature) {
      return res.status(400).json({ error: 'Signature verification failed.' });
    }
  }

  const event = req.body.data;
  const eventType = event.attributes.type;

  // Update order status upon successful GCash/Card payment
  if (eventType === 'checkout_session.payment.paid') {
    const sessionData = event.attributes.data;
    const orderId = sessionData.attributes.metadata?.order_id;
    const paymentId = sessionData.attributes.payments?.[0]?.id;

    if (orderId) {
      await supabase
        .from('orders')
        .update({ 
          status: 'paid',
          paymongo_payment_id: paymentId 
        })
        .eq('id', orderId);
    }
  }

  return res.status(200).json({ received: true });
}
