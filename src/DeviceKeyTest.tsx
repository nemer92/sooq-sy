
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import DeviceKey from "./lib/deviceKey";

export default function DeviceKeyTest() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testDeviceKey = async () => {
    setLoading(true);
    setResult("");

    try {
      if (
        !Capacitor.isNativePlatform() ||
        Capacitor.getPlatform() !== "android"
      ) {
        throw new Error("افتح الصفحة من تطبيق Android");
      }

      const status = await DeviceKey.hasAttestedKey();

      if (!status.exists) {
        setResult("لا يوجد مفتاح تصديق محفوظ على الجهاز.");
        return;
      }

      const material = await DeviceKey.getAttestedKeyMaterial();

      setResult(
        [
          "نجح استرجاع المفتاح والشهادات",
          "",
          `طول المفتاح العام: ${material.publicKey.length} حرف`,
          `عدد الشهادات: ${material.certificateChain.length}`,
          `أطوال الشهادات: ${material.certificateChain.map((c) => c.length).join(", ")}`,
          "",
          "لم يتم إنشاء مفتاح جديد أو حذف المفتاح الموجود.",
        ].join("\n")
      );
    } catch (error) {
      setResult("فشل الاختبار:\n" + String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-4 text-xl font-bold">
          فحص مفتاح الجهاز
        </h1>

        <button
          onClick={testDeviceKey}
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 p-4 font-bold text-white disabled:opacity-50"
        >
          {loading ? "جارٍ الفحص..." : "فحص المفتاح والشهادات"}
        </button>

        {result && (
          <pre className="mt-5 whitespace-pre-wrap break-all rounded-xl bg-slate-100 p-4 text-sm">
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}
