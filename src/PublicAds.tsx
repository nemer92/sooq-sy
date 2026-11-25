import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, Car } from "lucide-react";
import { supabase } from "./lib/supabase";

type Ad = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  created_at: string;
  category_name: string;
  city_name: string;
  images: string[];
  is_featured: boolean;
};

export default function PublicAds() {
  const location = useLocation();
  const navigate = useNavigate();
  const featuredOnly = location.pathname === "/featured-ads";
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAds() {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase
        .from("ads")
        .select(`
          id, title, description, price, currency, created_at, is_featured,
          categories(name_ar), cities(name_ar),
          ad_images(image_path, sort_order)
        `)
        .eq("status", "approved")
        .eq("listing_type", "sale")
        .eq("is_featured", featuredOnly)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        console.error("خطأ تحميل الإعلانات:", queryError);
        setError("تعذر تحميل الإعلانات. حاول مرة أخرى.");
        setLoading(false);
        return;
      }

      const formatted: Ad[] = await Promise.all(
        (data ?? []).map(async (ad: any) => {
          const sortedImages = (ad.ad_images ?? []).sort(
            (a: any, b: any) => a.sort_order - b.sort_order
          );
          const images = await Promise.all(
            sortedImages.map(async (image: any) => {
              const { data: imageData, error: imageError } = await supabase.storage
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
            currency: ad.currency ?? "",
            created_at: ad.created_at,
            category_name: ad.categories?.name_ar ?? "",
            city_name: ad.cities?.name_ar ?? "",
            images: images.filter(Boolean),
            is_featured: ad.is_featured ?? false,
          };
        })
      );

      if (active) {
        setAds(formatted);
        setLoading(false);
      }
    }

    loadAds();
    return () => {
      active = false;
    };
  }, [featuredOnly]);

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-7xl px-3 py-5 sm:px-5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
      >
        <ArrowRight size={18} />
        رجوع
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">
          {featuredOnly ? "الإعلانات المميزة" : "كل الإعلانات"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {featuredOnly ? "تصفح جميع الإعلانات المميزة المنشورة" : "تصفح جميع الإعلانات المنشورة للبيع"}
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">جاري تحميل الإعلانات...</div>
      ) : error ? (
        <div className="py-16 text-center text-red-600">{error}</div>
      ) : ads.length === 0 ? (
        <div className="py-16 text-center text-slate-500">لا توجد إعلانات حالياً.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ads.map((ad) => (
            <article
              key={ad.id}
              onClick={() => navigate(`/ad/${ad.id}`)}
              className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-36 overflow-hidden bg-slate-100 sm:h-44">
                {ad.images.length > 0 ? (
                  <img
                    src={ad.images[0]}
                    alt={ad.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <Car size={38} />
                  </div>
                )}
                {featuredOnly && (
                  <span className="absolute right-2 top-2 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">
                    ⭐ إعلان مميز
                  </span>
                )}
              </div>
              <div className="p-3">
                <h2 className="line-clamp-2 min-h-10 text-sm font-bold text-slate-800">
                  {ad.title}
                </h2>
                <p className="mt-2 font-extrabold text-emerald-700">
                  {ad.price == null ? "السعر عند التواصل" : `${ad.price.toLocaleString("en-US")} ${ad.currency}`}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <MapPin size={12} />
                    {ad.city_name || "غير محدد"}
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
    </main>
  );
}
