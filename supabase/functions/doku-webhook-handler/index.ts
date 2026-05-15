import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOKU_SECRET_KEY = Deno.env.get("DOKU_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/[^0-9a-f]/gi, '');
  const length = cleaned.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = parseInt(cleaned.substr(i * 2, 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

async function verifyDokuSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = signature.includes('=')
      ? base64ToBytes(signature)
      : hexToBytes(signature);

    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload));
  } catch (error) {
    console.error('verifyDokuSignature error:', error);
    return false;
  }
}

function normalizeDokuStatus(rawStatus: unknown): string {
  if (typeof rawStatus !== 'string') return 'pending';

  const normalized = rawStatus.toLowerCase();
  if (['completed', 'success', 'settlement', 'paid', 'capture'].includes(normalized)) return 'completed';
  if (['failed', 'cancelled', 'expired', 'denied'].includes(normalized)) return normalized === 'denied' ? 'failed' : normalized;
  if (['pending', 'authorize', 'authorized'].includes(normalized)) return 'pending';
  return normalized;
}

function shouldMarkBookingPaid(status: string): boolean {
  return status === 'completed';
}

function shouldMarkBookingUnpaid(status: string): boolean {
  return ['failed', 'expired', 'cancelled'].includes(status);
}

function appendWebhookHistory(existingResponse: any, payload: Record<string, any>, metadata: Record<string, any>) {
  const current = existingResponse && typeof existingResponse === 'object' ? existingResponse : {};
  const currentHistory = Array.isArray(current.history) ? current.history : [];
  const nextEntry = {
    ...metadata,
    payload,
  };

  const history = [...currentHistory, nextEntry].slice(-30);
  return {
    ...current,
    last_webhook: nextEntry,
    history,
  };
}

