import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Store as StoreIcon, MapPin, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "./lib/supabase";

type Store = {
  id: string;
  name: string;
  business_type: string;
  description: string | null;
  governorate: string;
  city: string;
  logo_url: string | null;
  cover_url: string | null;
};

export default function Stores() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let active = true;
    async function loadStores() {
      setLoading(true);
      const { data, error } = await supabase
        .from("stores")
        .select("id,name,business_type,description,governorate,city,logo_url,cover_url")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) console.error("تعذر تحميل المتاجر:", error);
      if (active) {
        setStores((data ?? []) as Store[]);
        setLoading(false);
      }
    }
    loadStores();
    return () => { active = false; };
  }, []);

  const governorates = useMemo(() => [...new Set(stores.map(s => s.governorate).filter(Boolean))].sort(), [stores]);
  const cities = useMemo(() => [...new Set(stores.filter(s => !governorate || s.governorate === governorate).map(s => s.city).filter(Boolean))].sort(), [stores, governorate]);
  const filtered = useMemo(() => stores.filter(store => {
    const q = search.trim().toLowerCase();
    return (!q || `${store.name} ${store.business_type} ${store.description ?? ""}`.toLowerCase().includes(q))
      && (!governorate || store.governorate === governorate)
      && (!city || store.city === city);
  }), [stores, search, governorate, city]);

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700"><ArrowRight size={17}/> رجوع</button>
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">دليل المتاجر</h1>
            <p className="mt-1 text-sm text-slate-500">تصفح المتاجر والمنتجات المنشورة فيها</p>
          </div>
          <StoreIcon className="text-emerald-600" size={34}/>
        </div>

        <section className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن متجر أو نشاط..." className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 text-sm outline-none focus:border-emerald-500" />
          </div>
          <select value={governorate} onChange={e => { setGovernorate(e.target.value); setCity(""); }} className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500">
            <option value="">كل المحافظات</option>{governorates.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={city} onChange={e => setCity(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500">
            <option value="">كل المدن</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </section>

        {loading ? <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><RefreshCw className="animate-spin" size={18}/> جارٍ تحميل المتاجر...</div>
          : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">لا توجد متاجر مطابقة للبحث حالياً</div>
          : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(store => <button key={store.id} onClick={() => navigate(`/store/${store.id}`)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-32 bg-gradient-to-l from-emerald-100 to-slate-100" style={store.cover_url ? { backgroundImage: `url(${store.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}/>
                <div className="px-4 pb-4">
                  <div className="-mt-9 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow">
                    {store.logo_url ? <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover"/> : <StoreIcon size={28} className="text-emerald-600"/>}
                  </div>
                  <h2 className="text-lg font-black text-slate-900">{store.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">{store.business_type}</p>
                  {store.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{store.description}</p>}
                  <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin size={14}/>{[store.governorate, store.city].filter(Boolean).join(" - ")}</p>
                  <span className="mt-4 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">زيارة المتجر</span>
                </div>
              </button>)}
            </div>}
      </div>
    </main>
  );
}
