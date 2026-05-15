import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOKU_SECRET_KEY = Deno.env.get("DOKU_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function buildUrl(base: string, params: Record<string, string | number | null | undefined>) {
  try {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  } catch {
    return base;
  }
}

async function computeHmac(message: string, secret: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isMissingColumnError(error: any, column: string): boolean {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes(column.toLowerCase()) && message.includes('does not exist');
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let payload: Record<string, any> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const bookingId = payload.booking_id;
  const venueId = payload.venue_id;
  const amount = Number(payload.amount || 0);
  const currency = payload.currency || 'IDR';
  const customerName = payload.customer_name || null;
  const customerPhone = payload.customer_phone || null;

  if (!bookingId || !venueId || !amount) {
    return new Response(JSON.stringify({ error: 'Missing required payload fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: config, error: configError } = await supabase
    .from('doku_venue_config')
    .select('*')
    .eq('venue_id', venueId)
    .single();

  if (configError || !config) {
    return new Response(JSON.stringify({ error: 'DOKU configuration not found for this venue' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const orderId = `doku-${bookingId}-${Date.now()}`;
  const checkoutBaseUrl = String(config.checkout_base_url || '').trim();
  if (!checkoutBaseUrl) {
    return new Response(JSON.stringify({ error: 'DOKU checkout base URL not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const checkoutUrl = buildUrl(checkoutBaseUrl, {
    order_id: orderId,
    amount,
    currency,
    customer_name: customerName,
    customer_phone: customerPhone,
  });

  const effectiveSecretKey = String(DOKU_SECRET_KEY || config.secret_key || '').trim();
  const signature = effectiveSecretKey
    ? await computeHmac(`${orderId}${amount}${currency}${customerPhone || ''}`, effectiveSecretKey)
    : null;

  const transactionPayload = {
    booking_id: bookingId,
    venue_id: venueId,
    amount,
    currency,
    customer_name: customerName,
    customer_phone: customerPhone,
    status: 'pending',
    checkout_url: checkoutUrl,
    doku_order_id: orderId,
    doku_response: {
      generated_at: new Date().toISOString(),
      signature,
      payload: {
        amount,
        currency,
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const insertWithSchemaFallback = async () => {
    const attempts: Array<{ key: 'price' | 'amount'; payload: Record<string, any> }> = [
      {
        key: 'price',
        payload: {
          ...transactionPayload,
          price: amount,
        },
      },
      {
        key: 'amount',
        payload: {
          ...transactionPayload,
        },
      },
    ];

    let lastError: any = null;

    for (const attempt of attempts) {
      const insertPayload = { ...attempt.payload };
      if (attempt.key === 'price') {
        delete insertPayload.amount;
      }

      const { data, error } = await supabase
        .from('doku_payment_transactions')
        .insert(insertPayload)
        .select()
        .single();

      if (!error) {
        return { data, error: null };
      }

      lastError = error;
      if ((attempt.key === 'price' && isMissingColumnError(error, 'price')) ||
          (attempt.key === 'amount' && isMissingColumnError(error, 'amount'))) {
        continue;
      }

      return { data: null, error };
    }

    return { data: null, error: lastError };
  };

  const { data: transaction, error: insertError } = await insertWithSchemaFallback();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message || 'Failed to create DOKU transaction' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ checkout_url: checkoutUrl, transaction }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(handleRequest);
