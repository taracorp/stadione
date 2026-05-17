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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDetails(details: Record<string, unknown> | null | undefined) {
  if (!details || typeof details !== "object") return [] as string[];

  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);
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
  const applicantName = String(payload?.applicantName || "").trim();
  const applicantEmail = String(payload?.applicantEmail || "").trim();
  const applicantPhone = String(payload?.applicantPhone || "").trim();
  const partnershipType = String(payload?.partnershipType || "").trim();
  const partnershipLabel = String(payload?.partnershipLabel || partnershipType || "Partnership").trim();
  const submittedAt = String(payload?.submittedAt || "").trim();
  const details = payload?.details && typeof payload.details === "object" ? payload.details : null;

  if (!toEmail || !applicantName || !applicantEmail || !partnershipType) {
    return new Response(JSON.stringify({
      error: "Payload partnership tidak lengkap. Pastikan toEmail, applicantName, applicantEmail, dan partnershipType valid.",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const submittedAtText = submittedAt
    ? new Date(submittedAt).toLocaleString("id-ID")
    : new Date().toLocaleString("id-ID");

  const detailLines = formatDetails(details as Record<string, unknown> | null);
  const detailText = detailLines.length
    ? detailLines.map((line) => `- ${line}`).join("\n")
    : "- Tidak ada detail tambahan";
  const detailHtml = detailLines.length
    ? detailLines.map((line) => `<li style="margin: 0 0 6px;">${escapeHtml(line)}</li>`).join("")
    : `<li style="margin: 0 0 6px;">Tidak ada detail tambahan</li>`;

  const text = [
    `Ada partnership baru masuk di Stadione.`,
    "",
    `Kategori: ${partnershipLabel}`,
    `Nama: ${applicantName}`,
    `Email: ${applicantEmail}`,
    applicantPhone ? `Telepon: ${applicantPhone}` : "",
    `Waktu submit: ${submittedAtText}`,
    "",
    "Detail tambahan:",
    detailText,
    "",
    "Silakan cek Workspace > Kelola Sponsor untuk review aplikasi.",
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin: 0 0 8px;">Partnership Baru Masuk</h2>
      <p style="margin: 0 0 16px; color: #4b5563;">Ada aplikasi partnership baru di Stadione.</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb;">
        <p style="margin: 0 0 6px;"><strong>Kategori:</strong> ${escapeHtml(partnershipLabel)}</p>
        <p style="margin: 0 0 6px;"><strong>Nama:</strong> ${escapeHtml(applicantName)}</p>
        <p style="margin: 0 0 6px;"><strong>Email:</strong> ${escapeHtml(applicantEmail)}</p>
        ${applicantPhone ? `<p style="margin: 0 0 6px;"><strong>Telepon:</strong> ${escapeHtml(applicantPhone)}</p>` : ""}
        <p style="margin: 0 0 6px;"><strong>Waktu Submit:</strong> ${escapeHtml(submittedAtText)}</p>
        <div style="margin-top: 12px;">
          <p style="margin: 0 0 8px;"><strong>Detail Tambahan</strong></p>
          <ul style="margin: 0; padding-left: 18px;">${detailHtml}</ul>
        </div>
      </div>
      <p style="margin-top: 16px; color: #4b5563;">Silakan cek Workspace &gt; Kelola Sponsor untuk review aplikasi.</p>
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
      subject: `Partnership Baru: ${applicantName}`,
      text,
      html,
    }),
  });

  const resendJson = await resendResponse.json().catch(() => ({}));

  if (!resendResponse.ok) {
    return new Response(JSON.stringify({
      error: resendJson?.message || "Gagal mengirim email partnership.",
      provider: resendJson,
    }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    providerMessageId: resendJson?.id || null,
    toEmail,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
});
