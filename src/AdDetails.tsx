
import { useEffect, useState } from "react";
import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { Device } from "@capacitor/device";
import { Capacitor } from "@capacitor/core";
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
  ShoppingCart,
  CalendarDays,
  ShieldCheck,
  Tag,
} from "lucide-react";

export default function AdDetails() {
  const location = useLocation();
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
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    async function loadAd() {
      if (!id) {
        setLoading(false);
        return;
      }

      const adQuery = supabase
        .from("ads")
        .select(`
          id,
          public_code,
          user_id,
          title,
          description,
          price,
          currency,
          condition,
          listing_type,
          created_at,
          category_id,
          city_id,
          categories(name_ar),
          cities(name_ar),
          ad_images(image_path, sort_order)
        `)
        .eq("status", "approved");

      const { data, error } = /^\d+$/.test(id)
        ? await adQuery.eq("public_code", Number(id)).maybeSingle()
        : await adQuery.eq("id", id).maybeSingle();

      if (error) {
        console.error("خطأ تحميل الإعلان:", error);
      }

      if (data) {
        setAd(data);


        const shareToken = new URLSearchParams(
          window.location.search
        ).get("share");

        if (shareToken) {
          try {
            let visitorId: string;

            if (Capacitor.isNativePlatform()) {
              const deviceInfo = await Device.getId();
              visitorId = `android:${deviceInfo.identifier}`;
            } else {
              visitorId =
                localStorage.getItem("sooqsy_visitor_id") || "";

              if (!visitorId) {
                visitorId = crypto.randomUUID();
                localStorage.setItem("sooqsy_visitor_id", visitorId);
              }
            }

            if (!visitorId) {
              visitorId = crypto.randomUUID();
              localStorage.setItem("sooqsy_visitor_id", visitorId);
            }

            const {
              data: visitRecorded,
              error: visitError,
            } = await supabase.rpc("record_ad_share_visit", {
              p_token: shareToken,
              p_visitor_id: visitorId,
            });



            if (visitError) {
              console.error("خطأ تسجيل زيارة المشاركة:", visitError);
            } else if (visitRecorded) {
              console.log("تم تسجيل زيارة المشاركة ومنح النقطة.");
            }
          } catch (error) {
            console.error("تعذر تسجيل زيارة المشاركة:", error);
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: favoriteData, error: favoriteError } =
            await supabase
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

        const { data: sellerData, error: sellerError } =
          await supabase
            .from("profiles")
            .select("display_name, avatar_url, created_at")
            .eq("id", data.user_id)
            .maybeSingle();

        if (sellerError) {
          console.error("خطأ تحميل بيانات البائع:", sellerError);
        } else {
          setSeller(sellerData);
        }

        const { data: verificationResult, error: verificationError } =
  await supabase.rpc("get_public_verification_status", {
    p_user_id: data.user_id,
  });

if (verificationError) {
  console.error("خطأ التحقق من حالة توثيق البائع:", verificationError);
  setIsVerified(false);
} else {
  console.log("نتيجة توثيق البائع:", verificationResult);
  setIsVerified(Boolean(verificationResult));
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
  }, [id, location.search]);

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

  async function getShareUrl() {
    const { data: token, error } = await supabase.rpc(
      "get_or_create_ad_share_link",
      {
        p_ad_id: ad.id,
      }
    );

    if (error) throw error;
    if (!token) throw new Error("تعذر إنشاء رابط المشاركة.");

    return `https://sooq-sy.pages.dev/ad/${ad.public_code}?share=${token}`;
  }

  async function copyAdLink() {
    try {
      const link = await getShareUrl();
      await navigator.clipboard.writeText(link);
      alert("تم نسخ رابط المشاركة بنجاح.");
    } catch (error) {
      console.error("خطأ نسخ رابط المشاركة:", error);
      alert("تعذر إنشاء أو نسخ رابط المشاركة. تأكد من تسجيل الدخول.");
    }
  }

  async function shareAdOnWhatsApp() {
    try {
      const link = await getShareUrl();

      const message = `شاهد هذا الإعلان على Sooq.sy:\n${ad.title}\n${link}`;

      window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error("خطأ مشاركة الإعلان:", error);
      alert("تعذرت المشاركة. تأكد من تسجيل الدخول.");
    }
  }

  async function requestPurchase() {
    if (purchaseLoading) return;

    setPurchaseLoading(true);
    setPurchaseMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        alert("يرجى تسجيل الدخول أولاً لطلب شراء الإعلان.");
        navigate("/auth");
        return;
      }

      if (user.id === ad.user_id) {
        alert("لا يمكنك طلب شراء إعلانك الشخصي.");
        return;
      }

      if (ad.listing_type !== "sale") {
        alert("طلب الشراء متاح لإعلانات البيع فقط.");
        return;
      }

      const { data: requestId, error: requestError } =
        await supabase.rpc("create_sale_request", {
          p_ad_id: ad.id,
          p_buyer_note: null,
        });

      if (requestError) throw requestError;

      if (!requestId) {
        throw new Error("لم يتم إنشاء طلب الشراء.");
      }

      const { data: requestData, error: fetchError } =
        await supabase
          .from("sale_requests")
          .select("conversation_id")
          .eq("id", requestId)
          .single();

      if (fetchError) throw fetchError;

      alert(
        "تم إرسال طلب الشراء بنجاح. يمكنك متابعة الاتفاق مع البائع عبر المحادثة."
      );

      if (requestData?.conversation_id) {
        navigate(`/messages/${requestData.conversation_id}`);
      }
    } catch (error: any) {
      console.error("خطأ إنشاء طلب الشراء:", error);

      const message = error?.message || "";

      if (message.includes("sale_requests_one_active_per_ad")) {
        setPurchaseMessage(
          "يوجد طلب شراء نشط لهذا الإعلان حالياً."
        );
      } else {
        setPurchaseMessage(
          message || "تعذر إرسال طلب الشراء. حاول مرة أخرى."
        );
      }
    } finally {
      setPurchaseLoading(false);
    }
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
    return (
      <main dir="rtl" className="min-h-screen bg-[#f8faf9] p-4">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-6 h-11 rounded-xl bg-white" />
          <div className="grid gap-5 md:grid-cols-2">
            <div className="h-80 rounded-2xl bg-slate-200 md:h-[460px]" />
            <div className="space-y-4 rounded-2xl bg-white p-5">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-7 w-3/4 rounded bg-slate-200" />
              <div className="h-9 w-1/2 rounded bg-slate-200" />
              <div className="h-10 rounded-lg bg-slate-200" />
              <div className="h-10 rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!ad) {
    return (
      <div
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#f8faf9] p-6"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <ShoppingCart size={26} />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-800">
            الإعلان غير موجود
          </h2>
          <p className="mb-5 text-sm leading-7 text-slate-500">
            قد يكون الإعلان محذوفاً أو لم يعد متاحاً.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            <ArrowRight size={17} />
            العودة إلى السوق
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f8faf9] pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => {
              const from = location.state?.from;

              if (typeof from === "string" && from.startsWith("/")) {
                navigate(from);
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700"
          >
            <ArrowRight size={17} />
            العودة للإعلانات
          </button>

          <Link
            to="/"
            className="mr-auto text-lg font-extrabold tracking-tight text-emerald-700"
          >
            Sooq<span className="text-slate-800">.sy</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-7">
        <div className="grid items-start gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          {/* Gallery */}
          <section className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_2px_12px_rgba(15,23,42,0.035)]">
              <div className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-xl bg-[#f8faf9] sm:h-[400px] lg:h-[470px]">
                {images.length > 0 ? (
                  <img
                    src={images[activeImage]}
                    alt={ad.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <ShoppingCart size={32} strokeWidth={1.4} />
                    <span className="text-sm">
                      لا توجد صور لهذا الإعلان
                    </span>
                  </div>
                )}

                {images.length > 0 && (
                  <span className="absolute bottom-3 right-3 rounded-md bg-slate-900/60 px-2.5 py-1 text-[11px] font-medium text-white">
                    {activeImage + 1} / {images.length}
                  </span>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImage(
                          (activeImage - 1 + images.length) % images.length
                        )
                      }
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-600 shadow-sm transition hover:text-emerald-700"
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight size={19} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveImage((activeImage + 1) % images.length)
                      }
                      className="absolute left-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-100 bg-white/95 text-slate-600 shadow-sm transition hover:text-emerald-700"
                      aria-label="الصورة التالية"
                    >
                      <ChevronLeft size={19} />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-2.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5">
                  {images.map((src, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition sm:h-[72px] sm:w-[72px] ${
                        activeImage === index
                          ? "border-emerald-600 ring-1 ring-emerald-100"
                          : "border-slate-100 opacity-80 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={src}
                        alt={`صورة ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Seller */}
            <Link
              to={`/user/${ad.user_id}`}
              className="mt-3.5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.025)] transition hover:border-emerald-100"
            >
              {seller?.avatar_url ? (
                <img
                  src={seller.avatar_url}
                  alt="صورة البائع"
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-emerald-700">
                  {(seller?.display_name || "م").charAt(0)}
                </div>
              )}

              <div className="min-w-0 flex-1">
<div className="flex flex-wrap items-center gap-1.5">
  <p className="text-sm font-bold text-slate-800">
    {seller?.display_name || "مستخدم Sooq.sy"}
  </p>

  {isVerified && (
    <span
      title="حساب موثّق"
      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700"
    >
      <ShieldCheck size={14} />
      حساب موثّق
    </span>
  )}
</div>
                <p className="mt-1 text-xs text-slate-400">
                  عضو منذ{" "}
                  {seller?.created_at
                    ? new Date(seller.created_at).toLocaleDateString("ar-SY")
                    : "غير محدد"}
                </p>
              </div>

              <span className="text-xs font-semibold text-emerald-700">
                الملف الشخصي
              </span>
              <ArrowRight size={16} className="text-slate-400" />
            </Link>
          </section>

          {/* Ad information */}
          <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.035)] sm:p-5">
            {/* Category and location */}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {ad.categories?.name_ar && (
                <span className="rounded-md bg-slate-50 px-2.5 py-1.5 font-medium">
                  {ad.categories.name_ar}
                </span>
              )}

              {ad.cities?.name_ar && (
                <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1.5 font-medium">
                  <MapPin size={13} className="text-emerald-600" />
                  {ad.cities.name_ar}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold leading-relaxed text-slate-800 sm:text-2xl">
              {ad.title}
            </h1>

            {/* Price */}
            <div className="mt-4 border-b border-slate-100 pb-5">
              <p className="mb-1.5 text-xs font-medium text-slate-400">
                السعر
              </p>
              <div className="text-2xl font-extrabold tracking-tight text-emerald-700">
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
            </div>

            {/* Product details */}
            <div className="my-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <Tag size={14} className="text-slate-400" />
                {ad.condition === "used"
                  ? "مستعمل"
                  : ad.condition === "new"
                    ? "جديد"
                    : ad.condition}
              </span>

              {ad.listing_type && (
                <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  {ad.listing_type === "sale" ? "للبيع" : ad.listing_type}
                </span>
              )}
            </div>

            {/* Main actions */}
            <div className="space-y-2.5">
              {ad.listing_type === "sale" && (
                <>
                  <button
                    type="button"
                    onClick={requestPurchase}
                    disabled={purchaseLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ShoppingCart size={17} />
                    {purchaseLoading ? "جارٍ إرسال الطلب..." : "طلب شراء"}
                  </button>

                  {purchaseMessage && (
                    <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold leading-6 text-red-700">
                      {purchaseMessage}
                    </p>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={startConversation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                مراسلة البائع
              </button>

              <button
                type="button"
                onClick={toggleFavorite}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  isFavorite
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
                }`}
              >
                <Heart
                  size={17}
                  fill={isFavorite ? "currentColor" : "none"}
                />
                {isFavorite ? "إزالة من المفضلة" : "أضف إلى المفضلة"}
              </button>
            </div>

            {/* Share */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={shareAdOnWhatsApp}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-green-100 bg-green-50 px-3 py-2.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
              >
                <Share2 size={15} />
                مشاركة واتساب
              </button>

              <button
                type="button"
                onClick={copyAdLink}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Copy size={15} />
                نسخ الرابط
              </button>
            </div>

            {/* Description */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h2 className="mb-3 text-base font-bold text-slate-800">
                وصف الإعلان
              </h2>

              <p className="whitespace-pre-wrap text-sm leading-8 text-slate-600">
                {ad.description || "لا يوجد وصف لهذا الإعلان."}
              </p>
            </div>

            {/* Report */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowReportForm(!showReportForm);
                  setReportMessage("");
                }}
                className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-100"
              >
                <Flag size={15} />
                الإبلاغ عن الإعلان
              </button>

              {showReportForm && (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50/50 p-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">
                      الإبلاغ عن هذا الإعلان
                    </h3>

                    <button
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-500 hover:text-red-600"
                      aria-label="إغلاق"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    سبب البلاغ
                  </label>

                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="mb-3 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400"
                  >
                    <option value="">اختر سبب البلاغ</option>
                    <option value="إعلان وهمي أو احتيالي">
                      إعلان وهمي أو احتيالي
                    </option>
                    <option value="محتوى غير مناسب">محتوى غير مناسب</option>
                    <option value="معلومات مضللة">معلومات مضللة</option>
                    <option value="منتج ممنوع أو مخالف">
                      منتج ممنوع أو مخالف
                    </option>
                    <option value="تكرار الإعلان">تكرار الإعلان</option>
                    <option value="سبب آخر">سبب آخر</option>
                  </select>

                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    تفاصيل إضافية (اختياري)
                  </label>

                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="اشرح لنا سبب البلاغ..."
                    rows={3}
                    className="mb-3 w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400"
                  />

                  <button
                    type="button"
                    onClick={submitReport}
                    disabled={reportLoading}
                    className="w-full rounded-lg bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {reportLoading ? "جارٍ إرسال البلاغ..." : "إرسال البلاغ"}
                  </button>
                </div>
              )}

              {reportMessage && (
                <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs font-medium leading-6 text-slate-600">
                  {reportMessage}
                </p>
              )}
            </div>

            {/* Publish date */}
            <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
              <CalendarDays size={14} />
              تاريخ النشر:{" "}
              {new Date(ad.created_at).toLocaleDateString("ar-SY")}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
