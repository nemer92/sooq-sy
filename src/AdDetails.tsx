
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flag,
  X,
  Share2,
  Copy,
  Heart,
} from "lucide-react";
export default function AdDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [ad, setAd] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    async function loadAd() {
      if (!id) {
        setLoading(false);
        return;
      }

const { data, error } = await supabase
  .from("ads")
  .select(`
    id,
    user_id,
    title,
    description,
    price,
    currency,
    condition,
    created_at,
    category_id,
    city_id,
    categories(name_ar),
    cities(name_ar),
    ad_images(image_path, sort_order)
  `)
  .eq("id", id)
  .eq("status", "approved")
  .maybeSingle();

      if (error) {
        console.error("خطأ تحميل الإعلان:", error);
      }

      if (data) {
        setAd(data);
        const { data: { user } } = await supabase.auth.getUser();

if (user) {
  const { data: favoriteData, error: favoriteError } = await supabase
    .from("favorites")
    .select("ad_id")
    .eq("user_id", user.id)
    .eq("ad_id", data.id)
    .maybeSingle();

  if (favoriteError) {
    console.error("خطأ التحقق من المفضلة:", favoriteError);
  } else {
    setIsFavorite(!!favoriteData);
  }
} else {
  setIsFavorite(false);
}
        const { data: sellerData, error: sellerError } = await supabase
  .from("profiles")
  .select("display_name, avatar_url, created_at")
  .eq("id", data.user_id)
  .maybeSingle();

if (sellerError) {
  console.error("خطأ تحميل بيانات البائع:", sellerError);
} else {
  setSeller(sellerData);
}

        const sortedImages = [...(data.ad_images ?? [])].sort(
          (a: any, b: any) => a.sort_order - b.sort_order
        );

        const signedImages = await Promise.all(
          sortedImages.map(async (image: any) => {
            const { data: imageData, error: imageError } =
              await supabase.storage
                .from("ad-images")
                .createSignedUrl(image.image_path, 3600);

            if (imageError) {
              console.error("خطأ تحميل الصورة:", imageError);
              return "";
            }

            return imageData.signedUrl;
          })
        );

        setImages(signedImages.filter(Boolean));
      }

      setLoading(false);
    }

    loadAd();
  }, [id]);

  async function submitReport() {
  if (!reportReason) {
    setReportMessage("يرجى اختيار سبب البلاغ.");
    return;
  }

  setReportLoading(true);
  setReportMessage("");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      setReportMessage("يجب تسجيل الدخول أولاً لإرسال بلاغ.");
      return;
    }

    if (user.id === ad.user_id) {
      setReportMessage("لا يمكنك الإبلاغ عن إعلانك الشخصي.");
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      ad_id: ad.id,
      reported_user_id: ad.user_id,
      reason: reportReason,
      details: reportDetails.trim() || null,
      status: "pending",
    });

    if (error) throw error;

    setReportMessage("تم إرسال البلاغ بنجاح، شكراً لمساهمتك.");
    setReportReason("");
    setReportDetails("");
    setShowReportForm(false);
  } catch (error) {
    console.error("خطأ إرسال البلاغ:", error);
    setReportMessage("تعذر إرسال البلاغ، يرجى المحاولة مرة أخرى.");
  } finally {
    setReportLoading(false);
  }
}

  async function copyAdLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("تم نسخ رابط الإعلان بنجاح.");
    } catch (error) {
      console.error("خطأ نسخ الرابط:", error);
      alert("تعذر نسخ الرابط.");
    }
  }

  function shareAdOnWhatsApp() {
    const message = `شاهد هذا الإعلان على Sooq.sy:\n${ad.title}\n${window.location.href}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }
    async function startConversation() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

if (!user) {
  alert("يرجى تسجيل الدخول أولاً لمراسلة البائع.");
  navigate("/auth");
  return;
}

if (userError) throw userError;

      if (user.id === ad.user_id) {
        alert("لا يمكنك مراسلة نفسك على إعلانك الشخصي.");
        return;
      }

      const { data: existingConversation, error: searchError } =
        await supabase
          .from("conversations")
          .select("id")
          .eq("ad_id", ad.id)
          .eq("buyer_id", user.id)
          .maybeSingle();

      if (searchError) throw searchError;

      let conversationId = existingConversation?.id;

      if (!conversationId) {
        const { data: newConversation, error: insertError } =
          await supabase
            .from("conversations")
            .insert({
              ad_id: ad.id,
              buyer_id: user.id,
              seller_id: ad.user_id,
            })
            .select("id")
            .single();

        if (insertError) throw insertError;

        conversationId = newConversation.id;
      }

      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error("خطأ بدء المحادثة:", error);
      alert("تعذر فتح المحادثة. حاول مرة أخرى.");
    }
  }
  async function toggleFavorite() {
    console.log("تم الضغط على زر المفضلة");
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      alert("يرجى تسجيل الدخول لإضافة الإعلان إلى المفضلة.");
      navigate("/auth");
      return;
    }

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("ad_id", ad.id);

      if (error) throw error;

      setIsFavorite(false);
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({
          user_id: user.id,
          ad_id: ad.id,
        });

      if (error) throw error;

      setIsFavorite(true);
    }
  } catch (error) {
    console.error("خطأ تحديث المفضلة:", error);
    alert("تعذر تحديث المفضلة. حاول مرة أخرى.");
  }
}

  if (loading) {
    return <div className="p-10 text-center">جارٍ تحميل الإعلان...</div>;
  }

  if (!ad) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 p-10 text-center">
        <h2 className="mb-4 text-xl font-bold">الإعلان غير موجود أو غير متاح</h2>
        <Link to="/" className="text-emerald-700 font-bold">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700">
            <ArrowRight size={20} />
            العودة للإعلانات
          </Link>
          <span className="mr-auto text-xl font-black text-emerald-700">
            Sooq.sy
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 py-8 md:grid-cols-2">
        <section>
          <div className="relative flex h-80 items-center justify-center overflow-hidden rounded-2xl bg-white md:h-[460px]">
            {images.length > 0 ? (
              <img
                src={images[activeImage]}
                alt={ad.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-slate-400">لا توجد صور لهذا الإعلان</span>
            )}

            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setActiveImage((activeImage - 1 + images.length) % images.length)
                  }
                  className="absolute right-3 rounded-full bg-white p-2 shadow"
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight />
                </button>
                <button
                  onClick={() => setActiveImage((activeImage + 1) % images.length)}
                  className="absolute left-3 rounded-full bg-white p-2 shadow"
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft />
                </button>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                    activeImage === index
                      ? "border-emerald-600"
                      : "border-transparent"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6">
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{ad.categories?.name_ar}</span>
            <span>•</span>
            <span>{ad.cities?.name_ar}</span>
          </div>

          <h1 className="mb-4 text-2xl font-black text-slate-800">
            {ad.title}
          </h1>

          <div className="mb-6 text-3xl font-black text-emerald-700">
            {ad.price != null
              ? `${Number(ad.price).toLocaleString("en-US")} ${
                  ad.currency === "USD"
                    ? "دولار"
                    : ad.currency === "SYP"
                      ? "ليرة سورية"
                      : ad.currency
                }`
              : "السعر عند التواصل"}
          </div>

          <div className="mb-6 flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-100 px-3 py-2">
              {ad.condition === "used"
                ? "مستعمل"
                : ad.condition === "new"
                  ? "جديد"
                  : ad.condition}
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2">
              <MapPin size={16} />
              {ad.cities?.name_ar}
            </span>
          </div>

          <button
  type="button"
  onClick={startConversation}
  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-bold text-white hover:bg-emerald-700"
>
  راسل البائع
</button>
<button
  type="button"
onClick={toggleFavorite}
  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3.5 font-bold text-rose-600 hover:bg-rose-50"
>
  <Heart
    size={20}
    fill={isFavorite ? "currentColor" : "none"}
  />
  {isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
</button>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={shareAdOnWhatsApp}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-bold text-white hover:bg-green-700"
            >
              <Share2 size={18} />
              مشاركة عبر واتساب
            </button>

            <button
              type="button"
              onClick={copyAdLink}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
            >
              <Copy size={18} />
              نسخ رابط الإعلان
            </button>
          </div>
          <hr className="my-5 border-slate-100" />

          <h2 className="mb-3 text-lg font-bold text-slate-800">
            وصف الإعلان
          </h2>

          <p className="whitespace-pre-wrap leading-8 text-slate-600">
            {ad.description || "لا يوجد وصف لهذا الإعلان."}
          </p>

<div className="mt-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
  <h2 className="mb-4 font-bold text-slate-800">
    معلومات البائع
  </h2>

  <div className="flex items-center gap-3">
    {seller?.avatar_url ? (
      <img
        src={seller.avatar_url}
        alt="صورة البائع"
        className="h-12 w-12 rounded-full object-cover"
      />
    ) : (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
        {(seller?.display_name || "م").charAt(0)}
      </div>
    )}

    <div>
      <p className="font-bold text-slate-800">
        {seller?.display_name || "مستخدم Sooq.sy"}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        عضو منذ{" "}
{seller?.created_at
  ? new Date(seller.created_at).toLocaleDateString("ar-SY")
  : "غير محدد"}
      </p>
    </div>
  </div>
</div>
          <div className="mt-5">
  <button
    onClick={() => {
      setShowReportForm(!showReportForm);
      setReportMessage("");
    }}
    className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700"
  >
    <Flag size={17} />
    الإبلاغ عن الإعلان
  </button>

  {showReportForm && (
    <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">
          الإبلاغ عن هذا الإعلان
        </h3>

        <button
          onClick={() => setShowReportForm(false)}
          className="text-slate-500"
        >
          <X size={20} />
        </button>
      </div>

      <label className="mb-2 block text-sm font-bold text-slate-700">
        سبب البلاغ
      </label>

      <select
        value={reportReason}
        onChange={(e) => setReportReason(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
      >
        <option value="">اختر سبب البلاغ</option>
        <option value="إعلان وهمي أو احتيالي">إعلان وهمي أو احتيالي</option>
        <option value="محتوى غير مناسب">محتوى غير مناسب</option>
        <option value="معلومات مضللة">معلومات مضللة</option>
        <option value="منتج ممنوع أو مخالف">منتج ممنوع أو مخالف</option>
        <option value="تكرار الإعلان">تكرار الإعلان</option>
        <option value="سبب آخر">سبب آخر</option>
      </select>

      <label className="mb-2 block text-sm font-bold text-slate-700">
        تفاصيل إضافية (اختياري)
      </label>

      <textarea
        value={reportDetails}
        onChange={(e) => setReportDetails(e.target.value)}
        placeholder="اشرح لنا سبب البلاغ..."
        rows={3}
        className="mb-4 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
      />

      <button
        onClick={submitReport}
        disabled={reportLoading}
        className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {reportLoading ? "جارٍ إرسال البلاغ..." : "إرسال البلاغ"}
      </button>
    </div>
  )}

  {reportMessage && (
    <p className="mt-3 text-sm font-bold text-slate-700">
      {reportMessage}
    </p>
  )}
</div>
          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            تاريخ النشر: {new Date(ad.created_at).toLocaleDateString("ar-SY")}
          </div>
        </section>
      </div>
    </main>
  );
}
