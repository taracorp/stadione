// supabase/functions/doku-webhook-handler/index.ts
// DOKU Payment Gateway Webhook Handler
// Receives payment status updates from DOKU and processes them idempotently

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOKU_SECRET_KEY = Deno.env.get("DOKU_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface DokuWebhookPayload {
  order_id: string;
  payment_id?: string;
  event_type: string;
  status: string;
  amount: number;
  currency: string;
  timestamp: string;
  signature: string;
  webhook_id?: string;
  [key: string]: any;
}

// Verify DOKU webhook signature (HMAC-SHA256)
async function verifyDokuSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    // DOKU sends signature as lowercase hex string
    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16))
    );
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookPayload: DokuWebhookPayload = await req.json();

    // Verify webhook signature
    const payloadString = JSON.stringify(webhookPayload);
    if (!await verifyDokuSignature(payloadString, webhookPayload.signature, DOKU_SECRET_KEY)) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const dokuOrderId = webhookPayload.order_id;
    const webhookId = webhookPayload.webhook_id || `${dokuOrderId}_${Date.now()}`;

    console.log(`Processing DOKU webhook for order: ${dokuOrderId}`);

    // Check for duplicate webhook (idempotency)
    const { data: existingEvent, error: checkError } = await supabase
      .from("payment_webhook_events")
      .select("id, is_processed")
      .eq("webhook_id_from_doku", webhookId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existingEvent) {
      console.log(`Duplicate webhook detected for ${webhookId}, already processed`);
      return new Response(
        JSON.stringify({
          success: true,
          isDuplicate: true,
          message: "Webhook already processed",
        }),
        { status: 200 }
      );
    }

    // Find the DOKU transaction
    const { data: transaction, error: txnError } = await supabase
      .from("doku_payment_transactions")
      .select("id, booking_id, venue_id, amount")
      .eq("doku_order_id", dokuOrderId)
      .single();

    if (txnError && txnError.code !== "PGRST116") {
      throw txnError;
    }

    if (!transaction) {
      console.error(`Transaction not found for order: ${dokuOrderId}`);
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404 }
      );
    }

    // Log webhook event
    const { data: webhookEvent, error: logError } = await supabase
      .from("payment_webhook_events")
      .insert({
        webhook_source: "doku",
        doku_order_id: dokuOrderId,
        doku_payment_id: webhookPayload.payment_id,
        event_type: webhookPayload.event_type || webhookPayload.status,
        webhook_signature: webhookPayload.signature,
        webhook_payload: webhookPayload,
        webhook_id_from_doku: webhookId,
        related_transaction_id: transaction.id,
        is_processed: false,
      })
      .select()
      .single();

    if (logError) throw logError;

    // Map DOKU status to our status
    const statusMap: { [key: string]: string } = {
      "payment.completed": "completed",
      "COMPLETED": "completed",
      "payment.failed": "failed",
      "FAILED": "failed",
      "payment.pending": "pending",
      "PENDING": "pending",
      "payment.cancelled": "cancelled",
      "CANCELLED": "cancelled",
      "payment.expired": "expired",
      "EXPIRED": "expired",
    };

    const newStatus = statusMap[webhookPayload.event_type] || statusMap[webhookPayload.status] || "pending";

    // Call RPC function to update transaction status
    const { error: updateError } = await supabase
      .rpc("process_doku_payment_status_update", {
        p_doku_order_id: dokuOrderId,
        p_new_status: newStatus,
        p_doku_payment_id: webhookPayload.payment_id,
        p_response: webhookPayload,
      });

    if (updateError) {
      console.error("Error updating transaction status:", updateError);
      // Still mark webhook as processed to avoid retries
      await supabase
        .from("payment_webhook_events")
        .update({
          is_processed: true,
          processing_result: "error",
          processing_error: updateError.message,
        })
        .eq("id", webhookEvent.id);

      throw updateError;
    }

    // Mark webhook as successfully processed
    await supabase
      .from("payment_webhook_events")
      .update({
        is_processed: true,
        processing_result: "success",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEvent.id);

    console.log(`Successfully processed webhook for order ${dokuOrderId}, status: ${newStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
        orderId: dokuOrderId,
        status: newStatus,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
