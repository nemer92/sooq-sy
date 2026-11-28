
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  MapPin,
  Crown,
  BellRing,
  CalendarDays,
  Eye,
  Megaphone,
  CheckCircle2,
  Coins,
  Wallet,
} from "lucide-react";

type Ad = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
};

type Governorate = {
  id: number;
  name_ar: string;
};

const campaignPrices: Record<number, number> = {
  1: 30,
  2: 50,
  3: 70,
  4: 80,
  5: 90,
  6: 100,
  7: 110,
  8: 120,
  9: 130,
  10: 140,
  14: 150,
};

export default function FeaturedCampaign() {
  const { adId } = useParams<{ adId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [ad, setAd] = useState<Ad | null>(null);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorates, setSelectedGovernorates] = useState<number[]>([]);

  const [pointsBalance, setPointsBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState("");

  async function submitCampaignRequest() {
    if (!ad) return;

    if (
      selectedCount < 1 ||
      (selectedCount > 10 && selectedCount !== 14)
    ) {
      alert("اختر من محافظة واحدة إلى 10 محافظات، أو جميع المحافظات الـ14.");
      return;
    }

    if (pointsBalance < campaignPoints) {
      alert(
        `رصيدك غير كافٍ. تحتاج إلى ${campaignPoints} نقطة، ورصيدك الحالي ${pointsBalance} نقطة.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc(
        "create_featured_campaign_points_request",
        {
          p_ad_id: ad.id,
          p_governorate_ids: selectedGovernorates,
        }
      );

      if (error) throw error;

      if (!data) {
        throw new Error("لم يتم استلام رقم طلب الحملة.");
      }

      setRequestId(data);

      // Refresh the balance after successful deduction
      const { data: walletData, error: walletError } = await supabase
        .from("user_points")
        .select("balance")
        .single();

      if (!walletError && walletData) {
        setPointsBalance(Number(walletData.balance));
      } else {
        setPointsBalance((previous) => previous - campaignPoints);
      }

      alert("تم إرسال طلب الحملة بنجاح، والنقاط خُصمت من رصيدك. بانتظار موافقة الإدارة.");
    } catch (err) {
      console.error("خطأ إنشاء طلب الحملة:", err);

      alert(
        err instanceof Error
          ? err.message
          : "تعذر إنشاء طلب الحملة. حاول مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    async function loadCampaignData() {
      setLoading(true);
      setError("");

      try {
        if (!adId) {
          throw new Error("معرّف الإعلان غير صالح.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth", {
            state: { from: `/featured-campaign/${adId}` },
          });
          return;
        }

        const { data: adData, error: adError } = await supabase
          .from("ads")
          .select("id, title, status, published_at")
          .eq("id", adId)
          .eq("user_id", user.id)
          .single();

        if (adError) throw adError;

        if (
          adData.status !== "approved" ||
          !adData.published_at
        ) {
          throw new Error("يمكن تمييز الإعلانات المقبولة والمنشورة فقط.");
        }

        const [
          { data: governoratesData, error: governoratesError },
          { data: walletData, error: walletError },
        ] = await Promise.all([
          supabase
            .from("governorates")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("id"),

          supabase
            .from("user_points")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (governoratesError) throw governoratesError;
        if (walletError) throw walletError;

        setAd(adData);
        setGovernorates(governoratesData ?? []);
        setPointsBalance(Number(walletData?.balance ?? 0));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "تعذر تحميل بيانات الحملة."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCampaignData();
  }, [adId, navigate]);

  function toggleGovernorate(id: number) {
    setSelectedGovernorates((previous) => {
      if (previous.includes(id)) {
        return previous.filter((item) => item !== id);
      }

      if (previous.length >= 10) {
        alert("يمكنك اختيار 10 محافظات كحد أقصى، أو تحديد المحافظات الـ14 جميعها.");
        return previous;
      }

      return [...previous, id];
    });
  }

  const selectedCount = selectedGovernorates.length;
  const campaignPoints = campaignPrices[selectedCount] ?? 0;
  const hasEnoughPoints = pointsBalance >= campaignPoints;

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-8">
        <p className="text-center text-slate-500">
          جارٍ تحميل بيانات الحملة...
        </p>
      </main>
    );
  }

  if (error || !ad) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 p-5">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center">
          <p className="text-red-600">
            {error || "تعذر العثور على الإعلان."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/my-ads")}
            className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
          >
            العودة إلى إعلاناتي
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f8f7]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/my-ads")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <ArrowRight size={22} />
          </button>

          <h1 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
            تمييز الإعلان
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-5 sm:py-8">

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Megaphone size={21} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">الإعلان الذي تريد تمييزه</p>
                <h2 className="mt-1 truncate text-sm font-bold text-slate-800 sm:text-base">
                  {ad.title}
                </h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
              منشور
            </span>
          </div>
        </section>
        {/* Campaign explanation */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-gradient-to-l from-amber-50 via-orange-50/60 to-white p-5 text-slate-800 sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-600 shadow-sm sm:h-14 sm:w-14">
                <Crown size={28} />
              </div>

              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-800 sm:text-xl">
                  خلّي إعلانك مميز!
                </h2>
                <p className="mt-1 text-xs leading-6 text-slate-500 sm:text-xs">
                  أبرز إعلانك وامنحه فرصة أكبر للوصول إلى المهتمين
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-6">
            <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <CalendarDays size={20} />
                مدة التمييز
              </div>

              <span className="rounded-lg bg-amber-100 px-3 py-1.5 font-black text-amber-800">
                10 أيام كاملة
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-100 hover:bg-emerald-50/30 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Crown size={21} />
                </div>

                <div>
                  <h3 className="font-bold text-slate-800">
                    الظهور ضمن الإعلانات المميزة
                  </h3>
                  <p className="mt-1 text-xs leading-7 text-slate-600">
                    ينتقل إعلانك إلى قسم الإعلانات المميزة ليظهر بشكل بارز أمام زوار الموقع.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-100 hover:bg-emerald-50/30 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <BellRing size={21} />
                </div>

                <div>
                  <h3 className="font-bold text-slate-800">
                    إشعار يومي عن إعلانك
                  </h3>
                  <p className="mt-1 text-xs leading-7 text-slate-600">
                    يتم إرسال إشعار يومي داخل التطبيق للتعريف بإعلانك المميز، لمدة 10 أيام متتالية.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-100 hover:bg-emerald-50/30 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Megaphone size={21} />
                </div>

                <div>
                  <h3 className="font-bold text-slate-800">
                    استهداف المحافظات التي تختارها
                  </h3>
                  <p className="mt-1 text-xs leading-7 text-slate-600">
                    يمكنك تحديد المحافظات التي تريد توجيه حملة التمييز إليها، حسب حاجتك وميزانيتك.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-emerald-100 hover:bg-emerald-50/30 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Eye size={21} />
                </div>

                <div>
                  <h3 className="font-bold text-slate-800">
                    فرصة أكبر للمشاهدة والتواصل
                  </h3>
                  <p className="mt-1 text-xs leading-7 text-slate-600">
                    يساعد إبراز الإعلان والإشعارات اليومية على لفت انتباه المهتمين وزيادة فرص مشاهدة إعلانك والتواصل معك.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs leading-7 text-emerald-800">
                  يتم خصم النقاط عند إرسال الطلب، وتبدأ الحملة بعد موافقة الإدارة لمدة 10 أيام.
                  في حال رفض الطلب، تُعاد النقاط إلى رصيدك.
                </p>
              </div>
            </div>

            <p className="text-center text-xs leading-6 text-slate-400">
              التمييز يزيد فرص ظهور إعلانك، لكنه لا يضمن إتمام عملية البيع.
            </p>
          </div>
        </section>

        {/* Points balance */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-800">
                <Wallet size={20} className="text-emerald-600" />
                رصيد نقاطك
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                النقاط المتاحة في محفظتك
              </p>
            </div>

            <div className="text-left">
              <p className="text-2xl font-black text-emerald-700" dir="ltr">
                {pointsBalance.toLocaleString("en-US")}
              </p>
              <span className="text-xs text-slate-500">نقطة</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="mt-4 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Coins size={17} />
              شحن النقاط
            </span>
          </button>
        </section>

        {/* Governorates */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <MapPin size={19} />
            اختر المحافظات المستهدفة
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            يمكنك اختيار محافظة واحدة إلى 10 محافظات، أو جميع المحافظات الـ14.
          </p>

          <button
            type="button"
            onClick={() => {
              if (selectedGovernorates.length === 14) {
                setSelectedGovernorates([]);
              } else {
                setSelectedGovernorates(governorates.map((item) => item.id));
              }
            }}
            className={`mb-3 flex min-h-11 w-full items-center justify-center rounded-xl border p-3 text-xs font-semibold transition-colors sm:text-sm ${
              selectedGovernorates.length === 14
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {selectedGovernorates.length === 14
              ? "إلغاء تحديد جميع المحافظات"
              : "تحديد جميع المحافظات الـ14 — 150 نقطة"}
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {governorates.map((governorate) => {
              const checked = selectedGovernorates.includes(governorate.id);

              return (
                <label
                  key={governorate.id}
                  className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all duration-200 sm:text-sm ${
                    checked
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleGovernorate(governorate.id)}
                    className="h-4 w-4 accent-emerald-600"
                  />

                  {governorate.name_ar}
                </label>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-slate-500">
            المحافظات المختارة: {selectedCount}
          </p>
        </section>

        {/* Campaign cost */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-bold text-slate-800">
            ملخص تكلفة الحملة
          </h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">عدد المحافظات</span>
              <strong>{selectedCount}</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">مدة الحملة</span>
              <strong>10 أيام</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">تكلفة الحملة</span>
              <strong className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                {campaignPoints
                  ? `${campaignPoints.toLocaleString("en-US")} نقطة`
                  : "—"}
              </strong>
            </div>

            <div className="flex justify-between border-t pt-3">
              <span className="text-slate-500">رصيدك بعد الخصم</span>
              <strong className={hasEnoughPoints ? "text-emerald-700" : "text-red-600"}>
                {campaignPoints
                  ? `${Math.max(0, pointsBalance - campaignPoints).toLocaleString("en-US")} نقطة`
                  : "—"}
              </strong>
            </div>
          </div>

          {campaignPoints > 0 && !hasEnoughPoints && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
              رصيدك غير كافٍ. تحتاج إلى{" "}
              <strong>{campaignPoints.toLocaleString("en-US")} نقطة</strong>،
              والمتوفر لديك{" "}
              <strong>{pointsBalance.toLocaleString("en-US")} نقطة</strong>.
              يرجى شحن رصيدك أولاً.
            </div>
          )}
        </section>

        {/* Request submission */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-bold text-slate-800">
            تأكيد طلب الحملة
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-500">
            سيتم خصم النقاط من رصيدك عند إرسال الطلب. بعد ذلك تراجعه الإدارة،
            وتبدأ الحملة بعد الموافقة لمدة 10 أيام.
          </p>

          {requestId ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600" />

              <p className="mt-2 font-bold text-emerald-800">
                تم إرسال طلب الحملة بنجاح
              </p>

              <p className="mt-2 text-sm text-slate-600">
                رقم الطلب:
              </p>

              <p className="mt-1 break-all text-xs text-slate-500" dir="ltr">
                {requestId}
              </p>

              <p className="mt-3 text-sm text-slate-600">
                تم خصم النقاط، وطلبك بانتظار مراجعة الإدارة.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={submitCampaignRequest}
              disabled={
                submitting ||
                !campaignPoints ||
                selectedCount === 0 ||
                !hasEnoughPoints
              }
              className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-l from-emerald-700 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:from-emerald-800 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {submitting
                ? "جارٍ إرسال الطلب..."
                : `إرسال طلب الحملة — ${campaignPoints ? `${campaignPoints} نقطة` : "اختر المحافظات"}`}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
