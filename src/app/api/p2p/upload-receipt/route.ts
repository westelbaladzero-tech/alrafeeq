import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-server";
import { rateLimit, getClientId } from "@/lib/rate-limit";
import { getUserIdSync } from "@/lib/client-id";

// POST /api/p2p/upload-receipt — رفع إيصال التحويل
export async function POST(req: NextRequest) {
  const clientId = getClientId(req as unknown as Request);
  const rl = rateLimit("p2p-receipt:" + clientId, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "طلبات كثيرة" }, { status: 429 });
  }

  const userId = getUserIdSync();
  if (!userId) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const { transaction_id, receipt_url } = await req.json();

  if (!transaction_id || !receipt_url) {
    return NextResponse.json({ error: "البيانات ناقصة" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "خطأ إعداد" }, { status: 500 });

  // تحقق أن المستخدم هو المرسل
  const { data: txn } = await admin.from("p2p_transactions")
    .select("id, from_user, status")
    .eq("id", transaction_id)
    .single();

  if (!txn) {
    return NextResponse.json({ error: "معاملة غير موجودة" }, { status: 404 });
  }

  if (txn.from_user !== userId) {
    return NextResponse.json({ error: "فقط المرسل يرفع الإيصال" }, { status: 403 });
  }

  if (!["pending_payment", "receipt_uploaded"].includes(txn.status)) {
    return NextResponse.json({ error: "لا يمكن رفع إيصال في هذه الحالة" }, { status: 400 });
  }

  // استخلص بيانات الإيصال بالـ AI (لو متاح)
  let receiptData = null;
  try {
    const ocrRes = await fetch(`${req.nextUrl.origin}/api/image-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: receipt_url }),
    });
    if (ocrRes.ok) {
      const ocrData = await ocrRes.json();
      if (ocrData.ok && ocrData.text) {
        receiptData = { raw_text: ocrData.text, extracted: parseReceipt(ocrData.text) };
      }
    }
  } catch {
    // تجاهل — OCR اختياري
  }

  // حدّث المعاملة
  const { error } = await admin.from("p2p_transactions")
    .update({
      status: "verifying",
      receipt_url,
      receipt_data: receiptData,
    })
    .eq("id", transaction_id);

  if (error) {
    return NextResponse.json({ error: "تعذّر تحديث المعاملة" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "verifying",
    receipt_data: receiptData,
  });
}

// استخلاص بيانات من نص الإيصال
function parseReceipt(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // ابحث عن المبلغ
  const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|egp|eg|ج)/i);
  if (amountMatch) result.detected_amount = parseFloat(amountMatch[1]);
  // ابحث عن التاريخ
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (dateMatch) result.detected_date = dateMatch[1];
  // ابحث عن رقم المعاملة
  const txnMatch = text.match(/(?:txn|reference|ref|رقم|مرجع)[:\s]*(\w+)/i);
  if (txnMatch) result.detected_txn_ref = txnMatch[1];
  return result;
}
