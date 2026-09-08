"use client";
import { X, Bitcoin, Globe, CreditCard, Shield, Zap } from "lucide-react";

export default function BybitGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bitcoin size={22} className="text-amber-500" />
            دليل إنشاء حساب Bybit
          </h2>
          <button onClick={onClose} className="text-gray-400"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              Bybit محفظة عالمية للعملات الرقمية — مجانية، تتيح لك الدفع في جوجل وإعلاناتك وكل مكان
            </p>
          </div>

          {/* المميزات */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 rounded-xl p-2.5 text-center">
              <Zap size={18} className="mx-auto text-green-600 mb-1" />
              <p className="text-[10px] font-bold text-green-700">فوري</p>
              <p className="text-[9px] text-green-600">تحويل لحظي</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2.5 text-center">
              <Globe size={18} className="mx-auto text-blue-600 mb-1" />
              <p className="text-[10px] font-bold text-blue-700">دولي</p>
              <p className="text-[9px] text-blue-600">بلا حدود</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-2.5 text-center">
              <CreditCard size={18} className="mx-auto text-violet-600 mb-1" />
              <p className="text-[10px] font-bold text-violet-700">ادفع</p>
              <p className="text-[9px] text-violet-600">جوجل وإعلانات</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-2.5 text-center">
              <Shield size={18} className="mx-auto text-amber-600 mb-1" />
              <p className="text-[10px] font-bold text-amber-700">آمن</p>
              <p className="text-[9px] text-amber-600">محمي بالكامل</p>
            </div>
          </div>

          {/* الخطوات */}
          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold text-gray-700">خطوات إنشاء الحساب:</p>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">1</div>
              <div>
                <p className="font-bold text-sm">حمّل تطبيق Bybit</p>
                <p className="text-xs text-gray-500">من App Store أو Google Play — أو bybit.com</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">2</div>
              <div>
                <p className="font-bold text-sm">اضغط "Sign Up"</p>
                <p className="text-xs text-gray-500">بريد إلكتروني أو رقم هاتف — مجاني بالكامل</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">3</div>
              <div>
                <p className="font-bold text-sm">تحقّق من بريدك ورقمك</p>
                <p className="text-xs text-gray-500">أدخل رمز التأكيد المرسل</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">4</div>
              <div>
                <p className="font-bold text-sm">احصل على Bybit UID</p>
                <p className="text-xs text-gray-500">Profile ← تجد UID (أرقام) — هذا هو معرفك للتحويل</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">5</div>
              <div>
                <p className="font-bold text-sm">فعّل P2P (اختياري)</p>
                <p className="text-xs text-gray-500">للتحويل بين العملات الرقمية والجنيه مباشرة</p>
              </div>
            </div>
          </div>

          {/* الاستخدامات */}
          <div className="bg-violet-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-violet-700">أين تستخدم Bybit؟</p>
            <ul className="text-[11px] text-violet-600 space-y-1">
              <li>• إعلانات Google Ads — اشترك وادفع بالعملات الرقمية</li>
              <li>• اشتراكات المواقع والخدمات الدولية</li>
              <li>• تحويل أموال لأي بلد في العالم</li>
              <li>• سحب من Bybit إلى فودافون أو بنك عبر P2P</li>
              <li>• دفع لمنصات مثل Netflix, Spotify, ألعاب...</li>
            </ul>
          </div>

          {/* ملاحظات */}
          <div className="bg-amber-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700 flex items-center gap-1"><Shield size={14} /> ملاحظات</p>
            <ul className="text-[11px] text-amber-600 space-y-1">
              <li>• الحساب مجاني تماماً — لا رسوم على إنشائه</li>
              <li>• التحويل بين مستخدمي Bybit = مجاني وفوري</li>
              <li>• P2P لتحويل العملات الرقمية لجنيه وبالعكس</li>
              <li>• فعّل التحقق الثنائي (2FA) لحماية حسابك</li>
              <li>• لا تشارك كلمة المرور أو رمز 2FA مع أحد</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-700">
              💡 بعد إنشاء الحساب، سجّل Bybit UID هنا ليتمكن أصدقاؤك من التحويل إليك بـ QR فوراً
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
