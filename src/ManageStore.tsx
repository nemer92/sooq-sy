
import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Save,
  Store,
  LoaderCircle,
  ImagePlus,
  Eye,
} from "lucide-react";
import { supabase } from "./lib/supabase";

type StoreForm = {
  name: string;
  business_type: string;
  description: string;
  governorate: string;
  city: string;
  phone: string;
  whatsapp: string;
  logo_url: string;
  cover_url: string;
  status: string;
};

export default function ManageStore() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");

  const [store, setStore] = useState<StoreForm>({
    name: "",
    business_type: "",
    description: "",
    governorate: "",
    city: "",
    phone: "",
    whatsapp: "",
    logo_url: "",
    cover_url: "",
    status: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStore() {
      setLoading(true);
      setError("");

      try {
        if (!id) throw new Error("معرّف المتجر غير صحيح.");

        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {
          navigate("/auth", {
            state: { from: `/manage-store/${id}` },
          });
          return;
        }

        if (mounted) setUserId(authData.user.id);

        const { data, error: storeError } = await supabase
          .from("stores")
          .select(
            "id,owner_id,name,business_type,description,governorate,city,phone,whatsapp,logo_url,cover_url,status"
          )
          .eq("id", id)
          .eq("owner_id", authData.user.id)
          .single();

        if (storeError) throw storeError;

        if (mounted) {
          setStore({
            name: data.name ?? "",
            business_type: data.business_type ?? "",
            description: data.description ?? "",
            governorate: data.governorate ?? "",
            city: data.city ?? "",
            phone: data.phone ?? "",
            whatsapp: data.whatsapp ?? "",
            logo_url: data.logo_url ?? "",
            cover_url: data.cover_url ?? "",
            status: data.status ?? "",
          });

          setLogoPreview(data.logo_url ?? "");
          setCoverPreview(data.cover_url ?? "");
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "تعذر تحميل بيانات المتجر."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadStore();

    return () => {
      mounted = false;
    };
  }, [id, navigate]);

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة يجب ألا يتجاوز 5 ميغابايت.");
      event.target.value = "";
      return;
    }

    setError("");
    setMessage("");

    const preview = URL.createObjectURL(file);

    if (type === "logo") {
      setLogoFile(file);
      setLogoPreview(preview);
    } else {
      setCoverFile(file);
      setCoverPreview(preview);
    }
  }

  async function uploadImage(
    file: File,
    kind: "logo" | "cover"
  ): Promise<string> {
    if (!userId || !id) {
      throw new Error("تعذر تحديد المستخدم أو المتجر.");
    }

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath =
      `stores/${userId}/${id}/${kind}-${crypto.randomUUID()}.${extension}`;

const { error: uploadError } = await supabase.storage
  .from("store-images")
  .upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });

if (uploadError) throw uploadError;

console.log("Store image upload path:", filePath);
console.log("Current user ID:", userId);

const { data } = supabase.storage
  .from("store-images")
  .getPublicUrl(filePath);