function appendNote(existingNote: string | null | undefined, nextNote: string): string {
  if (!existingNote) return nextNote;
  if (existingNote.includes(nextNote)) return existingNote;
  return `${existingNote} | ${nextNote}`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function syncBookingAndInvoiceFromWebhook(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  orderId: string,
  normalizedStatus: string,
  receivedAt: string,
) {
  const { data: booking, error: bookingFetchError } = await supabase
    .from('venue_bookings')
    .select('id, venue_id, status, payment_status, payment_method, notes, total_price')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingFetchError || !booking) {
    console.warn('Booking not found for DOKU webhook sync:', bookingFetchError?.message || bookingId);
    return;
  }

  const noteMarker = `[doku:${normalizedStatus}:${orderId}]`;
  const noteExists = typeof booking.notes === 'string' && booking.notes.includes(noteMarker);
  const nextNotes = noteExists
    ? booking.notes
    : [booking.notes, `${noteMarker} ${new Date(receivedAt).toLocaleString('id-ID')}`].filter(Boolean).join(' | ');

  const bookingUpdates: Record<string, any> = {
    notes: nextNotes,
  };

  if (shouldMarkBookingPaid(normalizedStatus)) {
    bookingUpdates.payment_status = 'paid';
    bookingUpdates.payment_method = 'doku';
    bookingUpdates.status = booking.status === 'pending' ? 'confirmed' : booking.status;
  } else if (shouldMarkBookingUnpaid(normalizedStatus) && booking.payment_status !== 'paid') {
    bookingUpdates.payment_status = 'unpaid';
  }

  const { error: bookingUpdateError } = await supabase
    .from('venue_bookings')
    .update(bookingUpdates)
    .eq('id', booking.id);

  if (bookingUpdateError) {
    console.warn('Failed to sync booking from DOKU webhook:', bookingUpdateError.message);
  }

  let linkedPaymentId: string | null = null;
  const { data: latestPayment, error: paymentFetchError } = await supabase
    .from('venue_payments')
    .select('id, status, method, reference_number, notes')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let paymentRow = latestPayment || null;

  if (paymentFetchError) {
    console.warn('Failed to fetch venue payment for DOKU webhook sync:', paymentFetchError.message);
  }

  if (!paymentRow && shouldMarkBookingPaid(normalizedStatus)) {
    const bookingAmount = Number(booking.total_price || 0);
    if (bookingAmount > 0) {
      let fallbackShift: { id: string; cashier_id: string } | null = null;

      const { data: openShift } = await supabase
        .from('venue_shifts')
        .select('id, cashier_id')
        .eq('venue_id', booking.venue_id)
        .eq('status', 'open')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openShift) {
        fallbackShift = openShift;
      } else {
        const { data: latestShift } = await supabase
          .from('venue_shifts')
          .select('id, cashier_id')
          .eq('venue_id', booking.venue_id)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestShift) {
          fallbackShift = latestShift;
        }
      }

      if (fallbackShift?.id && fallbackShift?.cashier_id) {
        const { data: insertedPayment, error: createPaymentError } = await supabase
          .from('venue_payments')
          .insert({
            booking_id: booking.id,
            shift_id: fallbackShift.id,
            amount: bookingAmount,
            method: 'doku',
            status: 'confirmed',
            reference_number: orderId,
            confirmed_at: receivedAt,
            processed_by: fallbackShift.cashier_id,
            notes: `[DOKU:completed:${orderId}] auto-created by webhook`,
          })
          .select('id, status, method, reference_number, notes')
          .maybeSingle();

        if (createPaymentError) {
          console.warn('Failed to auto-create venue payment from DOKU webhook:', createPaymentError.message);
        } else if (insertedPayment) {
          paymentRow = insertedPayment;
        }
      } else {
        console.warn('No valid shift/cashier found to create venue payment from DOKU webhook for booking:', booking.id);
      }
    } else {
      console.warn('Skipped auto-create venue payment because booking total_price <= 0 for booking:', booking.id);
    }
  }

  if (paymentRow) {
    linkedPaymentId = paymentRow.id;
    const paymentUpdates: Record<string, any> = {
      reference_number: paymentRow.reference_number || orderId,
      notes: appendNote(paymentRow.notes, `[DOKU:${normalizedStatus}:${orderId}]`),
    };

    if (shouldMarkBookingPaid(normalizedStatus)) {
      paymentUpdates.status = 'confirmed';
      paymentUpdates.method = 'doku';
      paymentUpdates.confirmed_at = receivedAt;
    } else if (normalizedStatus === 'refunded' && paymentRow.status !== 'failed') {
      paymentUpdates.status = 'refunded';
    } else if (shouldMarkBookingUnpaid(normalizedStatus) && paymentRow.status === 'pending') {
      paymentUpdates.status = 'failed';
    }

    const { error: paymentUpdateError } = await supabase
      .from('venue_payments')
      .update(paymentUpdates)
      .eq('id', paymentRow.id);

    if (paymentUpdateError) {
      console.warn('Failed to sync venue payment from DOKU webhook:', paymentUpdateError.message);
    }
  }

  if (shouldMarkBookingPaid(normalizedStatus)) {
    if (linkedPaymentId) {
      const { error: invoicePaymentLinkError } = await supabase
        .from('venue_invoices')
        .update({ payment_id: linkedPaymentId })
        .eq('booking_id', booking.id)
        .is('payment_id', null);

      if (invoicePaymentLinkError) {
        console.warn('Failed to link payment_id to invoice from DOKU webhook:', invoicePaymentLinkError.message);
      }
    }

    const { error: invoiceError } = await supabase
      .from('venue_invoices')
      .update({
        status: 'issued',
        issued_at: receivedAt,
        notes: `DOKU webhook confirmed payment (${orderId})`,
      })
      .eq('booking_id', booking.id)
      .eq('status', 'draft');

    if (invoiceError) {
      console.warn('Failed to issue invoice from DOKU webhook:', invoiceError.message);
    }
  }
}

