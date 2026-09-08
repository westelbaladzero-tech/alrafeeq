"use client";
import { X, Globe, CreditCard, Mail, Shield } from "lucide-react";

export default function PayPalGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Globe size={22} className="text-blue-600" />
            دليل إنشاء حساب PayPal
          </h2>
          <button onClick={onClose} className="text-gray-400"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              PayPal يتيح لك استقبال وإرسال أموال دولياً — مجاني لإنشاء الحساب
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">1</div>
              <div>
                <p className="font-bold text-sm">افتح موقع PayPal</p>
                <p className="text-xs text-gray-500">اذهب إلى paypal.com واضغط "Sign Up"</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">2</div>
              <div>
                <p className="font-bold text-sm">اختر حساب شخصي</p>
                <p className="text-xs text-gray-500">"Personal Account" — مجاني بالكامل</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">3</div>
              <div>
                <p className="font-bold text-sm">أدخل بريدك ورقم هاتفك</p>
                <p className="text-xs text-gray-500">سيتم التحقق من البريد والهاتف</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">4</div>
              <div>
                <p className="font-bold text-sm">أنشئ paypal.me/username</p>
                <p className="text-xs text-gray-500">هذا رابطك الدائم لاستقبال المال</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">5</div>
              <div>
                <p className="font-bold text-sm">اربط بطاقة (لاحقاً)</p>
                <p className="text-xs text-gray-500">يمكنك البدء بدون بطاقة — أضفها لاحقاً للسحب</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700 flex items-center gap-1"><Shield size={14} /> ملاحظات</p>
            <ul className="text-[11px] text-amber-600 space-y-1">
              <li>• الحساب مجاني — لا رسوم على إنشائه</li>
              <li>• الرسوم فقط على استقبال المال الدولي (حوالي 4.4%)</li>
              <li>• PayPal ← PayPal داخل نفس البلد = مجاني</li>
              <li>• لا تشارك كلمة المرور مع أحد</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CreditCard size={14} /> بعد إنشاء الحساب، سجّل اسم مستخدم PayPal هنا ليتمكن أصدقاؤك من التحويل إليك بـ QR
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
