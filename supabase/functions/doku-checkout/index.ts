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
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    const isApiHost =
      host === 'api.doku.com' ||
      host === 'api-sandbox.doku.com' ||
      host.endsWith('.api.doku.com') ||
      host.endsWith('.api-sandbox.doku.com');

    const hasCheckoutPaymentPath =
      path.includes('/checkout/v1/payment') ||
      path.includes('/checkout/v2/payment-url') ||
      path.includes('/checkout/v1/payment-url');

    return isApiHost && hasCheckoutPaymentPath;
  } catch {
    return false;
  }
}

function getCheckoutApiCandidates(environment: string, configCheckoutBaseUrl: string) {
  const normalizedEnvironment = environment === 'production' ? 'production' : 'sandbox';
  const configuredUrl = normalizeUrl(configCheckoutBaseUrl);
  const candidates: string[] = [];

  if (configuredUrl && isApiEndpointUrl(configuredUrl)) {
    candidates.push(configuredUrl);
  }

  if (DOKU_CHECKOUT_API_URL) {
    const envApiUrl = normalizeUrl(DOKU_CHECKOUT_API_URL);
    if (isApiEndpointUrl(envApiUrl)) {
      candidates.push(envApiUrl);
    }
  }

  if (normalizedEnvironment === 'production') {
    if (DOKU_CHECKOUT_PROD_API_URL) {
      const prodApiUrl = normalizeUrl(DOKU_CHECKOUT_PROD_API_URL);
      if (isApiEndpointUrl(prodApiUrl)) {
        candidates.push(prodApiUrl);
      }
    }
    candidates.push('https://api.doku.com/checkout/v1/payment');
  } else {
    if (DOKU_CHECKOUT_SANDBOX_API_URL) {
      const sandboxApiUrl = normalizeUrl(DOKU_CHECKOUT_SANDBOX_API_URL);
      if (isApiEndpointUrl(sandboxApiUrl)) {
        candidates.push(sandboxApiUrl);
      }
    }
    candidates.push('https://api-sandbox.doku.com/checkout/v1/payment');
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
  const canonical = [
    `Client-Id:${options.clientId}`,
    `Request-Id:${options.requestId}`,
    `Request-Timestamp:${options.timestamp}`,
    `Request-Target:${options.requestTarget}`,
    `Digest:${bodyDigest}`,
  ].join('\n');

  const signature = `HMACSHA256=${await computeHmacBase64(canonical, options.secretKey)}`;

  return {
    bodyDigest,
    signature,
  };
}

function extractPaymentUrl(responseData: any): string {
  return (
    responseData?.response?.payment?.url ||
    responseData?.payment?.url ||
    responseData?.response?.url ||
    responseData?.url ||
    ''
  );
}

function isLegacyCheckoutUrl(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const hasLegacyQuery = ['order_id', 'amount', 'currency'].some((key) => url.searchParams.has(key));
    const hasModernToken = ['token', 'payment_token', 'checkout_token', 'session', 'session_id'].some((key) => url.searchParams.has(key));

    return (host === 'checkout.doku.com' || host.endsWith('.checkout.doku.com')) && hasLegacyQuery && !hasModernToken;
  } catch {
    return false;
  }
}

function normalizeErrorText(input: any): string {
  const safe = (value: any) => {
    const text = String(value ?? '').trim();
    if (!text || text === '[object Object]') return '';
    return text;
  };

  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return safe(input);

  if (Array.isArray(input)) {
    return input
      .map((item) => normalizeErrorText(item))
      .filter(Boolean)
      .join(', ')
      .trim();
  }

  if (typeof input === 'object') {
    const nested =
      normalizeErrorText(input.error_messages) ||
      normalizeErrorText(input.errors) ||
      normalizeErrorText(input.error) ||
      normalizeErrorText(input.message) ||
      normalizeErrorText(input.details) ||
      normalizeErrorText(input.hint) ||
      normalizeErrorText(input.response?.message) ||
      normalizeErrorText(input.response?.error);

    if (nested) return nested;

    try {
      return safe(JSON.stringify(input));
    } catch {
      return '';
    }
  }

  return safe(input);
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
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const { bodyDigest, signature } = await buildCheckoutSignature({
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
    Digest: bodyDigest,
    'Request-Target': requestTarget,
  } as Record<string, string>;

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
    throw new Error('DOKU checkout response did not include payment.url');
  }

  throw new Error(
    `DOKU ${response.status} ${params.checkoutApiUrl}: ${
      normalizeErrorText(responseJson)
      || normalizeErrorText(responseText)
      || normalizeErrorText(response.statusText)
      || 'DOKU checkout request failed'
    }`
  );
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

  if (amount < 1000) {
    return new Response(JSON.stringify({
      error: 'Minimum pembayaran DOKU adalah IDR 1.000.',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: venueConfig, error: venueConfigError } = await supabase
    .from('doku_venue_config')
    .select('*')
    .eq('venue_id', venueId)
    .maybeSingle();

  if (venueConfigError) {
    return new Response(JSON.stringify({ error: venueConfigError.message || 'Failed to load DOKU venue configuration' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  // Fallback to the latest usable config when a venue-specific row is missing.
  // This keeps checkout available for venues that share one DOKU merchant profile.
  let config = venueConfig;
  let configSource = 'venue';

  if (!config) {
    const { data: sharedConfig, error: sharedConfigError } = await supabase
      .from('doku_venue_config')
      .select('*')
      .not('client_id', 'is', null)
      .not('secret_key', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sharedConfigError) {
      return new Response(JSON.stringify({ error: sharedConfigError.message || 'Failed to load shared DOKU configuration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!sharedConfig) {
      return new Response(JSON.stringify({ error: 'DOKU configuration not found for this venue' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    config = sharedConfig;
    configSource = 'shared';
  }

  const orderId = `doku-${bookingId}-${Date.now()}`;
  const checkoutBaseUrl = String(config?.checkout_base_url || '').trim();
  const effectiveSecretKey = String(DOKU_SECRET_KEY || config?.secret_key || '').trim();
  const effectiveClientId = String(config?.client_id || '').trim();

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

  if (!checkoutUrl) {
    const checkoutApiCandidates = getCheckoutApiCandidates(String(config?.environment || 'sandbox'), checkoutBaseUrl);
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

        if (isLegacyCheckoutUrl(checkoutUrl)) {
          throw new Error('DOKU checkout mengembalikan URL lama yang tidak valid. Periksa endpoint payment-url dan konfigurasi checkout DOKU.');
        }

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
      config_source: configSource,
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