async function handleWebhook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS });
  }

  const rawBody = await req.text();
  let payload: Record<string, any> = {};

  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: JSON_HEADERS });
  }

  const signature = req.headers.get('x-doku-signature') || payload.signature || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Supabase configuration missing for webhook handler');
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), { status: 500, headers: JSON_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const eventOrderId = payload.order_id || payload.doku_order_id || payload.reference || payload.external_id;
  const eventStatus = payload.status || payload.transaction_status || payload.payment_status || payload.result?.status || null;
  const normalizedStatus = normalizeDokuStatus(eventStatus);
  const receivedAt = new Date().toISOString();

  if (!eventOrderId) {
    return new Response(JSON.stringify({ error: 'Missing order id in webhook payload' }), { status: 400, headers: JSON_HEADERS });
  }

  let effectiveSecretKey = String(DOKU_SECRET_KEY || '').trim();

  if (!effectiveSecretKey) {
    const { data: txForSecret, error: txForSecretError } = await supabase
      .from('doku_payment_transactions')
      .select('venue_id')
      .eq('doku_order_id', eventOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txForSecretError) {
      console.warn('Failed to fetch DOKU transaction for signature secret fallback:', txForSecretError.message);
    }

    if (txForSecret?.venue_id !== null && txForSecret?.venue_id !== undefined) {
      const { data: configForSecret, error: configForSecretError } = await supabase
        .from('doku_venue_config')
        .select('secret_key')
        .eq('venue_id', txForSecret.venue_id)
        .maybeSingle();

      if (configForSecretError) {
        console.warn('Failed to fetch DOKU venue secret fallback:', configForSecretError.message);
      }

      effectiveSecretKey = String(configForSecret?.secret_key || '').trim();
    }
  }

  if (!effectiveSecretKey) {
    return new Response(JSON.stringify({ error: 'DOKU secret key is not configured' }), { status: 500, headers: JSON_HEADERS });
  }

  if (!await verifyDokuSignature(rawBody, signature, effectiveSecretKey)) {
    console.error('Invalid DOKU webhook signature');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: JSON_HEADERS });
  }

  const eventHash = await sha256Hex(`${eventOrderId}|${normalizedStatus}|${signature}|${rawBody}`);

  try {
    const { error: eventInsertError } = await supabase.from('payment_webhook_events').insert([{
      event_payload: payload,
      received_at: receivedAt,
      signature,
      event_order_id: eventOrderId,
      event_status: normalizedStatus,
      event_hash: eventHash,
    }]);

    if (eventInsertError) {
      if (eventInsertError.code === '23505') {
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }

      // Fallback when optional idempotency columns are not deployed yet.
      await supabase.from('payment_webhook_events').insert([{
        event_payload: payload,
        received_at: receivedAt,
        signature,
      }]);
    }
  } catch (error) {
    console.error('Failed to log webhook event:', error);
  }

  try {
    const { data: transaction, error: transactionError } = await supabase
      .from('doku_payment_transactions')
      .select('id, booking_id, status, doku_response')
      .eq('doku_order_id', eventOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (transactionError) {
      console.warn('Failed to fetch DOKU transaction for webhook:', transactionError.message);
    } else if (transaction) {
      const updateData: Record<string, any> = {
        status: normalizedStatus,
        updated_at: receivedAt,
        doku_response: appendWebhookHistory(transaction.doku_response, payload, {
          received_at: receivedAt,
          event_hash: eventHash,
          signature,
          order_id: eventOrderId,
          status: normalizedStatus,
        }),
      };

      const { error: updateError } = await supabase
        .from('doku_payment_transactions')
        .update(updateData)
        .eq('id', transaction.id);

      if (updateError) {
        console.warn('Failed to update DOKU transaction status:', updateError.message);
      } else {
        await syncBookingAndInvoiceFromWebhook(
          supabase,
          transaction.booking_id,
          eventOrderId,
          normalizedStatus,
          receivedAt,
        );
      }
    }
  } catch (error) {
    console.error('Failed to update DOKU transaction:', error);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

serve(handleWebhook);
