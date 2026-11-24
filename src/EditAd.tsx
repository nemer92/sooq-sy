
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  ArrowRight,
  MapPin,
  ImagePlus,
  Trash2,
  Save,
  LoaderCircle,
  Tag,
  Package,
  Wallet,
  MapPinned,
  CheckCircle2,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name_ar: string;
};

type Governorate = {
  id: string;
  name_ar: string;
};

type City = {
  id: string;
  governorate_id: string;
  name_ar: string;
};

type AdImage = {
  id: string;
  image_path: string;
  sort_order: number;
  url: string;
};

function EditAd() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [categoryId, setCategoryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [listingType, setListingType] = useState("sale");
  const [condition, setCondition] = useState("used");

  const [categories, setCategories] = useState<Category[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [images, setImages] = useState<AdImage[]>([]);
  const [removedImages, setRemovedImages] = useState<AdImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

  const selectedCities = cities.filter(
    (city) => city.governorate_id === governorateId
  );

  useEffect(() => {
    let cancelled = false;

    const loadAd = async () => {
      try {
        setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (!user) {
          navigate("/auth");
          return;
        }

        const { data: ad, error } = await supabase
          .from("ads")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .in("status", ["pending", "rejected", "approved"])
          .maybeSingle();

        if (error) throw error;

        if (!ad) {
          alert("الإعلان غير موجود أو لا يمكنك تعديله.");
          navigate("/my-ads");
          return;
        }

        if (cancelled) return;

        setTitle(ad.title || "");
        setDescription(ad.description || "");
        setPrice(ad.price != null ? String(ad.price) : "");
        setCurrency(ad.currency || "USD");
        setCategoryId(ad.category_id != null ? String(ad.category_id) : "");
        setCityId(ad.city_id != null ? String(ad.city_id) : "");
        setListingType(ad.listing_type || "sale");
        setCondition(ad.condition || "used");

        const [
          categoriesResult,
          governoratesResult,
          citiesResult,
          imagesResult,
        ] = await Promise.all([
          supabase
            .from("categories")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("id"),

          supabase
            .from("governorates")
            .select("id, name_ar")
            .eq("is_active", true)
            .order("name_ar"),

          supabase
            .from("cities")
            .select("id, governorate_id, name_ar")
            .eq("is_active", true)
            .order("name_ar"),

          supabase
            .from("ad_images")
            .select("id, image_path, sort_order")
            .eq("ad_id", id)
            .order("sort_order", { ascending: true }),
        ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (governoratesResult.error) throw governoratesResult.error;
        if (citiesResult.error) throw citiesResult.error;
        if (imagesResult.error) throw imagesResult.error;

        if (cancelled) return;

        const loadedCategories = (categoriesResult.data || []).map((item) => ({
          id: String(item.id),
          name_ar: item.name_ar,
        }));

        const loadedGovernorates = (
          governoratesResult.data || []
        ).map((item) => ({
          id: String(item.id),
          name_ar: item.name_ar,
        }));

        const loadedCities = (citiesResult.data || []).map((item) => ({
          id: String(item.id),
          governorate_id: String(item.governorate_id),
          name_ar: item.name_ar,
        }));

        setCategories(loadedCategories);
        setGovernorates(loadedGovernorates);
        setCities(loadedCities);

        // تحديد المحافظة التابعة للمدينة المحفوظة بالإعلان
        const currentCity = loadedCities.find(
          (city) => city.id === String(ad.city_id || "")
        );

        if (currentCity) {
          setGovernorateId(currentCity.governorate_id);
        }

        const imagesWithUrls = await Promise.all(
          (imagesResult.data || []).map(async (image) => {
            const { data, error } = await supabase.storage
              .from("ad-images")
              .createSignedUrl(image.image_path, 3600);

            if (error) {
              console.error("تعذر تحميل صورة الإعلان:", error);
            }

            return {
              ...image,
              url: data?.signedUrl || "",
            };
          })
        );

        if (cancelled) return;

        setImages(imagesWithUrls);
      } catch (error) {
        console.error("Error loading ad:", error);

        if (!cancelled) {
          alert("حدث خطأ أثناء تحميل الإعلان.");
          navigate("/my-ads");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAd();

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const handleSave = async () => {
    if (images.length + newImages.length > 3) {
      alert("الحد الأقصى المسموح به هو 3 صور للإعلان.");
      return;
    }

    if (title.trim().length < 5) {
      alert("عنوان الإعلان يجب أن يكون 5 أحرف على الأقل.");
      return;
    }

    if (description.trim().length < 10) {
      alert("وصف الإعلان يجب أن يكون 10 أحرف على الأقل.");
      return;
    }

    if (!categoryId) {
      alert("يرجى اختيار تصنيف الإعلان.");
      return;
    }

    if (!governorateId) {
      alert("يرجى اختيار المحافظة.");
      return;
    }

    if (!cityId || !selectedCities.some((city) => city.id === cityId)) {
      alert("يرجى اختيار مدينة تابعة للمحافظة المحددة.");
      return;
    }

    const finalPrice = price.trim() === "" ? 0 : Number(price);

    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      alert("يرجى إدخال سعر صحيح.");
      return;
    }

    try {
      setSaving(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate("/auth");
        return;
      }

      const { error: updateError } = await supabase.rpc("update_own_ad", {
        p_ad_id: id,
        p_title: title.trim(),
        p_description: description.trim(),
        p_price: finalPrice,
        p_currency: currency,
        p_category_id: categoryId,
        p_city_id: cityId,
        p_listing_type: listingType,
        p_condition: condition,
      });

      if (updateError) throw updateError;

      if (removedImages.length > 0) {
        const { error: deleteRecordsError } = await supabase
          .from("ad_images")
          .delete()
          .in(
            "id",
            removedImages.map((image) => image.id)
          )
          .eq("ad_id", id);

        if (deleteRecordsError) throw deleteRecordsError;

        const { error: deleteFilesError } = await supabase.storage
          .from("ad-images")
          .remove(removedImages.map((image) => image.image_path));

        if (deleteFilesError) throw deleteFilesError;
      }

      alert("تم حفظ التعديلات وإرسال الإعلان للمراجعة.");
      navigate("/my-ads");
    } catch (error) {
      console.error("Error updating ad:", error);
      alert("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      >
        <LoaderCircle className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-sm font-bold text-slate-500">
          جاري تحميل الإعلان...
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/my-ads")}
            className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-300 transition hover:text-white"
          >
            <ArrowRight size={18} />
            العودة إلى إعلاناتي
          </button>

          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-blue-300 ring-1 ring-white/15">
              <Package size={28} />
            </div>

            <div>
              <h1 className="text-2xl font-black text-white sm:text-3xl">
                تعديل الإعلان
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                حدّث معلومات إعلانك وموقعه وصوره بسهولة
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-2 max-w-4xl px-4 sm:px-6">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          {/* Basic information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Package size={20} />
              </div>

              <div>
                <h2 className="font-black text-slate-800">
                  المعلومات الأساسية
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  أدخل تفاصيل الإعلان بشكل واضح
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  عنوان الإعلان
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: هاتف سامسونج بحالة ممتازة"
                  className={inputClass}
                  maxLength={150}
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  {title.length} حرف
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  وصف الإعلان
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="اكتب تفاصيل المنتج ومواصفاته وحالته..."
                  className={`${inputClass} resize-y`}
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  اكتب وصفاً واضحاً يساعد المشتري على معرفة تفاصيل المنتج.
                </p>
              </div>
            </div>
          </section>

          {/* Images */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ImagePlus size={20} />
                </div>

                <div>
                  <h2 className="font-black text-slate-800">
                    صور الإعلان
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    يمكنك الاحتفاظ بالصور أو حذفها
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                {images.length + newImages.length} / 3
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  {image.url ? (
                    <img
                      src={image.url}
                      alt="صورة الإعلان"
                      className="h-36 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center text-slate-400">
                      <ImagePlus size={30} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setRemovedImages((previous) => [
                        ...previous,
                        image,
                      ]);

                      setImages((previous) =>
                        previous.filter((item) => item.id !== image.id)
                      );
                    }}
                    className="flex w-full items-center justify-center gap-2 bg-red-50 p-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                    حذف الصورة
                  </button>
                </div>
              ))}

              {newImagePreviews.map((preview, index) => (
                <div
                  key={preview}
                  className="overflow-hidden rounded-xl border-2 border-blue-300 bg-blue-50"
                >
                  <img
                    src={preview}
                    alt="صورة جديدة"
                    className="h-36 w-full object-cover"
                  />

                  <div className="flex items-center justify-center gap-1 p-2 text-xs font-bold text-blue-700">
                    <CheckCircle2 size={14} />
                    صورة جديدة
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(preview);

                      setNewImagePreviews((previous) =>
                        previous.filter((_, i) => i !== index)
                      );

                      setNewImages((previous) =>
                        previous.filter((_, i) => i !== index)
                      );
                    }}
                    className="flex w-full items-center justify-center gap-2 bg-red-50 p-2.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    <X size={14} />
                    إزالة الصورة
                  </button>
                </div>
              ))}
            </div>

            {images.length === 0 && newImages.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                <ImagePlus className="mx-auto mb-2 text-slate-400" size={30} />
                <p className="text-sm font-bold text-slate-500">
                  لا توجد صور مضافة حالياً
                </p>
              </div>
            )}

            <div className="mt-5">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                إضافة صور جديدة
              </label>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50">
                <ImagePlus className="mb-2 text-blue-600" size={28} />

                <span className="text-sm font-bold text-blue-700">
                  اضغط لاختيار الصور
                </span>

                <span className="mt-1 text-xs text-slate-500">
                  JPG أو PNG أو WEBP — الحد الأقصى 5 ميغابايت للصورة
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);

                    const remainingSlots =
                      3 - images.length - newImages.length;

                    if (remainingSlots <= 0) {
                      alert("وصلت للحد الأقصى، وهو 3 صور للإعلان.");
                      e.target.value = "";
                      return;
                    }

                    if (files.length > remainingSlots) {
                      alert(`يمكنك إضافة ${remainingSlots} صورة فقط.`);
                      e.target.value = "";
                      return;
                    }

                    const validFiles = files.filter((file) => {
                      const validType = [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                      ].includes(file.type);

                      if (!validType) {
                        alert("يسمح فقط بصور JPG وPNG وWEBP.");
                        return false;
                      }

                      if (file.size > 5 * 1024 * 1024) {
                        alert("حجم كل صورة يجب ألا يتجاوز 5 ميغابايت.");
                        return false;
                      }

                      return true;
                    });

                    setNewImages((previous) => [
                      ...previous,
                      ...validFiles,
                    ]);

                    setNewImagePreviews((previous) => [
                      ...previous,
                      ...validFiles.map((file) =>
                        URL.createObjectURL(file)
                      ),
                    ]);

                    e.target.value = "";
                  }}
                />
              </label>

              {newImages.length > 0 && (
                <p className="mt-2 text-xs font-bold text-blue-600">
                  تم اختيار {newImages.length} صور جديدة.
                </p>
              )}
            </div>
          </section>

          {/* Price and category */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet size={20} />
              </div>

              <div>
                <h2 className="font-black text-slate-800">
                  السعر والتصنيف
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  حدد سعر المنتج والتصنيف المناسب
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  السعر
                </label>

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="أدخل السعر"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  العملة
                </label>

                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClass}
                >
                  <option value="USD">دولار أمريكي</option>
                  <option value="SYP">ليرة سورية</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Tag size={16} className="text-slate-400" />
                  التصنيف
                </label>

                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">اختر التصنيف</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_ar}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <MapPinned size={20} />
              </div>

              <div>
                <h2 className="font-black text-slate-800">
                  موقع الإعلان
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  اختر المحافظة أولاً ثم المدينة التابعة لها
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MapPin size={16} className="text-orange-500" />
                  المحافظة
                </label>

                <select
                  value={governorateId}
                  onChange={(e) => {
                    setGovernorateId(e.target.value);
                    setCityId("");
                  }}
                  className={inputClass}
                >
                  <option value="">اختر المحافظة</option>

                  {governorates.map((governorate) => (
                    <option
                      key={governorate.id}
                      value={governorate.id}
                    >
                      {governorate.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MapPin size={16} className="text-blue-500" />
                  المدينة
                </label>

                <select
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  disabled={!governorateId}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">
                    {governorateId
                      ? "اختر المدينة"
                      : "اختر المحافظة أولاً"}
                  </option>

                  {selectedCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name_ar}
                    </option>
                  ))}
                </select>

                {governorateId && selectedCities.length === 0 && (
                  <p className="mt-2 text-xs text-orange-600">
                    لا توجد مدن مفعّلة لهذه المحافظة حالياً.
                  </p>
                )}
              </div>
            </div>

            {governorateId && cityId && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={16} />
                تم تحديد موقع الإعلان بنجاح.
              </div>
            )}
          </section>

          {/* Listing details */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <Tag size={20} />
              </div>

              <div>
                <h2 className="font-black text-slate-800">
                  تفاصيل العرض
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  حدد نوع الإعلان وحالة المنتج
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  نوع الإعلان
                </label>

                <select
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className={inputClass}
                >
                  <option value="sale">بيع</option>
                  <option value="donation">تبرع</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  حالة المنتج
                </label>

                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className={inputClass}
                >
                  <option value="new">جديد</option>
                  <option value="used">مستعمل</option>
                </select>
              </div>
            </div>
          </section>

          {/* Save */}
          <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-md sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/my-ads")}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:w-1/3"
              >
                <ArrowRight size={17} />
                إلغاء
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <LoaderCircle size={19} className="animate-spin" />
                    جاري حفظ التعديلات...
                  </>
                ) : (
                  <>
                    <Save size={19} />
                    حفظ التعديلات
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAd;
