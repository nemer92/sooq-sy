
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { loadAdsCached, subscribeToAdsUpdates, invalidateAdsCache } from "./lib/adCache";
import AdPickupLocationMap from "./AdPickupLocationMap";
import { Device } from "@capacitor/device";
import { Capacitor } from "@capacitor/core";
import { PlayIntegrity } from "@capacitor-community/play-integrity";

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
  ShieldCheck,
  Tag,
  MessageCircle,
  Eye,
  Image as ImageIcon,
  Clock3,
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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [adMetrics, setAdMetrics] = useState({ views_count: 0, contact_clicks_count: 0, favorites_count: 0 });
  const recordedViewIds = useRef(new Set<string>());
  const [pickupLatitude, setPickupLatitude] = useState<number | null>(null);
  const [pickupLongitude, setPickupLongitude] = useState<number | null>(null);
  const [pickupAddressLabel, setPickupAddressLabel] = useState("");
  const [showPickupEditor, setShowPickupEditor] = useState(false);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupMessage, setPickupMessage] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    if (!id) {
      setLoading(false);
      return;
    }

    const cacheKey = `ad:details:${id}`;

    const fetchAdRecord = async () => {
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

      if (error) throw error;
      return { ad: data };
    };

    const applyAdRecord = async (result: { ad: any | null }) => {
      if (!active) return;

      const nextAd = result.ad;
      setAd(nextAd);

      if (!nextAd) {
        setImages([]);
        return;
      }

      const sortedImages = [...(nextAd.ad_images ?? [])].sort(
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

      if (active) setImages(signedImages.filter(Boolean));
    };

    unsubscribe = subscribeToAdsUpdates(() => {
      void loadAdsCached<{ ad: any | null }>(
        cacheKey,
        fetchAdRecord,
        (result) => {
          void applyAdRecord(result).catch((error) =>
            console.error("خطأ تحديث الإعلان:", error)
          );
        }
      ).catch((error) => console.error("خطأ تحديث كاش الإعلان:", error));
    });

    async function loadAd() {
      const cachedResult: { current: { ad: any | null } | null } = { current: null };

      try {
        await loadAdsCached<{ ad: any | null }>(
          cacheKey,
          fetchAdRecord,
          (result) => {
            cachedResult.current = result;
          }
        );
      } catch (error) {
        console.error("خطأ تحميل الإعلان:", error);
      }

      if (!active) return;

      const data = cachedResult.current?.ad ?? null;

      if (data) {
        if (!recordedViewIds.current.has(data.id)) {
          recordedViewIds.current.add(data.id);
          const { error: viewMetricError } = await supabase.rpc("record_ad_view", {
            p_ad_id: data.id,
            p_event_id: crypto.randomUUID(),
          });
          if (viewMetricError) console.error("تعذر تسجيل مشاهدة الإعلان:", viewMetricError);
        }

        const shareToken = new URLSearchParams(
          window.location.search
        ).get("share");

        if (shareToken) {
          try {
            if (Capacitor.getPlatform() !== "android") {
              console.log("مكافأة المشاركة متاحة عبر تطبيق Android فقط.");
            } else {
              const deviceInfo = await Device.getId();
              const visitorId = `android:${deviceInfo.identifier}`;

              const { data: challenge, error: challengeError } =
                await supabase.functions.invoke("verify-play-integrity", {
                  body: {
                    action: "create_challenge",
                    share_token: shareToken,
                    visitor_id: visitorId,
                  },
                });

              if (challengeError) throw challengeError;

              if (!challenge?.success || !challenge?.nonce) {
                throw new Error("تعذر إنشاء تحدي التحقق.");
              }

              const integrityResult =
                await PlayIntegrity.requestIntegrityToken({
                  nonce: challenge.nonce,
                  googleCloudProjectNumber: 171150571192,
                });

              if (!integrityResult?.token) {
                throw new Error("لم يتم الحصول على رمز التحقق من Google.");
              }

              const { data: verification, error: verificationError } =
                await supabase.functions.invoke("verify-play-integrity", {
                  body: {
                    action: "verify",
                    token: integrityResult.token,
                    share_token: shareToken,
                    visitor_id: visitorId,
                  },
                });

              if (verificationError) throw verificationError;

              if (!verification?.success) {
                throw new Error(
                  verification?.error || "فشل التحقق من سلامة الجهاز."
                );
              }

              if (verification.visit_recorded) {
                console.log("تم تسجيل الزيارة ومنح نقطة المشاركة.");
              } else {
                console.log("هذه الزيارة مسجلة سابقاً، لم تُمنح نقطة إضافية.");
              }
            }
          } catch (error) {
            console.error("تعذر التحقق من مشاركة الإعلان:", error);
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;
        setCurrentUserId(user?.id ?? null);

        if (user?.id === data.user_id) {
          const { data: metricsData, error: metricsError } = await supabase
            .from("ad_metrics")
            .select("views_count, contact_clicks_count, favorites_count")
            .eq("ad_id", data.id)
            .maybeSingle();

          if (metricsError) {
            console.error("تعذر تحميل إحصائيات الإعلان:", metricsError);
          } else if (metricsData) {
            setAdMetrics(metricsData);
          }
        }

        if (user && user.id === data.user_id) {
          const { data: pickupData, error: pickupError } = await supabase
            .from("ad_pickup_locations")
            .select("latitude, longitude, address_label")
            .eq("ad_id", data.id)
            .maybeSingle();

          if (pickupError) {
            console.error("Error loading pickup location:", pickupError);
          } else if (pickupData) {
            setPickupLatitude(Number(pickupData.latitude));
            setPickupLongitude(Number(pickupData.longitude));
            setPickupAddressLabel(pickupData.address_label ?? "");
          } else {
            setPickupLatitude(null);
            setPickupLongitude(null);
            setPickupAddressLabel("");
          }
        } else {
          setPickupLatitude(null);
          setPickupLongitude(null);
          setPickupAddressLabel("");
        }

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
        } else if (active) {
          setSeller(sellerData);
        }

        const { data: verificationResult, error: verificationError } =
          await supabase.rpc("get_public_verification_status", {
            p_user_id: data.user_id,
          });

        if (verificationError) {
          console.error("خطأ التحقق من حالة توثيق البائع:", verificationError);
          if (active) setIsVerified(false);
        } else if (active) {
          setIsVerified(Boolean(verificationResult));
        }
      } else {
        setCurrentUserId(null);
        setIsFavorite(false);
        setSeller(null);
        setIsVerified(false);
      }

      if (active) {
        await applyAdRecord({ ad: data });
        setLoading(false);
      }
    }

    void loadAd();

    return () => {
      active = false;
      unsubscribe();
    };
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
      { p_ad_id: ad.id }
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
        setPurchaseMessage("يوجد طلب شراء نشط لهذا الإعلان حالياً.");
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

      const { data: contactMetricResult, error: contactMetricError } = await supabase.rpc("record_ad_contact_click", {
        p_ad_id: ad.id,
        p_event_id: crypto.randomUUID(),
        p_conversation_id: conversationId,
      });
      if (contactMetricError) console.error("تعذر تسجيل نقرة المراسلة:", contactMetricError); else console.log("نتيجة تسجيل نقرة المراسلة:", contactMetricResult);

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
          .insert({ user_id: user.id, ad_id: ad.id });

        if (error) throw error;
        setIsFavorite(true);
      }
    invalidateAdsCache(`favorites:${user.id}`);
    } catch (error) {
      console.error("خطأ تحديث المفضلة:", error);
      alert("تعذر تحديث المفضلة. حاول مرة أخرى.");
    }
  }

  async function savePickupLocation() {
    if (!ad) return;

    if (pickupLatitude === null || pickupLongitude === null) {
      setPickupMessage("يرجى تحديد موقع الاستلام على الخريطة أولاً.");
      return;
    }

    setPickupSaving(true);
    setPickupMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== ad.user_id) {
        throw new Error("غير مسموح لك بتعديل موقع استلام هذا الإعلان.");
      }

      const { error } = await supabase
        .from("ad_pickup_locations")
        .upsert(
          {
            ad_id: ad.id,
            seller_id: user.id,
            latitude: pickupLatitude,
            longitude: pickupLongitude,
            address_label: pickupAddressLabel.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ad_id" }
        );

      if (error) throw error;

      setShowPickupEditor(false);
      setPickupMessage("تم حفظ موقع الاستلام بنجاح.");
    } catch (error: any) {
      console.error("Error saving pickup location:", error);
      setPickupMessage(error.message || "تعذر حفظ موقع الاستلام.");
    } finally {
      setPickupSaving(false);
    }
  }

  const formatPrice = () => {
    if (ad?.price == null) return "السعر عند التواصل";

    const currency =
      ad.currency === "USD"
        ? "دولار أمريكي"
        : ad.currency === "SYP"
          ? "ليرة سورية"
          : ad.currency;

    return `${Number(ad.price).toLocaleString("en-US")} ${currency}`;
  };

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f6f8f7] p-4">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-14 rounded-2xl bg-white" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-[420px] rounded-2xl bg-slate-200" />
            <div className="space-y-5 rounded-2xl bg-white p-6">
              <div className="h-5 w-1/3 rounded-lg bg-slate-200" />
              <div className="h-9 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-14 w-1/2 rounded-xl bg-slate-200" />
              <div className="h-12 rounded-xl bg-slate-200" />
              <div className="h-12 rounded-xl bg-slate-200" />
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
        className="flex min-h-screen items-center justify-center bg-[#f6f8f7] p-5"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-9 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ShoppingCart size={28} strokeWidth={1.6} />
          </div>
          <h2 className="mb-2 text-xl font-extrabold text-slate-800">
            الإعلان غير موجود
          </h2>
          <p className="mb-6 text-sm leading-7 text-slate-500">
            قد يكون الإعلان محذوفاً أو لم يعد متاحاً.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            <ArrowRight size={17} />
            العودة إلى السوق
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gradient-to-b from-[#edf4f0] via-[#f7f9f8] to-white pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
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
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700"
          >
            <ArrowRight size={18} />
            <span>العودة</span>
          </button>

          <div className="mr-auto flex items-center gap-2">
            <Link
              to="/"
              className="text-xl font-black tracking-tight text-emerald-700"
            >
              Sooq<span className="text-slate-800">.sy</span>
            </Link>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 sm:inline-block">
              سوقك الأقرب
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-9">
        <div className="grid items-start gap-5 lg:grid-cols-[1.12fr_0.88fr] lg:gap-8">
          {/* Gallery and seller */}
          <section className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-[26px] border border-white bg-white p-2.5 shadow-[0_18px_55px_rgba(15,45,35,0.09)] sm:p-3">
              <div className="relative flex h-[310px] items-center justify-center overflow-hidden rounded-[21px] bg-gradient-to-br from-[#eef3f0] to-[#f8faf9] sm:h-[440px] lg:h-[510px]">
                {images.length > 0 ? (
                  <img
                    src={images[activeImage]}
                    alt={ad.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <ImageIcon size={30} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium">
                      لا توجد صور لهذا الإعلان
                    </span>
                  </div>
                )}

                {images.length > 0 && (
                  <span className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-slate-900/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    {activeImage + 1} من {images.length}
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
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-lg transition hover:scale-105 hover:text-emerald-700"
                      aria-label="الصورة السابقة"
                    >
                      <ChevronRight size={21} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveImage((activeImage + 1) % images.length)
                      }
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-lg transition hover:scale-105 hover:text-emerald-700"
                      aria-label="الصورة التالية"
                    >
                      <ChevronLeft size={21} />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-3 flex gap-2.5 overflow-x-auto px-0.5 pb-1">
                  {images.map((src, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`h-[58px] w-[58px] shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-[66px] sm:w-[66px] ${
                        activeImage === index
                          ? "border-emerald-600 shadow-sm"
                          : "border-transparent opacity-65 hover:opacity-100"
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

            {/* Seller card */}
            <Link
              to={`/user/${ad.user_id}`}
              className="group flex items-center gap-3.5 rounded-[22px] border border-white bg-white p-4 shadow-[0_12px_35px_rgba(15,45,35,0.06)] transition hover:border-emerald-200 hover:shadow-lg sm:p-5"
            >
              {seller?.avatar_url ? (
                <img
                  src={seller.avatar_url}
                  alt="صورة البائع"
                  className="h-14 w-14 shrink-0 rounded-2xl border border-slate-100 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-extrabold text-emerald-700">
                  {(seller?.display_name || "م").charAt(0)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-slate-800">
                    {seller?.display_name || "مستخدم Sooq.sy"}
                  </p>

                  {isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                      <ShieldCheck size={13} />
                      موثّق
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs text-slate-400">
                  عضو منذ{" "}
                  {seller?.created_at
                    ? new Date(seller.created_at).toLocaleDateString("ar-SY")
                    : "غير محدد"}
                </p>
              </div>

              <div className="hidden items-center gap-1.5 text-xs font-bold text-emerald-700 sm:flex">
                الملف الشخصي
                <ArrowRight
                  size={15}
                  className="transition group-hover:-translate-x-1"
                />
              </div>
              <ArrowRight size={17} className="text-slate-300 sm:hidden" />
            </Link>
          </section>

          {/* Ad details */}
          <section className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-[26px] border border-white bg-white p-4 shadow-[0_18px_55px_rgba(15,45,35,0.075)] sm:p-6">
              {/* Category and city */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {ad.categories?.name_ar && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <Tag size={13} className="text-emerald-600" />
                    {ad.categories.name_ar}
                  </span>
                )}

                {ad.cities?.name_ar && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <MapPin size={13} className="text-emerald-600" />
                    {ad.cities.name_ar}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-extrabold leading-[1.7] text-slate-900 sm:text-xl">
                {ad.title}
              </h1>

              {/* Price */}
              <div className="mt-6 rounded-2xl border border-emerald-100 bg-gradient-to-l from-[#e5f6ed] via-[#f2faf5] to-white p-4 shadow-inner sm:p-5">
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  السعر المطلوب
                </p>
                <div className="text-2xl font-black tracking-tight text-emerald-800 sm:text-3xl">
                  {formatPrice()}
                </div>
              </div>

              {/* Product info */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-600">
                  <Tag size={15} className="text-slate-400" />
                  {ad.condition === "used"
                    ? "مستعمل"
                    : ad.condition === "new"
                      ? "جديد"
                      : ad.condition}
                </span>

                {ad.listing_type && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-600">
                    <ShoppingCart size={15} className="text-slate-400" />
                    {ad.listing_type === "sale" ? "للبيع" : ad.listing_type}
                  </span>
                )}
              </div>

              {currentUserId === ad.user_id && (
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Eye size={18} />
                      <span className="text-xs font-semibold">المشاهدات</span>
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-800">{adMetrics.views_count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <MessageCircle size={18} />
                      <span className="text-xs font-semibold">نقرات المراسلة</span>
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-800">{adMetrics.contact_clicks_count}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Heart size={18} />
                      <span className="text-xs font-semibold">المفضلة</span>
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-800">{adMetrics.favorites_count}</p>
                  </div>
                </div>
              )}

              {/* Seller pickup location */}
              {currentUserId === ad.user_id && (
                <div className="mt-6 rounded-2xl border border-slate-100 bg-[#fafcfb] p-3.5 sm:p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <MapPin size={19} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">
                        موقع استلام المنتج
                      </h3>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        حدد مكان استلام عامل التوصيل للمنتج من عندك.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPickupMessage("");
                      setShowPickupEditor((current) => !current);
                    }}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    <MapPin size={17} className="ml-2 inline-block" />
                    {pickupLatitude !== null && pickupLongitude !== null
                      ? "تعديل موقع الاستلام"
                      : "تفعيل التوصيل وتحديد موقع الاستلام"}
                  </button>

                  {showPickupEditor && (
                    <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
                      <p className="text-xs leading-6 text-slate-600">
                        اضغط على الخريطة لتحديد الموقع، ويمكنك سحب العلامة الحمراء لتعديلها.
                      </p>

                      <AdPickupLocationMap
                        latitude={pickupLatitude}
                        longitude={pickupLongitude}
                        onLocationChange={(latitude, longitude) => {
                          setPickupLatitude(latitude);
                          setPickupLongitude(longitude);
                        }}
                      />

                      <div>
                        <label className="mb-2 block text-xs font-bold text-slate-700">
                          وصف المكان أو العنوان (اختياري)
                        </label>
                        <input
                          type="text"
                          value={pickupAddressLabel}
                          onChange={(event) =>
                            setPickupAddressLabel(event.target.value)
                          }
                          placeholder="مثلاً: دمشق - المزة - جانب..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>

                      {pickupLatitude !== null &&
                        pickupLongitude !== null && (
                          <p
                            className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-500"
                            dir="ltr"
                          >
                            {pickupLatitude.toFixed(6)}, {pickupLongitude.toFixed(6)}
                          </p>
                        )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={savePickupLocation}
                          disabled={
                            pickupSaving ||
                            pickupLatitude === null ||
                            pickupLongitude === null
                          }
                          className="flex-1 rounded-xl bg-emerald-700 px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pickupSaving ? "جارٍ الحفظ..." : "حفظ موقع الاستلام"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPickupEditor(false)}
                          disabled={pickupSaving}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {pickupMessage && (
                    <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold leading-6 text-emerald-700">
                      {pickupMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {ad.listing_type === "sale" && (
                  <>
                    <button
                      type="button"
                      onClick={requestPurchase}
                      disabled={purchaseLoading}
                      className="flex w-full items-center justify-center gap-2.5 min-h-11 rounded-xl bg-amber-500 px-2.5 py-2 text-xs font-extrabold text-white shadow-sm shadow-amber-500/10 transition hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShoppingCart size={19} />
                      {purchaseLoading ? "جارٍ إرسال الطلب..." : "طلب شراء"}
                    </button>

                    {purchaseMessage && (
                      <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold leading-6 text-red-700">
                        {purchaseMessage}
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={startConversation}
                  className="flex w-full items-center justify-center gap-2.5 min-h-11 rounded-xl bg-emerald-700 px-2.5 py-2 text-xs font-extrabold text-white shadow-sm shadow-emerald-700/10 transition hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md"
                >
                  <MessageCircle size={19} />
                  مراسلة البائع
                </button>

                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={`flex w-full items-center justify-center gap-2.5 col-span-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    isFavorite
                      ? "border-rose-200 bg-rose-50 text-rose-600"
                      : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600"
                  }`}
                >
                  <Heart
                    size={18}
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-bold text-green-700 transition hover:bg-green-100"
                >
                  <Share2 size={16} />
                  مشاركة واتساب
                </button>

                <button
                  type="button"
                  onClick={copyAdLink}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <Copy size={16} />
                  نسخ الرابط
                </button>
              </div>

              {/* Description */}
              <div className="mt-7 rounded-2xl bg-[#f8faf9] p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-6 w-1 rounded-full bg-emerald-600" />
                  <h2 className="text-base font-extrabold text-slate-800">
                    وصف الإعلان
                  </h2>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">
                  {ad.description || "لا يوجد وصف لهذا الإعلان."}
                </p>
              </div>

              {/* Report */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowReportForm(!showReportForm);
                    setReportMessage("");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Flag size={15} />
                  الإبلاغ عن الإعلان
                </button>

                {showReportForm && (
                  <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/40 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-slate-800">
                        الإبلاغ عن هذا الإعلان
                      </h3>

                      <button
                        type="button"
                        onClick={() => setShowReportForm(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 transition hover:text-red-600"
                        aria-label="إغلاق"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <label className="mb-2 block text-xs font-bold text-slate-700">
                      سبب البلاغ
                    </label>

                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="mb-4 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
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

                    <label className="mb-2 block text-xs font-bold text-slate-700">
                      تفاصيل إضافية (اختياري)
                    </label>

                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="اشرح لنا سبب البلاغ..."
                      rows={3}
                      className="mb-4 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10"
                    />

                    <button
                      type="button"
                      onClick={submitReport}
                      disabled={reportLoading}
                      className="w-full rounded-xl bg-red-600 px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reportLoading ? "جارٍ إرسال البلاغ..." : "إرسال البلاغ"}
                    </button>
                  </div>
                )}

                {reportMessage && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-6 text-slate-600">
                    {reportMessage}
                  </p>
                )}
              </div>

              {/* Publish date */}
              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                <Clock3 size={15} />
                تاريخ النشر:
                <span className="font-semibold text-slate-500">
                  {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
