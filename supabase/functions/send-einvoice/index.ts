import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";

function corsHeaders(origin: string | null = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, x-supabase-api-version, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return new Response(JSON.stringify({
      error: "Email service belum dikonfigurasi. Set RESEND_API_KEY dan RESEND_FROM_EMAIL.",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  let payload: Record<string, any> = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const toEmail = String(payload?.toEmail || "").trim();
  const recipientName = String(payload?.recipientName || "Pelanggan Stadione").trim();
  const invoice = payload?.invoice || {};

  const invoiceNumber = String(invoice?.invoiceNumber || "").trim();
  const issuedAt = String(invoice?.issuedAt || "").trim();
  const title = String(invoice?.title || "Transaksi Stadione").trim();
  const description = String(invoice?.description || "").trim();
  const paymentMethod = String(invoice?.paymentMethod || "-").trim();
  const amount = Number(invoice?.amount || 0);

  if (!toEmail || !invoiceNumber || amount <= 0) {
    return new Response(JSON.stringify({
      error: "Payload invoice tidak lengkap. Pastikan toEmail, invoiceNumber, dan amount valid.",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const issuedAtText = issuedAt
    ? new Date(issuedAt).toLocaleString("id-ID")
    : new Date().toLocaleString("id-ID");
  const amountText = formatCurrency(amount);

  const text = [
    `Halo ${recipientName},`,
    "",
    "Berikut e-invoice transaksi Anda di Stadione:",
    `- Nomor Invoice: ${invoiceNumber}`,
    `- Tanggal: ${issuedAtText}`,
    `- Deskripsi: ${title}`,
    description ? `- Detail: ${description}` : "",
    `- Metode Pembayaran: ${paymentMethod}`,
    `- Total: ${amountText}`,
    "",
    "Invoice ini merupakan bukti transaksi elektronik Anda.",
    "Terima kasih telah menggunakan Stadione.",
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin: 0 0 8px;">E-Invoice Stadione</h2>
      <p style="margin: 0 0 16px; color: #4b5563;">Halo ${recipientName}, berikut e-invoice transaksi Anda.</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb;">
        <p style="margin: 0 0 6px;"><strong>Nomor Invoice:</strong> ${invoiceNumber}</p>
        <p style="margin: 0 0 6px;"><strong>Tanggal:</strong> ${issuedAtText}</p>
        <p style="margin: 0 0 6px;"><strong>Deskripsi:</strong> ${title}</p>
        ${description ? `<p style="margin: 0 0 6px;"><strong>Detail:</strong> ${description}</p>` : ""}
        <p style="margin: 0 0 6px;"><strong>Metode Pembayaran:</strong> ${paymentMethod}</p>
        <p style="margin: 0;"><strong>Total:</strong> ${amountText}</p>
      </div>
      <p style="margin-top: 16px; color: #4b5563;">Invoice ini merupakan bukti transaksi elektronik Anda.</p>
      <p style="margin-top: 4px; color: #4b5563;">Terima kasih telah menggunakan Stadione.</p>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      subject: `E-Invoice ${invoiceNumber} - Stadione`,
      text,
      html,
    }),
  });

  const resendJson = await resendResponse.json().catch(() => ({}));

  if (!resendResponse.ok) {
    return new Response(JSON.stringify({
      error: resendJson?.message || "Gagal mengirim email e-invoice.",
      provider: resendJson,
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    providerMessageId: resendJson?.id || null,
    invoiceNumber,
    toEmail,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
});
