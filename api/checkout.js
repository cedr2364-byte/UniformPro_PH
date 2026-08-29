export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, amount, description, successUrl, cancelUrl } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: 'Missing required order or amount payload.' });
  }

  try {
    const authHeader = Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString('base64');

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            cancel_url: cancelUrl,
            success_url: successUrl,
            description: description,
            payment_method_types: ['gcash', 'card', 'paymaya'],
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(amount * 100), // convert PHP value to centavos
                description: description,
                name: description,
                quantity: 1
              }
            ],
            metadata: {
              order_id: orderId
            }
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.errors?.[0]?.detail || 'PayMongo checkout session creation failed.' });
    }

    return res.status(200).json({ 
      checkoutUrl: data.data.attributes.checkout_url,
      checkoutSessionId: data.data.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
