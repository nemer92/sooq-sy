
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Heart,
  Car,
  LoaderCircle,
  Filter,
  X,
} from "lucide-react";
import { supabase } from "./lib/supabase";

type Ad = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  listing_type: "sale" | "donation";
  category_id: number;
  city_id: number | null;
  condition: string;
  city_name: string;
  category_name: string;
  created_at: string;
  images: string[];
  is_featured?: boolean;
};

type Category = {
  id: number;
  name_ar: string;
  parent_id: number | null;
};

type Governorate = {
  id: number;
  name_ar: string;
};

type City = {
  id: number;
  name_ar: string;
  governorate_id: number;
};

const pageConfig = {
  featured: {
    title: "جميع الإعلانات المميزة",
    subtitle: "إعلانات مختارة تظهر بتمييز خاص",
  },
  regular: {
    title: "جميع الإعلانات العادية",
    subtitle: "تصفح أحدث الإعلانات المنشورة",
  },
  donations: {
    title: "جميع التبرعات",
    subtitle: "أغراض مجانية يمكنك الاستفادة منها",
  },
};

export default function AllAds() {
  const location = useLocation();
  const navigate = useNavigate();

  const type =
    location.pathname === "/featured-ads"
      ? "featured"
      : location.pathname === "/regular-ads"
        ? "regular"
        : location.pathname === "/donations"
          ? "donations"
          : "";

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteAdIds, setFavoriteAdIds] = useState<string[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedGovernorate, setSelectedGovernorate] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // استعادة فلتر حالة الإعلان المحفوظ عند فتح الصفحة أو الرجوع إليها
  const [selectedConditions, setSelectedConditions] = useState<
    ("new" | "used")[]
  >(() => {
    try {
      const saved = sessionStorage.getItem("sooq_selected_conditions");

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.length <= 2 &&
          parsed.every(
            (item): item is "new" | "used" =>
              item === "new" || item === "used"
          ) &&
          new Set(parsed).size === parsed.length
        ) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("خطأ باستعادة فلتر حالة الإعلان:", error);
    }

    return ["new", "used"];
  });

  // حفظ الاختيارات تلقائياً عند كل تغيير
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "sooq_selected_conditions",
        JSON.stringify(selectedConditions)
      );
    } catch (error) {
      console.error("خطأ بحفظ فلتر حالة الإعلان:", error);
    }
  }, [selectedConditions]);
  const validType =
    type === "featured" ||
    type === "regular" ||
    type === "donations";

  const config = validType ? pageConfig[type] : pageConfig.regular;

  // تبديل حالة الإعلان مع منع إلغاء الخيارين معاً
  function toggleCondition(condition: "new" | "used") {
    setSelectedConditions((prev) => {
      if (prev.includes(condition)) {
        if (prev.length === 1) {
          window.alert("يجب اختيار حالة واحدة على الأقل.");
          return prev;
        }

        return prev.filter((item) => item !== condition);
      }

      return [...prev, condition];
    });
  }

  useEffect(() => {
    let active = true;

    async function loadFilters() {
      try {
        const [categoriesResult, governoratesResult, citiesResult] =
          await Promise.all([
            supabase
              .from("categories")
              .select("id, name_ar, parent_id")
              .eq("is_active", true)
              .order("sort_order", { ascending: true }),

            supabase
              .from("governorates")
              .select("id, name_ar")
              .eq("is_active", true)
              .order("name_ar", { ascending: true }),

            supabase
              .from("cities")
              .select("id, name_ar, governorate_id")
              .eq("is_active", true)
              .order("name_ar", { ascending: true }),
          ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (governoratesResult.error) throw governoratesResult.error;
        if (citiesResult.error) throw citiesResult.error;

        if (!active) return;

        setCategories((categoriesResult.data ?? []) as Category[]);
        setGovernorates((governoratesResult.data ?? []) as Governorate[]);
        setCities((citiesResult.data ?? []) as City[]);
      } catch (error) {
        console.error("خطأ تحميل بيانات الفلاتر:", error);
      }
    }

    loadFilters();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAds() {
      setLoading(true);

      try {
        if (!validType) {
          if (active) {
            setAds([]);
            setLoading(false);
          }
          return;
        }

        let query = supabase
          .from("ads")
          .select(`
            id,
            title,
            description,
            price,
            currency,
            listing_type,
            category_id,
            city_id,
            condition,
            created_at,
            is_featured,
            categories(name_ar),
            cities(name_ar),
            ad_images(image_path, sort_order)
          `)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (type === "featured") {
          query = query
            .eq("listing_type", "sale")
            .eq("is_featured", true);
        } else if (type === "regular") {
          query = query
            .eq("listing_type", "sale")
            .or("is_featured.is.null,is_featured.eq.false");
        } else if (type === "donations") {
          query = query.eq("listing_type", "donation");
        }

        const { data, error } = await query;

        if (error) throw error;

        const formatted: Ad[] = await Promise.all(
          (data ?? []).map(async (ad: any) => {
            const sortedImages = (ad.ad_images ?? []).sort(
              (a: any, b: any) => a.sort_order - b.sort_order
            );

            const signedImages = await Promise.all(
              sortedImages.map(async (image: any) => {
                const { data: imageData, error: imageError } =
                  await supabase.storage
                    .from("ad-images")
                    .createSignedUrl(image.image_path, 3600);

                if (imageError) return "";
                return imageData.signedUrl;
              })
            );

            return {
              id: ad.id,
              title: ad.title,
              description: ad.description ?? "",
              price: ad.price,
              currency: ad.currency,
              listing_type: ad.listing_type,
              category_id: ad.category_id,
              city_id: ad.city_id,
              condition: ad.condition,
              created_at: ad.created_at,
              is_featured: ad.is_featured ?? false,
              category_name: ad.categories?.name_ar ?? "",
              city_name: ad.cities?.name_ar ?? "",
              images: signedImages.filter(Boolean),
            };
          })
        );

        if (!active) return;

        setAds(formatted);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: favorites, error: favoritesError } =
            await supabase
              .from("favorites")
              .select("ad_id")
              .eq("user_id", user.id);

          if (favoritesError) {
            console.error("خطأ تحميل المفضلة:", favoritesError);
          }

          if (active) {
            setFavoriteAdIds(
              (favorites ?? []).map((item) => item.ad_id)
            );
          }
        } else if (active) {
          setFavoriteAdIds([]);
        }
      } catch (error) {
        console.error("خطأ تحميل الإعلانات:", error);

        if (active) {
          setAds([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAds();

    return () => {
      active = false;
    };
  }, [type]);

  const subCategories = categories.filter(
    (category) =>
      category.parent_id === Number(selectedCategory)
  );

  const filteredCities = cities.filter(
    (city) =>
      selectedGovernorate === "" ||
      String(city.governorate_id) === selectedGovernorate
  );

  const filteredAds = ads.filter((ad) => {
    const matchesCategory =
      selectedCategory === "" ||
      Number(ad.category_id) === Number(selectedCategory) ||
      categories.some(
        (sub) =>
          sub.parent_id === Number(selectedCategory) &&
          sub.id === Number(ad.category_id)
      );

    const matchesSubCategory =
      selectedSubCategory === "" ||
      Number(ad.category_id) === Number(selectedSubCategory);

    const matchesGovernorate =
      selectedGovernorate === "" ||
      cities.some(
        (city) =>
          String(city.governorate_id) === selectedGovernorate &&
          city.id === ad.city_id
      );

    const matchesCity =
      selectedCity === "" ||
      String(ad.city_id) === selectedCity;

    // تطبيق فلتر الحالة على الإعلانات المميزة والعادية فقط
    const matchesCondition =
      type === "donations" ||
      selectedConditions.some((condition) => condition === ad.condition);

    return (
      matchesCategory &&
      matchesSubCategory &&
      matchesGovernorate &&
      matchesCity &&
      matchesCondition
    );
  });

  function clearFilters() {
    setSelectedCategory("");
    setSelectedSubCategory("");
    setSelectedGovernorate("");
    setSelectedCity("");
  }

  const hasActiveFilters =
    selectedCategory !== "" ||
    selectedSubCategory !== "" ||
    selectedGovernorate !== "" ||
    selectedCity !== "" ||
    (type !== "donations" && selectedConditions.length !== 2);

  async function toggleFavorite(adId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return;
    }

    const isFavorite = favoriteAdIds.includes(adId);

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("ad_id", adId);

      if (error) {
        console.error(error);
        return;
      }

      setFavoriteAdIds((current) =>
        current.filter((id) => id !== adId)
      );
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({
          user_id: user.id,
          ad_id: adId,
        });

      if (error) {
        console.error(error);
        return;
      }

      setFavoriteAdIds((current) => [...current, adId]);
    }
  }

  const filterTheme =
    type === "featured"
      ? {
          border: "border-amber-200",
          background: "bg-amber-50/80",
          heading: "text-amber-950",
          focus: "focus:border-amber-400 focus:ring-amber-100",
          button: "bg-amber-600 hover:bg-amber-700",
          count: "bg-amber-100 text-amber-900",
        }
      : type === "donations"
        ? {
            border: "border-rose-100",
            background: "bg-rose-50/70",
            heading: "text-rose-950",
            focus: "focus:border-rose-300 focus:ring-rose-100",
            button: "bg-rose-500 hover:bg-rose-600",
            count: "bg-rose-100 text-rose-800",
          }
        : {
            border: "border-emerald-100",
            background: "bg-emerald-50/60",
            heading: "text-emerald-950",
            focus: "focus:border-emerald-400 focus:ring-emerald-100",
            button: "bg-emerald-600 hover:bg-emerald-700",
            count: "bg-emerald-100 text-emerald-800",
          };

  const selectClass = `h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:h-10 sm:px-3 sm:text-xs ${filterTheme.focus}`;

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
<button
  onClick={() => {
    navigate("/", { replace: true });
  }}
  className="mb-4 flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 sm:mb-6"
>
  <ArrowRight size={19} />
  رجوع
</button>
        <header
          className={`mb-4 rounded-2xl p-4 sm:mb-6 sm:rounded-3xl sm:p-8 ${
            type === "featured"
              ? "border border-amber-300 bg-gradient-to-l from-amber-100 via-yellow-50 to-amber-200"
              : type === "donations"
                ? "border border-rose-100 bg-rose-50"
                : "border border-slate-200 bg-white"
          }`}
        >
          <h1
            className={`text-xl font-black sm:text-3xl ${
              type === "featured"
                ? "text-amber-900"
                : "text-slate-900"
            }`}
          >
            {type === "featured" && "⭐ "}
            {config.title}
          </h1>

          <p className="mt-1.5 text-xs text-slate-600 sm:mt-2 sm:text-sm">
            {config.subtitle}
          </p>

          {!loading && (
            <p className="mt-2 text-xs font-bold text-slate-500 sm:mt-3 sm:text-sm">
              عدد الإعلانات: {filteredAds.length}
            </p>
          )}
        </header>

        {/* الفلاتر - تصميم مدمج وأنيق */}
        <section
          className={`mb-4 rounded-xl border p-2.5 shadow-sm sm:mb-6 sm:rounded-2xl sm:p-4 ${filterTheme.border} ${filterTheme.background}`}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${filterTheme.count}`}
              >
                <Filter size={15} />
              </span>

              <div className="min-w-0">
                <h2 className={`text-xs font-black sm:text-sm ${filterTheme.heading}`}>
                  تصفية الإعلانات
                </h2>
                <p className="hidden text-[10px] text-slate-500 sm:block">
                  حدد التصنيف والموقع
                </p>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 sm:px-2.5 sm:text-xs"
              >
                <X size={12} />
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-bold text-slate-600 sm:text-xs">
                التصنيف الرئيسي
              </label>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubCategory("");
                }}
                className={selectClass}
              >
                <option value="">كل التصنيفات</option>
                {categories
                  .filter((category) => category.parent_id === null)
                  .map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name_ar}
                    </option>
                  ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-bold text-slate-600 sm:text-xs">
                التصنيف الفرعي
              </label>

              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                disabled={!selectedCategory || subCategories.length === 0}
                className={selectClass}
              >
                <option value="">كل التصنيفات الفرعية</option>
                {subCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-bold text-slate-600 sm:text-xs">
                المحافظة
              </label>

              <select
                value={selectedGovernorate}
                onChange={(e) => {
                  setSelectedGovernorate(e.target.value);
                  setSelectedCity("");
                }}
                className={selectClass}
              >
                <option value="">كل المحافظات</option>
                {governorates.map((governorate) => (
                  <option key={governorate.id} value={String(governorate.id)}>
                    {governorate.name_ar}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-bold text-slate-600 sm:text-xs">
                المدينة
              </label>

              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                disabled={!selectedGovernorate}
                className={selectClass}
              >
                <option value="">كل المدن</option>
                {filteredCities.map((city) => (
                  <option key={city.id} value={String(city.id)}>
                    {city.name_ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* فلتر جديد ومستعمل - لا يظهر في صفحة التبرعات */}
          {type !== "donations" && (
            <div className="mt-3 rounded-xl border border-white/90 bg-white/80 p-3 shadow-sm sm:mt-4 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className={`text-xs font-black sm:text-sm ${filterTheme.heading}`}>
                    حالة الإعلان
                  </h3>
                  <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">
                    اختر حالة المنتجات التي تريد مشاهدتها
                  </p>
                </div>

                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${filterTheme.count}`}>
                  {selectedConditions.length === 2 ? "الكل" : selectedConditions[0] === "new" ? "جديد فقط" : "مستعمل فقط"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition sm:p-3 ${
                    selectedConditions.includes("used")
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedConditions.includes("used")}
                    onChange={() => toggleCondition("used")}
                    className="h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className="text-xs font-bold text-slate-700 sm:text-sm">
                    مستعمل
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition sm:p-3 ${
                    selectedConditions.includes("new")
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedConditions.includes("new")}
                    onChange={() => toggleCondition("new")}
                    className="h-4 w-4 shrink-0 accent-emerald-600"
                  />
                  <span className="text-xs font-bold text-slate-700 sm:text-sm">
                    جديد
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2 sm:mt-3 sm:pt-2.5">
            <span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-slate-500 sm:text-xs">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">
                {selectedCity
                  ? cities.find((city) => String(city.id) === selectedCity)?.name_ar
                  : selectedGovernorate
                    ? governorates.find((gov) => String(gov.id) === selectedGovernorate)?.name_ar
                    : "جميع المناطق"}
              </span>
            </span>

            {!loading && (
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black sm:px-2.5 sm:text-xs ${filterTheme.count}`}
              >
                {filteredAds.length} نتيجة
              </span>
            )}
          </div>
        </section>

        {loading ? (
          <div className="flex flex-col items-center py-20 text-slate-500">
            <LoaderCircle className="animate-spin" size={32} />
            <p className="mt-3">جارٍ تحميل الإعلانات...</p>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Heart size={36} className="mx-auto text-slate-300" />

            <p className="mt-3 font-bold text-slate-600">
              {ads.length === 0
                ? "لا توجد إعلانات في هذا القسم حالياً"
                : "لا توجد نتائج مطابقة للفلاتر المختارة"}
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className={`mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition ${filterTheme.button}`}
              >
                عرض جميع الإعلانات
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAds.map((ad) => (
              <article
                key={ad.id}
                onClick={() =>
  navigate(`/ad/${ad.id}`, {
    state: {
      from: location.pathname + location.search,
    },
  })
}
                className={`group min-w-0 cursor-pointer overflow-hidden rounded-xl border bg-white transition hover:-translate-y-1 hover:shadow-lg sm:rounded-2xl ${
                  type === "featured"
                    ? "border-amber-300 shadow-sm shadow-amber-100"
                    : "border-slate-100"
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  {ad.images.length > 0 ? (
                    <img
                      src={ad.images[0]}
                      alt={ad.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      {type === "donations" ? (
                        <Heart size={32} />
                      ) : (
                        <Car size={32} />
                      )}
                    </div>
                  )}

                  <span
                    className={`absolute right-1.5 top-1.5 max-w-[calc(100%-3rem)] truncate rounded-md px-2 py-1 text-[9px] font-bold sm:right-3 sm:top-3 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-xs ${
                      type === "featured"
                        ? "bg-amber-200 text-amber-900"
                        : type === "donations"
                          ? "bg-rose-500 text-white"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {type === "featured"
                      ? "⭐ إعلان مميز"
                      : type === "donations"
                        ? "للتبرع مجاناً"
                        : "إعلان عادي"}
                  </span>

                  {type !== "donations" && (
                    <button
                      type="button"
                      aria-label="إضافة للمفضلة"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(ad.id);
                      }}
                      className="absolute left-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-slate-500 hover:text-red-500 sm:left-3 sm:top-3 sm:p-2"
                    >
                      <Heart
                        size={15}
                        fill={
                          favoriteAdIds.includes(ad.id)
                            ? "currentColor"
                            : "none"
                        }
                        className={
                          favoriteAdIds.includes(ad.id)
                            ? "text-red-500"
                            : ""
                        }
                      />
                    </button>
                  )}
                </div>

                <div className="p-2 sm:p-3">
                  <h3 className="line-clamp-2 min-h-9 text-xs font-bold leading-5 text-slate-800 sm:min-h-12 sm:text-sm sm:leading-6">
                    {ad.title}
                  </h3>

                  {type === "donations" ? (
                    <p className="mt-1.5 text-sm font-black text-emerald-700 sm:mt-2 sm:text-lg">
                      مجاناً ❤️
                    </p>
                  ) : (
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1 sm:mt-2">
                      <span className="text-sm font-black text-emerald-700 sm:text-lg">
                        {ad.price?.toLocaleString("en-US") ??
                          "السعر عند التواصل"}
                      </span>

                      <span className="text-[9px] font-semibold text-slate-500 sm:text-xs">
                        {ad.currency === "USD"
                          ? "دولار"
                          : ad.currency === "SYP"
                            ? "ليرة سورية"
                            : ad.currency}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 flex min-w-0 items-center justify-between gap-1 border-t border-slate-100 pt-2 text-[9px] text-slate-400 sm:mt-3 sm:pt-2.5 sm:text-[11px]">
                    <span className="flex min-w-0 items-center gap-0.5 truncate">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">
                        {ad.city_name || "غير محدد"}
                      </span>
                    </span>

                    <span className="shrink-0">
                      {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