if (!data.publicUrl) {
  throw new Error("تم رفع الصورة لكن تعذر إنشاء رابطها.");
}

    return data.publicUrl;
  }

  async function saveStore() {
    setError("");
    setMessage("");

    if (!store.name.trim()) {
      setError("يرجى إدخال اسم المتجر.");
      return;
    }

    if (!store.governorate.trim() || !store.city.trim()) {
      setError("يرجى إدخال المحافظة والمدينة.");
      return;
    }

    if (!store.phone.trim()) {
      setError("يرجى إدخال رقم هاتف المتجر.");
      return;
    }

    if (!userId || !id) {
      setError("تعذر تحديد المتجر أو المستخدم.");
      return;
    }

    setSaving(true);

    try {
      let logoUrl = store.logo_url;
      let coverUrl = store.cover_url;

      if (logoFile) {
        logoUrl = await uploadImage(logoFile, "logo");
      }

      if (coverFile) {
        coverUrl = await uploadImage(coverFile, "cover");
      }

      const { data: updatedStore, error: updateError } =
        await supabase
          .from("stores")
          .update({
            name: store.name.trim(),
            business_type: store.business_type.trim() || null,
            description: store.description.trim() || null,
            governorate: store.governorate.trim(),
            city: store.city.trim(),
            phone: store.phone.trim(),
            whatsapp: store.whatsapp.trim() || null,
            logo_url: logoUrl || null,
            cover_url: coverUrl || null,
          })
          .eq("id", id)
          .eq("owner_id", userId)
          .select("id,logo_url,cover_url")
          .single();

      if (updateError) throw updateError;

      if (!updatedStore) {
        throw new Error("لم يتم العثور على المتجر بعد التحديث.");
      }

      const savedLogoUrl = updatedStore.logo_url ?? "";
      const savedCoverUrl = updatedStore.cover_url ?? "";

      setStore((current) => ({
        ...current,
        logo_url: savedLogoUrl,
        cover_url: savedCoverUrl,
      }));

      setLogoPreview(savedLogoUrl);
      setCoverPreview(savedCoverUrl);

      setLogoFile(null);
      setCoverFile(null);

      setMessage("تم حفظ تعديلات المتجر والصور بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر حفظ تعديلات المتجر."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof StoreForm>(
    field: K,
    value: StoreForm[K]
  ) {
    setStore((current) => ({ ...current, [field]: value }));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <LoaderCircle className="animate-spin" size={24} />
        جارٍ تحميل بيانات المتجر...
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-7">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/my-stores")}
          className="mb-5 inline-flex items-center gap-2 font-bold text-slate-600 hover:text-emerald-700"
        >
          <ArrowRight size={19} />
          العودة إلى متاجري
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Store size={25} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              تعديل بيانات المتجر
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              حدّث معلومات متجرك ليظهر للعملاء بالشكل المناسب.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-black text-slate-800">
              صور المتجر
            </h2>

            <label className="mb-2 block text-sm font-bold text-slate-600">
              صورة الغلاف
            </label>

            <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="غلاف المتجر"
                  className="h-full w-full object-cover"
                  onError={() => {
                    setCoverPreview("");
                    setError(
                      "تعذر عرض صورة الغلاف. تأكد أن bucket ad-images مضبوط كـ Public."
                    );
                  }}
                />
              ) : (
                <ImagePlus className="text-slate-400" size={35} />
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event, "cover")}
              className="mb-6 block w-full text-sm text-slate-600 file:ml-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-bold file:text-emerald-700"
            />

            <label className="mb-2 block text-sm font-bold text-slate-600">
              شعار المتجر
            </label>

            <div className="mb-3 flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="شعار المتجر"
                  className="h-full w-full object-cover"
                  onError={() => {
                    setLogoPreview("");
                    setError(
                      "تعذر عرض شعار المتجر. تأكد أن bucket ad-images مضبوط كـ Public."
                    );
                  }}
                />
              ) : (
                <Store className="text-slate-400" size={32} />
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event, "logo")}
              className="block w-full text-sm text-slate-600 file:ml-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-bold file:text-emerald-700"
            />

            <p className="mt-2 text-xs text-slate-400">
              الحد الأقصى لكل صورة 5 ميغابايت.
            </p>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-800">
              المعلومات الأساسية
            </h2>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                اسم المتجر *
              </label>
              <input
                value={store.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                نوع النشاط التجاري
              </label>
              <input
                value={store.business_type}
                onChange={(event) =>
                  updateField("business_type", event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                placeholder="مثلاً: ألبسة، إلكترونيات، مواد غذائية"
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-600">
                وصف المتجر
              </label>
              <textarea
                value={store.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={4}
                maxLength={1500}
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                placeholder="اكتب نبذة عن متجرك والمنتجات التي تقدمها..."
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-800">
              الموقع والتواصل
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  المحافظة *
                </label>
                <input
                  value={store.governorate}
                  onChange={(event) =>
                    updateField("governorate", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  المدينة *
                </label>
                <input
                  value={store.city}
                  onChange={(event) =>
                    updateField("city", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={store.phone}
                  onChange={(event) =>
                    updateField("phone", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  رقم واتساب
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={store.whatsapp}
                  onChange={(event) =>
                    updateField("whatsapp", event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveStore}
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={19} />
              ) : (
                <Save size={19} />
              )}
              {saving ? "جارٍ حفظ التعديلات..." : "حفظ التعديلات"}
            </button>

            {store.status === "active" && (
              <>
                <button
                  type="button"
                  onClick={() => navigate(`/store/${id}`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={19} />
                  عرض المتجر
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/add-ad?store_id=${id}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700"
                >
                  إضافة منتج للمتجر
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
