
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Search,
  X,
  Store as StoreIcon,
  Phone,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { loadAdsCached, subscribeToAdsUpdates, invalidateAdsCache } from "./lib/adCache";

type Store = {
  id: string;
  name: string;
  business_type: string;
  description: string | null;
  governorate: string;
  city: string;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_url: string | null;
  owner_id: string;
};

type Ad = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  condition: string | null;
  created_at: string;
  is_featured: boolean;
  category_name: string;
  city_name: string;
  images: string[];
};

export default function StoreDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [store, setStore] = useState<Store | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [condition, setCondition] = useState("all");
  const [category, setCategory] = useState("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
const [closingAdId, setClosingAdId] = useState<string | null>(null);
const [isClosingAd, setIsClosingAd] = useState(false);

  // الرجوع للصفحة السابقة، أو للرئيسية عند عدم وجود صفحة سابقة
const goBack = () => {
  if (window.history.length > 1) {
    navigate(-1);
  } else {
    navigate("/", { replace: true });
  }
};

useEffect(() => {
  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id ?? null);
  }

  loadCurrentUser();
}, []);
const confirmCloseAd = async () => {
  if (!closingAdId || !store || isClosingAd) return;

  setIsClosingAd(true);

  try {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      throw new Error("يجب تسجيل الدخول أولاً");
    }

    if (userData.user.id !== store.owner_id) {
      throw new Error("ليس لديك صلاحية إغلاق هذا الإعلان");
    }

    const { data, error } = await supabase
      .from("ads")
      .update({ status: "archived" })
      .eq("id", closingAdId)
      .eq("store_id", store.id)
      .eq("user_id", userData.user.id)
      .eq("status", "approved")
      .select("id");

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error("تعذر إغلاق الإعلان أو ليس لديك صلاحية عليه");
    }

    invalidateAdsCache(`store:ads:${store.id}`);
    setAds((current) =>
      current.filter((ad) => ad.id !== closingAdId)
    );

    setClosingAdId(null);
  } catch (error: any) {
    console.error("تعذر إغلاق الإعلان:", error);
    alert(error.message || "حدث خطأ أثناء إغلاق الإعلان");
  } finally {
    setIsClosingAd(false);
  }
};

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select(
          "id,owner_id,name,business_type,description,governorate,city,phone,whatsapp,logo_url,cover_url"
        )
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();

      if (storeError) console.error("تعذر تحميل المتجر:", storeError);
      if (!active) return;

      setStore(storeData as Store | null);

      const cacheKey = `store:ads:${id}`;

      async function loadStoreAds() {
        await loadAdsCached<Ad[]>(
          cacheKey,
          async () => {
            const { data: adsData, error: adsError } = await supabase
              .from("ads")
              .select(
                "id,title,description,price,currency,condition,created_at,is_featured,categories(name_ar),cities(name_ar),ad_images(image_path,sort_order)"
              )
              .eq("store_id", id)
              .eq("status", "approved")
              .order("created_at", { ascending: false });

            if (adsError) throw adsError;

            return Promise.all(
              (adsData ?? []).map(async (ad: any) => {
                const sorted = [...(ad.ad_images ?? [])].sort(
                  (a, b) => a.sort_order - b.sort_order
                );

                const images = await Promise.all(
                  sorted.map(async (image: any) => {
                    const { data } = await supabase.storage
                      .from("ad-images")
                      .createSignedUrl(image.image_path, 3600);

                    return data?.signedUrl ?? "";
                  })
                );

                const cat = Array.isArray(ad.categories)
                  ? ad.categories[0]
                  : ad.categories;
                const cityValue = Array.isArray(ad.cities)
                  ? ad.cities[0]
                  : ad.cities;

                return {
                  id: ad.id,
                  title: ad.title,
                  description: ad.description,
                  price: ad.price,
                  currency: ad.currency,
                  condition: ad.condition,
                  created_at: ad.created_at,
                  is_featured: ad.is_featured,
                  category_name: cat?.name_ar ?? "",
                  city_name: cityValue?.name_ar ?? "",
                  images: images.filter(Boolean),
                } as Ad;
              })
            );
          },
          (cachedAds) => {
            if (!active) return;
            setAds(cachedAds);
            setLoading(false);
          }
        );
      }

      unsubscribe = subscribeToAdsUpdates(() => {
        if (active) void loadStoreAds();
      });

      try {
        await loadStoreAds();
      } catch (error) {
        console.error("تعذر تحميل إعلانات المتجر:", error);
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [id]);

  const categories = useMemo(
    () =>
      [...new Set(ads.map((a) => a.category_name).filter(Boolean))].sort(),
    [ads]
  );

  const filtered = useMemo(
    () =>
      ads.filter((ad) => {
        const q = search.trim().toLowerCase();

        return (
          (!q ||
            `${ad.title} ${ad.description ?? ""} ${ad.category_name} ${ad.city_name}`
              .toLowerCase()
              .includes(q)) &&
          (condition === "all" || ad.condition === condition) &&
          (category === "all" || ad.category_name === category)
        );
      }),
    [ads, search, condition, category]
  );

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-slate-500"
      >
        <RefreshCw className="animate-spin" />
        جارٍ تحميل المتجر...

      </main>
    );
  }

  if (!store) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 p-8 text-center"
      >
        <p className="mb-4 font-bold text-slate-700">
          المتجر غير موجود أو غير متاح حالياً
        </p>

        <button
          onClick={() => navigate("/stores")}
          className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
        >
          العودة إلى المتاجر
        </button>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {/* زر الرجوع */}
        <button
          onClick={goBack}
          className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700"
        >
          <ArrowRight size={17} />
          رجوع
        </button>

        {/* معلومات المتجر */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* الغلاف */}
          <div
            className="relative z-0 h-40 bg-gradient-to-l from-emerald-200 to-slate-100 sm:h-56"
            style={
              store.cover_url
                ? {
                    backgroundImage: `url(${store.cover_url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />

          {/* الشعار والمعلومات */}
          <div className="relative z-10 px-5 pb-5 sm:px-7">
            <div className="-mt-12 relative z-20 mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <StoreIcon size={38} className="text-emerald-600" />
              )}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900">
                  {store.name}
                </h1>

                <p className="mt-1 font-bold text-emerald-700">
                  {store.business_type}
                </p>

                <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-slate-600">
                  {store.description}
                </p>

                <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={15} />
                  {[store.governorate, store.city]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {store.phone && (
                  <a
                    href={`tel:${store.phone}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
                  >
                    <Phone size={16} />
                    اتصال
                  </a>
                )}

                {store.whatsapp && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://wa.me/${store.whatsapp.replace(
                      /[^0-9]/g,
                      ""
                    )}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                  >
                    <MessageCircle size={16} />
                    واتساب
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* منتجات المتجر */}
        <div className="mb-5 mt-7 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">
            منتجات المتجر{" "}
            <span className="text-sm font-semibold text-slate-400">
              ({filtered.length})
            </span>
          </h2>
        </div>

        {/* البحث والفلاتر */}
        <section className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث ضمن منتجات المتجر..."
              className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option value="all">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="used">مستعمل</option>
          </select>
        </section>

        {/* قائمة المنتجات */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            لا توجد منتجات منشورة في هذا المتجر حالياً
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

{filtered.map((ad) => (
  <div
    key={ad.id}
    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
  >
    {currentUserId === store.owner_id && (
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();

    setClosingAdId(ad.id);
  }}
  className="absolute left-2 top-2 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-600 shadow-md"
>
  <X size={19} />
</button>
    )}

    <button
      type="button"
      onClick={() => navigate(`/ad/${ad.id}`)}
      className="block w-full text-right"
    >
      {ad.images[0] ? (
        <img
          src={ad.images[0]}
          alt={ad.title}
          className="h-36 w-full object-cover sm:h-48"
        />
      ) : (
        <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-400 sm:h-48">
          لا توجد صورة
        </div>
      )}

      <div className="p-3">
        <div className="mb-1 flex flex-wrap gap-1">
          {ad.is_featured && (
            <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
              مميز
            </span>
          )}

          <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
            {ad.condition === "new"
              ? "جديد"
              : ad.condition === "used"
              ? "مستعمل"
              : ""}
          </span>
        </div>

        <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-slate-800">
          {ad.title}
        </h3>

        <p className="mt-2 font-black text-emerald-700">
          {ad.price == null
            ? "السعر عند التواصل"
            : `${ad.price.toLocaleString("en-US")} ${
                ad.currency ?? ""
              }`}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {ad.category_name}
          {ad.city_name ? ` • ${ad.city_name}` : ""}
        </p>
      </div>
    </button>
  </div>
))}

          </div>
        )}
      </div>
              {closingAdId && (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
    <div
      dir="rtl"
      className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
    >
      <div className="mb-3 flex items-center gap-2">
        <X className="text-red-600" size={22} />
        <h3 className="text-lg font-black text-slate-900">
          إغلاق الإعلان
        </h3>
      </div>

      <p className="mb-5 text-sm leading-7 text-slate-600">
        هل أنت متأكد من إغلاق هذا الإعلان؟ سيختفي من المتجر والسوق، ولن يتم حذفه نهائياً.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isClosingAd}
          onClick={() => setClosingAdId(null)}
          className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
        >
          إلغاء
        </button>

        <button
          type="button"
          disabled={isClosingAd}
          onClick={confirmCloseAd}
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {isClosingAd ? "جارٍ الإغلاق..." : "تأكيد الإغلاق"}
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}
