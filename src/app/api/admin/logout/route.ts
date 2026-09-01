import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "تم تسجيل الخروج" });
  res.cookies.delete("admin_session");
  return res;
}
