
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { Heart, MapPin, Car, ArrowRight } from "lucide-react";

type FavoriteAd = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  condition: string;
  city_name: string;
  created_at: string;
  images: string[];
};

export default function Favorites() {
  const navigate = useNavigate();
  const [ads, setAds] = useState<FavoriteAd[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/auth");
          return;
        }

        const { data: favorites, error: favoritesError } =
          await supabase
            .from("favorites")
            .select("ad_id")
            .eq("user_id", user.id);

        if (favoritesError) throw favoritesError;

        const adIds = (favorites ?? []).map((item) => item.ad_id);

        if (adIds.length === 0) {
          setAds([]);
          return;
        }

        const { data, error } = await supabase
          .from("ads")
          .select(`
            id,
            title,
            price,
            currency,
            condition,
            created_at,
            cities(name_ar),
            ad_images(image_path, sort_order)
          `)
          .in("id", adIds)
          .eq("status", "approved")
          .eq("listing_type", "sale")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formattedAds: FavoriteAd[] = await Promise.all(
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
              price: ad.price,
              currency: ad.currency,
              condition: ad.condition,
              city_name: ad.cities?.name_ar ?? "",
              created_at: ad.created_at,
              images: signedImages.filter(Boolean),
            };
          })
        );

        setAds(formattedAds);
      } catch (error) {
        console.error("خطأ تحميل المفضلة:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, [navigate]);

  async function removeFavorite(adId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("ad_id", adId);

      if (error) throw error;

      setAds((prev) => prev.filter((ad) => ad.id !== adId));
    } catch (error) {
      console.error("خطأ إزالة الإعلان من المفضلة:", error);
      alert("تعذر إزالة الإعلان من المفضلة");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-800">
            <Heart className="text-rose-500" fill="currentColor" />
            إعلاناتي المفضلة
          </h1>

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm font-bold text-emerald-700"
          >
            <ArrowRight size={18} />
            الرئيسية
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="py-16 text-center text-slate-500">
            جارٍ تحميل المفضلة...
          </p>
        ) : ads.length === 0 ? (
          <div className="rounded-2xl bg-white px-4 py-16 text-center">
            <Heart size={48} className="mx-auto mb-4 text-rose-300" />
            <h2 className="text-lg font-bold text-slate-700">
              لا توجد إعلانات في المفضلة
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              اضغط على قلب أي إعلان لحفظه هنا.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white"
            >
              تصفح الإعلانات
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ads.map((ad) => (
              <article
                key={ad.id}
                onClick={() => navigate(`/ad/${ad.id}`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-52 overflow-hidden bg-slate-100">
                  {ad.images.length > 0 ? (
                    <img
                      src={ad.images[0]}
                      alt={ad.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Car size={48} />
                    </div>
                  )}

                  <span className="absolute right-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-700">
                    {ad.condition === "used"
                      ? "مستعمل"
                      : ad.condition === "new"
                        ? "جديد"
                        : ad.condition}
                  </span>

                  <button
                    type="button"
                    aria-label="إزالة من المفضلة"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(ad.id);
                    }}
                    className="absolute left-3 top-3 rounded-full bg-white/90 p-2 text-red-500 hover:bg-red-50"
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="line-clamp-2 min-h-12 font-bold leading-6 text-slate-800">
                    {ad.title}
                  </h3>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-xl font-black text-emerald-700">
                      {ad.price?.toLocaleString("en-US") ?? "السعر عند التواصل"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {ad.currency === "USD"
                        ? "دولار"
                        : ad.currency === "SYP"
                          ? "ليرة سورية"
                          : ad.currency}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {ad.city_name}
                    </span>
                    <span>
                      {new Date(ad.created_at).toLocaleDateString("ar-SY")}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
