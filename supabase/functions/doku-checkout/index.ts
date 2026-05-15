import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOKU_SECRET_KEY = Deno.env.get("DOKU_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DOKU_CHECKOUT_API_URL = Deno.env.get("DOKU_CHECKOUT_API_URL") || "";
const DOKU_CHECKOUT_SANDBOX_API_URL = Deno.env.get("DOKU_CHECKOUT_SANDBOX_API_URL") || "";
const DOKU_CHECKOUT_PROD_API_URL = Deno.env.get("DOKU_CHECKOUT_PROD_API_URL") || "";

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

async function computeHmacBase64(message: string, secret: string) {
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
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function sha256Base64(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of hashBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function normalizeUrl(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

function isHostedCheckoutUrl(value: string) {
  const normalized = String(value || '').toLowerCase();
  return normalized.includes('checkout-link') || normalized.includes('jokul.doku.com/checkout/link');
}

function isApiEndpointUrl(value: string) {
  const normalized = String(value || '').toLowerCase();
  return (normalized.includes('/checkout/') && normalized.includes('payment-url')) || normalized.includes('api.doku.com') || normalized.includes('api-sandbox.doku.com');
}

function getCheckoutApiCandidates(environment: string, configCheckoutBaseUrl: string) {
  const normalizedEnvironment = environment === 'production' ? 'production' : 'sandbox';
  const configuredUrl = normalizeUrl(configCheckoutBaseUrl);
  const candidates: string[] = [];

  if (configuredUrl && isApiEndpointUrl(configuredUrl)) {
    candidates.push(configuredUrl);
  }

  if (DOKU_CHECKOUT_API_URL) {
    candidates.push(normalizeUrl(DOKU_CHECKOUT_API_URL));
  }

  if (normalizedEnvironment === 'production') {
    if (DOKU_CHECKOUT_PROD_API_URL) {
      candidates.push(normalizeUrl(DOKU_CHECKOUT_PROD_API_URL));
    }
    candidates.push('https://api.doku.com/checkout/v2/payment-url');
    candidates.push('https://api.doku.com/checkout/v1/payment-url');
  } else {
    if (DOKU_CHECKOUT_SANDBOX_API_URL) {
      candidates.push(normalizeUrl(DOKU_CHECKOUT_SANDBOX_API_URL));
    }
    candidates.push('https://api-sandbox.doku.com/checkout/v2/payment-url');
    candidates.push('https://api-sandbox.doku.com/checkout/v1/payment-url');
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function buildCheckoutRequestBody(payload: Record<string, any>) {
  const amount = Number(payload.amount || 0);
  const bookingId = String(payload.booking_id || '').trim();
  const currency = String(payload.currency || 'IDR').toUpperCase();
  const customerName = String(payload.customer_name || '').trim();
  const customerPhone = String(payload.customer_phone || '').trim();
  const returnUrl = normalizeUrl(payload.return_url || '');

  const order: Record<string, any> = {
    amount,
    invoice_number: `INV-${bookingId}-${Date.now()}`,
    currency,
    auto_redirect: true,
    disable_retry_payment: true,
    recover_abandoned_cart: true,
  };

  if (returnUrl) {
    order.callback_url = returnUrl;
    order.callback_url_result = returnUrl;
    order.callback_url_cancel = returnUrl;
  }

  const requestBody: Record<string, any> = {
    order,
    payment: {
      payment_due_date: 60,
    },
  };

  if (customerName || customerPhone) {
    requestBody.customer = {
      id: bookingId || `BK-${Date.now()}`,
      name: customerName || 'Stadione Customer',
      phone: customerPhone || undefined,
    };
  }

  return requestBody;
}

async function buildCheckoutSignature(options: {
  clientId: string;
  requestId: string;
  timestamp: string;
  requestTarget: string;
  requestBody: Record<string, any>;
  secretKey: string;
}) {
  const bodyDigest = await sha256Base64(JSON.stringify(options.requestBody));
  const canonicalVariants = [
    [
      `Client-Id:${options.clientId}`,
      `Request-Id:${options.requestId}`,
      `Request-Timestamp:${options.timestamp}`,
      `Request-Target:${options.requestTarget}`,
      `Digest:SHA-256=${bodyDigest}`,
    ].join('\n'),
    [
      `Client-Id:${options.clientId}`,
      `Request-Id:${options.requestId}`,
      `Request-Timestamp:${options.timestamp}`,
      `Digest:SHA-256=${bodyDigest}`,
    ].join('\n'),
  ];

  const signatures: string[] = [];
  for (const canonical of canonicalVariants) {
    signatures.push(`HMACSHA256=${await computeHmacBase64(canonical, options.secretKey)}`);
  }

  return {
    bodyDigest,
    signatures,
  };
}

function extractPaymentUrl(responseData: any): string {
  return (
    responseData?.response?.payment?.url ||
    responseData?.response?.url ||
    responseData?.payment?.url ||
    responseData?.url ||
    ''
  );
}

async function requestDokuCheckoutUrl(params: {
  checkoutApiUrl: string;
  clientId: string;
  secretKey: string;
  requestBody: Record<string, any>;
}) {
  const requestUrl = new URL(params.checkoutApiUrl);
  const requestTarget = requestUrl.pathname;
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const { bodyDigest, signatures } = await buildCheckoutSignature({
    clientId: params.clientId,
    requestId,
    timestamp,
    requestTarget,
    requestBody: params.requestBody,
    secretKey: params.secretKey,
  });

  const headersBase = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Client-Id': params.clientId,
    'Request-Id': requestId,
    'Request-Timestamp': timestamp,
    Digest: `SHA-256=${bodyDigest}`,
    'Request-Target': requestTarget,
  } as Record<string, string>;

  let lastError: string | null = null;

  for (const signature of signatures) {
    const response = await fetch(params.checkoutApiUrl, {
      method: 'POST',
      headers: {
        ...headersBase,
        Signature: signature,
      },
      body: JSON.stringify(params.requestBody),
    });

    const responseText = await response.text();
    let responseJson: any = null;
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseJson = { raw: responseText };
    }

    if (response.ok) {
      const paymentUrl = extractPaymentUrl(responseJson);
      if (paymentUrl) {
        return {
          paymentUrl,
          rawResponse: responseJson,
          signature,
        };
      }
      lastError = 'DOKU checkout response did not include payment.url';
      continue;
    }

    lastError = responseJson?.error_messages?.join(', ')
      || responseJson?.message?.join?.(', ')
      || responseJson?.message
      || responseJson?.error
      || response.statusText
      || 'DOKU checkout request failed';
  }

  throw new Error(lastError || 'DOKU checkout request failed');
}

function isMissingColumnError(error: any, column: string): boolean {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes(column.toLowerCase()) && message.includes('does not exist');
}

function corsHeaders(origin: string | null = '*') {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, x-supabase-api-version, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let payload: Record<string, any> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const bookingId = payload.booking_id;
  const venueId = payload.venue_id;
  const amount = Number(payload.amount || 0);
  const currency = payload.currency || 'IDR';
  const customerName = payload.customer_name || null;
  const customerPhone = payload.customer_phone || null;

  if (!bookingId || !venueId || !amount) {
    return new Response(JSON.stringify({ error: 'Missing required payload fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: config, error: configError } = await supabase
    .from('doku_venue_config')
    .select('*')
    .eq('venue_id', venueId)
    .single();

  if (configError || !config) {
    return new Response(JSON.stringify({ error: 'DOKU configuration not found for this venue' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const orderId = `doku-${bookingId}-${Date.now()}`;
  const checkoutBaseUrl = String(config.checkout_base_url || '').trim();
  const effectiveSecretKey = String(DOKU_SECRET_KEY || config.secret_key || '').trim();
  const effectiveClientId = String(config.client_id || '').trim();

  if (!effectiveClientId || !effectiveSecretKey) {
    return new Response(JSON.stringify({ error: 'Client ID dan Secret Key DOKU belum dikonfigurasi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const requestBody = buildCheckoutRequestBody({
    booking_id: bookingId,
    amount,
    currency,
    customer_name: customerName,
    customer_phone: customerPhone,
    return_url: payload.return_url || null,
  });

  requestBody.order.invoice_number = orderId;

  let checkoutUrl = '';
  let checkoutApiResponse: Record<string, any> | null = null;

  if (isHostedCheckoutUrl(checkoutBaseUrl) && payload.checkout_url) {
    checkoutUrl = String(payload.checkout_url).trim();
  }

  if (!checkoutUrl) {
    const checkoutApiCandidates = getCheckoutApiCandidates(String(config.environment || 'sandbox'), checkoutBaseUrl);
    if (checkoutApiCandidates.length === 0) {
      return new Response(JSON.stringify({ error: 'Checkout API URL tidak ditemukan. Set DOKU Checkout API URL atau isi checkout_base_url dengan endpoint API yang valid.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    let lastCheckoutError: string | null = null;
    for (const checkoutApiUrl of checkoutApiCandidates) {
      try {
        const checkoutResult = await requestDokuCheckoutUrl({
          checkoutApiUrl,
          clientId: effectiveClientId,
          secretKey: effectiveSecretKey,
          requestBody,
        });
        checkoutUrl = checkoutResult.paymentUrl;
        checkoutApiResponse = checkoutResult.rawResponse;
        break;
      } catch (error) {
        lastCheckoutError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!checkoutUrl) {
      return new Response(JSON.stringify({ error: lastCheckoutError || 'Gagal membuat payment URL DOKU' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  }

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
      payload: requestBody,
      api_response: checkoutApiResponse,
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
    return new Response(JSON.stringify({ error: insertError.message || 'Failed to create DOKU transaction' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  return new Response(JSON.stringify({ checkout_url: checkoutUrl, transaction }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

serve(handleRequest);
