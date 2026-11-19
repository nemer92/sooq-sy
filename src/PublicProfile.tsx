
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  UserRound,
  MapPin,
  CalendarDays,
  Package,
  LoaderCircle,
  Megaphone,
  Star,
  Award,
  MessageCircle,
  UserPlus,
  UserCheck,
  ShieldCheck,
} from "lucide-react";

type Review = {
  id: string;
  reviewer_id: string;
  rating: number;
  communication_rating: number;
  credibility_rating: number;
  description_rating: number;
  behavior_rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
};

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [ads, setAds] = useState<any[]>([]);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [successfulSales, setSuccessfulSales] = useState(0);
  const [isVerified, setIsVerified] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOwnProfile = Boolean(currentUserId && currentUserId === id);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!id) {
        setError("رابط الملف الشخصي غير صالح.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data: authData } = await supabase.auth.getUser();
        const loggedInUserId = authData.user?.id || null;

        if (!cancelled) {
          setCurrentUserId(loggedInUserId);
        }

        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, bio, city_id, created_at")
            .eq("id", id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setError("هذا الملف الشخصي غير موجود.");
          return;
        }

        if (cancelled) return;
        setProfile(profileData);

        // تحميل حالة التوثيق من قاعدة البيانات
        const { data: verificationData, error: verificationError } =
          await supabase.rpc("get_public_verification_status", {
            p_user_id: id,
          });

        if (verificationError) throw verificationError;

        if (!cancelled) {
          setIsVerified(Boolean(verificationData));
        }

        const [adsResult, reviewsResult, salesResult] = await Promise.all([
          supabase
            .from("ads")
            .select("id, public_code, title, price, currency, created_at, city_id")
            .eq("user_id", id)
            .eq("status", "approved")
            .order("created_at", { ascending: false }),

          supabase
            .from("seller_reviews")
            .select(
              "id, reviewer_id, rating, communication_rating, credibility_rating, description_rating, behavior_rating, comment, created_at"
            )
            .eq("seller_id", id)
            .order("created_at", { ascending: false }),

          supabase.rpc("get_public_seller_sales_count", {
            p_seller_id: id,
          }),
        ]);

        if (adsResult.error) throw adsResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        if (cancelled) return;

        const loadedAds = adsResult.data || [];
        const loadedReviews = (reviewsResult.data || []) as Review[];

        setAds(loadedAds);
        setReviews(loadedReviews);

        if (!salesResult.error) {
          setSuccessfulSales(Number(salesResult.data || 0));
        } else {
          console.error("تعذر تحميل عدد المبيعات:", salesResult.error);
        }

        if (loggedInUserId && loggedInUserId !== id) {
          const { data: followData, error: followError } =
            await supabase
              .from("user_follows")
              .select("id")
              .eq("follower_id", loggedInUserId)
              .eq("followed_id", id)
              .maybeSingle();

          if (followError) throw followError;
          if (!cancelled) setIsFollowing(Boolean(followData));
        }

        if (loadedReviews.length > 0) {
          const reviewerIds = Array.from(
            new Set(loadedReviews.map((review) => review.reviewer_id))
          );

          const { data: reviewersData, error: reviewersError } =
            await supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", reviewerIds);

          if (reviewersError) throw reviewersError;

          const reviewersMap: Record<
            string,
            { name: string; avatar: string | null }
          > = {};

          (reviewersData || []).forEach((reviewer) => {
            reviewersMap[reviewer.id] = {
              name: reviewer.display_name || "مستخدم",
              avatar: reviewer.avatar_url,
            };
          });

          loadedReviews.forEach((review) => {
            const reviewer = reviewersMap[review.reviewer_id];
            review.reviewer_name = reviewer?.name || "مستخدم";
            review.reviewer_avatar = reviewer?.avatar || null;
          });

          if (!cancelled) setReviews([...loadedReviews]);
        }

        const cityIds = Array.from(
          new Set(
            [profileData.city_id, ...loadedAds.map((ad) => ad.city_id)]
              .filter(Boolean)
              .map(String)
          )
        );

        if (cityIds.length > 0) {
          const { data: citiesData, error: citiesError } =
            await supabase
              .from("cities")
              .select("id, name_ar")
              .in("id", cityIds);

          if (citiesError) throw citiesError;

          const cityMap: Record<string, string> = {};

          (citiesData || []).forEach((city) => {
            cityMap[String(city.id)] = city.name_ar;
          });

          if (!cancelled) setCities(cityMap);
        } else {
          setCities({});
        }
      } catch (err) {
        console.error("خطأ تحميل الملف الشخصي:", err);
        if (!cancelled) {
          setError("تعذر تحميل الملف الشخصي. حاول مرة أخرى.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) /
        reviews.length
      : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => Number(review.rating) === rating).length,
  }));

  const renderStars = (rating: number, size = 17) => (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-200"
          }
        />
      ))}
    </div>
  );

  async function handleFollow() {
    if (!id || followLoading) return;

    if (!currentUserId) {
      navigate("/auth");
      return;
    }

    if (currentUserId === id) return;

    setFollowLoading(true);

    try {
      if (isFollowing) {
        const { error: deleteError } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followed_id", id);

        if (deleteError) throw deleteError;
        setIsFollowing(false);
      } else {
        const { error: insertError } = await supabase
          .from("user_follows")
          .insert({
            follower_id: currentUserId,
            followed_id: id,
          });

        if (insertError) throw insertError;
        setIsFollowing(true);
      }
    } catch (err) {
      console.error("خطأ في متابعة المستخدم:", err);
      window.alert("تعذر تنفيذ العملية. حاول مرة أخرى.");
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleMessage() {
    if (!id || messageLoading) return;

    if (!currentUserId) {
      navigate("/auth");
      return;
    }

    if (currentUserId === id) return;

    if (ads.length === 0) {
      window.alert("لا يوجد إعلان متاح لبدء محادثة مع هذا المستخدم حالياً.");
      return;
    }

    setMessageLoading(true);

    try {
      const targetAd = ads[0];

      const { data: existingConversation, error: findError } =
        await supabase
          .from("conversations")
          .select("id")
          .eq("ad_id", targetAd.id)
          .eq("buyer_id", currentUserId)
          .maybeSingle();

      if (findError) throw findError;

      if (existingConversation) {
        navigate(`/messages/${existingConversation.id}`);
        return;
      }

      const { data: newConversation, error: createError } =
        await supabase
          .from("conversations")
          .insert({
            ad_id: targetAd.id,
            buyer_id: currentUserId,
            seller_id: id,
          })
          .select("id")
          .single();

      if (createError) throw createError;

      navigate(`/messages/${newConversation.id}`);
    } catch (err) {
      console.error("خطأ إنشاء المحادثة:", err);
      window.alert("تعذر بدء المحادثة. حاول التواصل من خلال أحد إعلانات المستخدم.");
    } finally {
      setMessageLoading(false);
    }
  }

  function handleVerification() {
    window.alert(
      "خدمة توثيق الحساب ستتوفر قريباً. سيتمكن المستخدم من إرسال طلب التوثيق ومتابعة حالته من هنا."
    );
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <div className="flex items-center gap-3 text-emerald-700">
          <LoaderCircle className="animate-spin" size={26} />
          <span className="font-bold">جارٍ تحميل الملف الشخصي...</span>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 px-4 py-12 text-center"
      >
        <p className="mb-5 font-bold text-slate-700">
          {error || "الملف الشخصي غير موجود."}
        </p>
        <Link to="/" className="font-bold text-emerald-700">
          العودة إلى السوق
        </Link>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 pb-12">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-emerald-700"
          >
            <ArrowRight size={20} />
            العودة إلى السوق
          </Link>

          <span className="mr-auto text-xl font-black text-emerald-700">
            Sooq.sy
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-5">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-28 bg-gradient-to-l from-emerald-900 via-emerald-700 to-teal-500 sm:h-36" />

          <div className="px-5 pb-5 sm:px-8">
            <div className="-mt-12 flex flex-wrap items-end gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-emerald-50 text-emerald-700 shadow-md">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound size={44} />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black text-slate-900">
                  {profile.display_name || "مستخدم Sooq.sy"}
                </h1>

                {isVerified ? (
                  <span
                    title="حساب موثّق"
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-blue-500 text-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3"
                      fill="currentColor"
                    >
                      <path d="M9.2 16.2 4.9 12l-1.4 1.4 5.7 5.7L21 7.3l-1.4-1.4z" />
                    </svg>
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    حساب غير موثّق
                  </span>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <h2 className="mb-1 text-xs font-bold text-slate-700">
                  نبذة عن المستخدم
                </h2>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                  {profile.bio}
                </p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <Package size={16} />
                  <span className="text-[11px] text-slate-500">الإعلانات</span>
                </div>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {ads.length}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <Award size={16} />
                  <span className="text-[11px] text-slate-500">مبيعات ناجحة</span>
                </div>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {successfulSales}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Star size={16} />
                  <span className="text-[11px] text-slate-500">التقييم</span>
                </div>
                <p className="mt-1 text-lg font-black text-slate-800">
                  {reviews.length ? averageRating.toFixed(1) : "—"}
                  <span className="mr-1 text-xs font-medium text-slate-400">
                    ({reviews.length})
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <MapPin size={16} />
                  <span className="text-[11px] text-slate-500">المدينة</span>
                </div>
                <p className="mt-1 truncate text-sm font-bold text-slate-800">
                  {profile.city_id
                    ? cities[String(profile.city_id)] || "غير محددة"
                    : "غير محددة"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays size={14} />
              <span>
                تاريخ الانضمام:{" "}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString("ar-SY")
                  : "غير محدد"}
              </span>
            </div>

            {!isOwnProfile && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleMessage}
                  disabled={messageLoading}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                >
                  {messageLoading ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <MessageCircle size={17} />
                  )}
                  مراسلة
                </button>

                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
                    isFollowing
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {followLoading ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : isFollowing ? (
                    <UserCheck size={17} />
                  ) : (
                    <UserPlus size={17} />
                  )}
                  {isFollowing ? "تتابعه" : "متابعة"}
                </button>
              </div>
            )}

            {isOwnProfile && (
              <button
                type="button"
                onClick={handleVerification}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                <ShieldCheck size={16} />
                طلب توثيق الحساب
              </button>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Award size={17} className="text-emerald-600" />
              تقييمات البائع
            </h2>
            <span className="text-xs text-slate-400">
              {reviews.length} تقييم
            </span>
          </div>

          {reviews.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-500">
              لا توجد تقييمات حتى الآن.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-slate-800">
                  {averageRating.toFixed(1)}
                </span>
                <div>
                  {renderStars(averageRating, 14)}
                  <p className="mt-1 text-[11px] text-slate-400">
                    من {reviews.length} تقييم
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                {ratingCounts.map(({ rating, count }) => (
                  <div key={rating} className="flex items-center gap-2">
                    <span className="w-3 text-[11px] text-slate-500">
                      {rating}
                    </span>
                    <Star
                      size={11}
                      className="fill-amber-400 text-amber-400"
                    />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{
                          width: `${(count / reviews.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-4 text-left text-[10px] text-slate-400">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {reviews.slice(0, 3).map((review) => (
                  <div
                    key={review.id}
                    className="border-t border-slate-100 pt-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-slate-700">
                        {review.reviewer_name}
                      </span>
                      {renderStars(Number(review.rating), 12)}
                    </div>
                    {review.comment && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">
                إعلانات المستخدم
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                الإعلانات المنشورة والمتاحة حالياً
              </p>
            </div>

            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
              {ads.length} إعلان
            </span>
          </div>

          {ads.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center">
              <Megaphone className="mx-auto mb-3 text-slate-300" size={34} />
              <p className="text-sm font-bold text-slate-600">
                لا توجد إعلانات منشورة حالياً.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ads.map((ad) => (
                <Link
                  key={ad.id}
                  to={`/ad/${ad.public_code || ad.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <h3 className="line-clamp-2 text-sm font-bold leading-6 text-slate-800">
                    {ad.title}
                  </h3>

                  <p className="mt-2 text-base font-black text-emerald-700">
                    {ad.price != null
                      ? `${Number(ad.price).toLocaleString("en-US")} ${
                          ad.currency === "USD"
                            ? "دولار"
                            : ad.currency === "SYP"
                              ? "ليرة سورية"
                              : ad.currency || ""
                        }`
                      : "السعر عند التواصل"}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      {ad.city_id
                        ? cities[String(ad.city_id)] || "مدينة غير محددة"
                        : "مدينة غير محددة"}
                    </span>
                    <span>
                      {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-bold text-emerald-700">
                    عرض الإعلان ←
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
