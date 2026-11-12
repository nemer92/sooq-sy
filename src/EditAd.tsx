import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "./lib/supabase";

type Category = {
  id: string;
  name_ar: string;

};

type City = {
  id: string;
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
  const [cityId, setCityId] = useState("");
  const [listingType, setListingType] = useState("sale");
  const [condition, setCondition] = useState("used");

  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [images, setImages] = useState<AdImage[]>([]);
  const [removedImages, setRemovedImages] = useState<AdImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  useEffect(() => {
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

      setTitle(ad.title || "");
      setDescription(ad.description || "");
      setPrice(ad.price != null ? String(ad.price) : "");
      setCurrency(ad.currency || "USD");
      setCategoryId(ad.category_id || "");
      setCityId(ad.city_id || "");
      setListingType(ad.listing_type || "sale");
      setCondition(ad.condition || "used");

      const { data: categoriesData, error: categoriesError } =
        await supabase
          .from("categories")
          .select("id, name_ar")
          .eq("is_active", true)
          .order("id");

      if (categoriesError) throw categoriesError;

      const { data: citiesData, error: citiesError } =
        await supabase
          .from("cities")
          .select("id, name_ar")
          .eq("is_active", true)
          .order("id");

      if (citiesError) throw citiesError;

      setCategories(categoriesData || []);
      setCities(citiesData || []);
      const { data: imagesData, error: imagesError } = await supabase
  .from("ad_images")
  .select("id, image_path, sort_order")
  .eq("ad_id", id)
  .order("sort_order", { ascending: true });

if (imagesError) throw imagesError;

const imagesWithUrls = await Promise.all(
  (imagesData || []).map(async (image) => {
    const { data } = await supabase.storage
      .from("ad-images")
      .createSignedUrl(image.image_path, 3600);

    return {
      ...image,
      url: data?.signedUrl || "",
    };
  })
);

setImages(imagesWithUrls);

    } catch (error) {
      console.error("Error loading ad:", error);
      alert("حدث خطأ أثناء تحميل الإعلان.");
      navigate("/my-ads");
    } finally {
      setLoading(false);
    }
  };

  loadAd();
}, [id, navigate]);

const handleSave = async () => {
  if (title.trim().length < 5) {
    alert("عنوان الإعلان يجب أن يكون 5 أحرف على الأقل.");
    return;
  }

  if (description.trim().length < 10) {
    alert("وصف الإعلان يجب أن يكون 10 أحرف على الأقل.");
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

    if (newImages.length > 0) {
  const uploadedImages = [];

  for (let i = 0; i < newImages.length; i++) {
    const file = newImages[i];

    const extension = file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : "webp";

    const imagePath = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("ad-images")
      .upload(imagePath, file);

    if (uploadError) throw uploadError;

    uploadedImages.push({
      ad_id: id,
      image_path: imagePath,
      sort_order: images.length + i,
    });
  }

  const { error: insertError } = await supabase
    .from("ad_images")
    .insert(uploadedImages);

  if (insertError) throw insertError;
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
  return <div className="p-6 text-center">جاري تحميل الإعلان...</div>;
}

return (
  <div className="max-w-3xl mx-auto p-6" dir="rtl">
    <h1 className="text-2xl font-bold mb-6">تعديل الإعلان</h1>

    <form className="space-y-5">

      <div>
        <label className="block mb-2 font-medium">عنوان الإعلان</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
      </div>

<div>
  <label className="block mb-2 font-medium">الصور الحالية</label>

  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
{images.map((image) => (
  <div key={image.id} className="rounded-xl overflow-hidden border">
    <img
      src={image.url}
      alt="صورة الإعلان"
      className="w-full h-32 object-cover"
    />

    <button
      type="button"
      onClick={() => {
        setRemovedImages((previous) => [...previous, image]);
        setImages((previous) =>
          previous.filter((item) => item.id !== image.id)
        );
      }}
      className="w-full bg-red-50 text-red-600 text-sm font-bold p-2 hover:bg-red-100"
    >
      حذف الصورة
    </button>
  </div>
))}
{newImagePreviews.map((preview, index) => (
  <div
    key={`new-${index}`}
    className="rounded-xl overflow-hidden border-2 border-blue-400"
  >
    <img
      src={preview}
      alt="صورة جديدة"
      className="w-full h-32 object-cover"
    />

    <p className="text-center text-xs text-blue-600 p-2">
      صورة جديدة
    </p>

    <button
      type="button"
      onClick={() => {
        URL.revokeObjectURL(newImagePreviews[index]);

        setNewImagePreviews((previous) =>
          previous.filter((_, i) => i !== index)
        );

        setNewImages((previous) =>
          previous.filter((_, i) => i !== index)
        );
      }}
      className="w-full bg-red-50 text-red-600 text-sm font-bold p-2 hover:bg-red-100"
    >
      إزالة الصورة
    </button>
  </div>
))}
  </div>

  {images.length === 0 && (
    <p className="text-sm text-gray-500">لا توجد صور لهذا الإعلان.</p>
  )}
  <div className="mt-4">
  <label className="block mb-2 font-medium">
    إضافة صور جديدة
  </label>

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    onChange={(e) => {
      const files = Array.from(e.target.files || []);

      if (images.length + newImages.length + files.length > 10) {
        alert("الحد الأقصى هو 10 صور للإعلان.");
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

      setNewImages((previous) => [...previous, ...validFiles]);
      setNewImagePreviews((previous) => [
  ...previous,
  ...validFiles.map((file) => URL.createObjectURL(file)),
]);
      e.target.value = "";
    }}
    className="w-full border rounded-lg p-3"
  />

  {newImages.length > 0 && (
    <p className="mt-2 text-sm text-blue-600">
      تم اختيار {newImages.length} صور جديدة.
    </p>
  )}
</div>
</div>

      <div>
        <label className="block mb-2 font-medium">وصف الإعلان</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full border rounded-lg p-3"
        />
      </div>

      <div>
        <label className="block mb-2 font-medium">السعر</label>
        <input
          type="number"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
      </div>

      <div>
        <label className="block mb-2 font-medium">العملة</label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full border rounded-lg p-3"
        >
          <option value="USD">دولار أمريكي</option>
          <option value="SYP">ليرة سورية</option>
        </select>
      </div>

      <div>
        <label className="block mb-2 font-medium">التصنيف</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border rounded-lg p-3"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name_ar}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-2 font-medium">المدينة</label>
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="w-full border rounded-lg p-3"
        >
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name_ar}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-2 font-medium">نوع الإعلان</label>
        <select
          value={listingType}
          onChange={(e) => setListingType(e.target.value)}
          className="w-full border rounded-lg p-3"
        >
          <option value="sale">بيع</option>
          <option value="donation">تبرع</option>
        </select>
      </div>

      <div>
        <label className="block mb-2 font-medium">حالة المنتج</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="w-full border rounded-lg p-3"
        >
          <option value="new">جديد</option>
          <option value="used">مستعمل</option>
        </select>
      </div>

<button
  type="button"
  onClick={handleSave}
  disabled={saving}
  className="w-full bg-blue-600 text-white rounded-lg p-3 font-bold disabled:opacity-50"
>
  {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
</button>

    </form>
  </div>
);
}

export default EditAd;