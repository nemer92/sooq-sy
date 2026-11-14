import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  UserRound,
  Plus,
  Menu,
  Car,
  Smartphone,
  Home as HomeIcon,
  BriefcaseBusiness,
  Sofa,
  Shirt,
  Wrench,
  PawPrint,
  LogOut,
    Heart,
  Bell,
} from "lucide-react";

type Category = {
  id: number;
  name_ar: string;
  icon: string | null;
  parent_id: number | null;
  sort_order: number;
  is_active: boolean;
};
type City = {
  id: number;
  name_ar: string;
  governorate_id: number;
};

type Governorate = {
  id: number;
  name_ar: string;
};
const categoryIconMap = {
  "سيارات ومركبات": Car,
  "عقارات": HomeIcon,
  "إلكترونيات": Smartphone,
  "موبايلات وأجهزة لوحية": Smartphone,
  "أثاث ومفروشات": Sofa,
  "أجهزة منزلية": Wrench,
  "ملابس وأزياء": Shirt,
  "وظائف": BriefcaseBusiness,
  "خدمات ومهن": Wrench,
  "حيوانات": PawPrint,
  "معدات وأدوات": Wrench,
  "دراجات": Car,
  "أراضٍ ومزارع": HomeIcon,
  "متفرقات": Menu,
};

type Ad = {
  id: string;
  category_id: number;
  city_id: number | null;
  title: string;
  description: string;
  price: number | null;
  currency: string;
  listing_type: "sale" | "donation";
  condition: string;
  city_name: string;
  category_name: string;
  created_at: string;
  images: string[];
  is_featured?: boolean;
};

export default function Home() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [selectedGovernorate, setSelectedGovernorate] = useState("");
    const [, setCitiesLoading] = useState(true);
    const [ads, setAds] = useState<Ad[]>([]);
    const [featuredAds, setFeaturedAds] = useState<Ad[]>([]);
    const [featuredAdsLoading, setFeaturedAdsLoading] = useState(true);
    const [donations, setDonations] = useState<Ad[]>([]);
    const [donationsLoading, setDonationsLoading] = useState(true);
    const [favoriteAdIds, setFavoriteAdIds] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
const loadNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_notifications")
    .select(`
      id,
      notification_id,
      read_at,
      created_at,
      notifications (
        title,
        body,
        link
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading notifications:", error);
    return;
  }

  setNotifications(data || []);
  setUnreadNotificationsCount(
    (data || []).filter((item: any) => !item.read_at).length
  );
};

const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    console.error("Error marking notification as read:", error);
    return;
  }

  setNotifications((prev) =>
    prev.map((item) =>
      item.id === notificationId && !item.read_at
        ? { ...item, read_at: new Date().toISOString() }
        : item
    )
  );

  setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
};
async function toggleFavorite(adId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("سجّل الدخول أولاً لاستخدام المفضلة");
      return;
    }

    if (favoriteAdIds.includes(adId)) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("ad_id", adId);

      if (error) throw error;

      setFavoriteAdIds((prev) => prev.filter((id) => id !== adId));
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, ad_id: adId });

      if (error) throw error;

      setFavoriteAdIds((prev) => [...prev, adId]);
    }
  } catch (error) {
    console.error("خطأ في المفضلة:", error);
    alert("تعذر تحديث المفضلة");
  }
}
const [adsLoading, setAdsLoading] = useState(true);
const [, setCategoriesLoading] = useState(true);
const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
const [selectedSubCategory, setSelectedSubCategory] = useState<number | null>(null);
const [searchQuery, setSearchQuery] = useState("");
const [selectedCity, setSelectedCity] = useState("");
const [siteName, setSiteName] = useState("Sooq.Sy");
const [logoUrl, setLogoUrl] = useState("");
const [heroImageUrl, setHeroImageUrl] = useState("");
const [contactEmail, setContactEmail] = useState("");
const [contactPhone, setContactPhone] = useState("");
const [allowNewAds, setAllowNewAds] = useState(true);
const [isLoggedIn, setIsLoggedIn] = useState(false);
const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
const [messageNotification, setMessageNotification] = useState<{
  conversationId: string;
  senderName: string;
  message: string;
} | null>(null);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


useEffect(() => {
  async function checkLogin() {
    const { data } = await supabase.auth.getSession();
    setIsLoggedIn(!!data.session);
  }

  checkLogin();

  const {
    data: { subscription },
} = supabase.auth.onAuthStateChange((_event, session) => {
  setIsLoggedIn(!!session);

  if (session?.user) {
    setTimeout(() => {
  loadNotifications(session.user.id);
}, 0);
  } else {
    setNotifications([]);
    setUnreadNotificationsCount(0);
  }
});

return () => subscription.unsubscribe();
}, []);
useEffect(() => {
  async function loadSiteSettings() {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, logo_url, hero_image_url, contact_email, contact_phone, allow_new_ads")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("خطأ تحميل إعدادات الموقع:", error);
      return;
    }

    setSiteName(data.site_name || "Sooq.Sy");
    setLogoUrl(data.logo_url || "");
    setHeroImageUrl(data.hero_image_url || "");
    setContactEmail(data.contact_email || "");
    setContactPhone(data.contact_phone || "");
    setAllowNewAds(data.allow_new_ads ?? true);
  }

  loadSiteSettings();
}, []);useEffect(() => {
  async function loadSiteSettings() {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name, logo_url")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("خطأ تحميل إعدادات الموقع:", error);
      return;
    }

    setSiteName(data.site_name || "Sooq.Sy");
    setLogoUrl(data.logo_url || "");
  }

  loadSiteSettings();
}, []);

useEffect(() => {
  let channel: ReturnType<typeof supabase.channel> | null = null;

  async function loadUnreadMessagesCount() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }

const { data: conversations, error: conversationsError } = await supabase
  .from("conversations")
  .select("id")
  .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

if (conversationsError) {
  console.error("خطأ تحميل المحادثات:", conversationsError);
  return;
}

const conversationIds = (conversations ?? []).map((item) => item.id);

if (conversationIds.length === 0) {
  setUnreadMessagesCount(0);
  return;
}

const { count, error } = await supabase
  .from("messages")
  .select("id", { count: "exact", head: true })
  .in("conversation_id", conversationIds)
  .eq("is_read", false)
  .neq("sender_id", user.id);

if (error) {
  console.error("خطأ تحميل عدد الرسائل غير المقروءة:", error);
  return;
}

setUnreadMessagesCount(count ?? 0);
  }

  loadUnreadMessagesCount();

  channel = supabase
    .channel("home-unread-messages")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
            async (payload) => {
              
        loadUnreadMessagesCount();

        if (payload.eventType !== "INSERT") return;

        const newMessage = payload.new as {
          conversation_id: string;
          sender_id: string;
          body: string;
        };

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || newMessage.sender_id === user.id) return;

        const { data: conversation, error: conversationError } =
          await supabase
            .from("conversations")
            .select("buyer_id, seller_id")
            .eq("id", newMessage.conversation_id)
            .single();

        if (conversationError || !conversation) {
  console.log("تعذر جلب المحادثة:", conversationError);
  return;
}



        const isRecipient =
          conversation.buyer_id === user.id ||
          conversation.seller_id === user.id;

        if (!isRecipient) return;

        const { data: sender } = await supabase
        
          .from("profiles")
          .select("display_name")
          .eq("id", newMessage.sender_id)
          .maybeSingle();
         



        setMessageNotification({
          conversationId: newMessage.conversation_id,
          senderName: sender?.display_name || "مستخدم",
          message: newMessage.body,
        });
       
      }
    )
    .subscribe();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(() => {
    loadUnreadMessagesCount();
  });

  return () => {
    subscription.unsubscribe();

    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}, []);

useEffect(() => {
  async function loadAds() {
    const { data, error } = await supabase
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
      .eq("listing_type", "sale")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("خطأ تحميل الإعلانات:", error);
    } else {
      const formattedAds: Ad[] = await Promise.all(
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

              if (imageError) {
                console.error("خطأ تحميل الصورة:", imageError);
                return "";
              }

              return imageData.signedUrl;
            })
          );

          return {
            id: ad.id,
            city_id: ad.city_id,
            title: ad.title,
            category_id: ad.category_id,
            description: ad.description,
            price: ad.price,
            currency: ad.currency,
            listing_type: ad.listing_type,
            condition: ad.condition,
            created_at: ad.created_at,
            is_featured: ad.is_featured ?? false,
            category_name: ad.categories?.name_ar ?? "",
            city_name: ad.cities?.name_ar ?? "",
            images: signedImages.filter(Boolean),
          };
        })
      );

      setAds(formattedAds);
      const { data: { user } } = await supabase.auth.getUser();

if (user) {
  const { data: favorites, error: favoritesError } = await supabase
    .from("favorites")
    .select("ad_id")
    .eq("user_id", user.id);

  if (favoritesError) {
    console.error("خطأ تحميل المفضلة:", favoritesError);
  } else {
    setFavoriteAdIds((favorites ?? []).map((item) => item.ad_id));
  }
} else {
  setFavoriteAdIds([]);
}

    }

    setAdsLoading(false);
  }

  loadAds();
}, []);
useEffect(() => {
  async function loadFeaturedAds() {
    const { data, error } = await supabase
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
      .eq("listing_type", "sale")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(6);

if (error) {
  console.error("خطأ تحميل الإعلانات المميزة:", error);
  setFeaturedAdsLoading(false);
  return;
}

    const formattedAds: Ad[] = await Promise.all(
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

            if (imageError) {
              console.error("خطأ تحميل صورة الإعلان المميز:", imageError);
              return "";
            }

            return imageData.signedUrl;
          })
        );

        return {
          id: ad.id,
          city_id: ad.city_id,
          title: ad.title,
          category_id: ad.category_id,
          description: ad.description,
          price: ad.price,
          currency: ad.currency,
          listing_type: ad.listing_type,
          condition: ad.condition,
          created_at: ad.created_at,
          is_featured: true,
          category_name: ad.categories?.name_ar ?? "",
          city_name: ad.cities?.name_ar ?? "",
          images: signedImages.filter(Boolean),
        };
      })
    );

    setFeaturedAds(formattedAds);
    setFeaturedAdsLoading(false);
  }

  loadFeaturedAds();
}, []);
useEffect(() => {
  async function loadDonations() {
    const { data, error } = await supabase
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
        categories(name_ar),
        cities(name_ar),
        ad_images(image_path, sort_order)
      `)
      .eq("status", "approved")
      .eq("listing_type", "donation")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("خطأ تحميل التبرعات:", error);
      setDonationsLoading(false);
      return;
    }

    const formattedDonations: Ad[] = await Promise.all(
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

            if (imageError) {
              console.error("خطأ تحميل صورة التبرع:", imageError);
              return "";
            }

            return imageData.signedUrl;
          })
        );

        return {
          id: ad.id,
          city_id: ad.city_id,
          title: ad.title,
          category_id: ad.category_id,
          description: ad.description,
          price: ad.price,
          currency: ad.currency,
          listing_type: ad.listing_type,
          condition: ad.condition,
          created_at: ad.created_at,
          category_name: ad.categories?.name_ar ?? "",
          city_name: ad.cities?.name_ar ?? "",
          images: signedImages.filter(Boolean),
        };
      })
    );

    setDonations(formattedDonations);
    setDonationsLoading(false);
  }

  loadDonations();
}, []);

useEffect(() => {
  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name_ar, icon, parent_id, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("خطأ تحميل التصنيفات:", error);
    } else {
      setCategories((data ?? []) as Category[]);
    }

    setCategoriesLoading(false);
  }

  loadCategories();
}, []);
useEffect(() => {
  async function loadGovernorates() {
    const { data, error } = await supabase
      .from("governorates")
.select("id, name_ar")
      .eq("is_active", true)
      .order("name_ar", { ascending: true });

    if (error) {
      console.error("خطأ تحميل المحافظات:", error);
    } else {
      setGovernorates((data ?? []) as Governorate[]);
    }
  }

  loadGovernorates();
}, []);
useEffect(() => {
  async function loadCities() {
    const { data, error } = await supabase
      .from("cities")
.select("id, name_ar, governorate_id")
      .eq("is_active", true)
      .order("name_ar", { ascending: true });
    if (error) {
      console.error("خطأ تحميل المدن:", error);
    } else {
      setCities((data ?? []) as City[]);
      console.log(
  "يبرود:",
  data?.find((city: any) => city.name_ar === "يبرود")
);
    }

    setCitiesLoading(false);
  }

  loadCities();
}, []);

const filteredLatestAds = ads.filter((ad) => {
  const matchesCategory =
    selectedSubCategory !== null
      ? Number(ad.category_id) === selectedSubCategory
      : selectedCategory === null ||
        Number(ad.category_id) === selectedCategory ||
        categories.some(
          (sub) =>
            sub.parent_id === selectedCategory &&
            sub.id === Number(ad.category_id)
        );

  const matchesCity =
    selectedCity !== ""
      ? String(ad.city_id) === selectedCity
      : selectedGovernorate === "" ||
        cities.some(
          (city) =>
            String(city.governorate_id) === selectedGovernorate &&
            city.id === ad.city_id
        );

  const query = searchQuery.trim().toLowerCase();

  const matchesSearch =
    query === "" ||
    ad.title.toLowerCase().includes(query) ||
    ad.description.toLowerCase().includes(query);

  return !ad.is_featured && matchesCategory && matchesSearch && matchesCity;
});

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f8fa] text-slate-800">
      
      {messageNotification && (
  <div className="fixed bottom-5 left-5 z-[99999] w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl">
    <div className="flex items-start justify-between gap-3">
      <button
        onClick={() => {
          const conversationId = messageNotification.conversationId;
          setMessageNotification(null);
          navigate(`/messages/${conversationId}`);
        }}
        className="flex-1 text-right"
      >
        <p className="font-black text-emerald-700">
          رسالة جديدة من {messageNotification.senderName}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {messageNotification.message}
        </p>
        <p className="mt-2 text-xs font-bold text-emerald-600">
          اضغط لعرض المحادثة
        </p>
      </button>

      <button
        onClick={() => setMessageNotification(null)}
        className="text-xl font-bold text-slate-400 hover:text-red-500"
        aria-label="إغلاق الإشعار"
      >
        ×
      </button>
    </div>
  </div>
)}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4">
<a href="/" className="flex items-center gap-2">
  {logoUrl ? (
    <img
      src={logoUrl}
      alt={siteName}
      className="h-11 w-11 rounded-xl object-contain"
    />
  ) : (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-xl font-black text-white">
      {siteName.charAt(0)}
    </div>
  )}

  <div>
    <h1 className="text-2xl font-black tracking-tight text-slate-900">
      {siteName}
    </h1>
    <p className="text-[10px] text-slate-400">
      السوق السوري للإعلانات المبوبة
    </p>
  </div>
</a>

          <div className="hidden flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:flex">
            <Search size={19} className="text-slate-400" />
            <select
  value={selectedGovernorate}
  onChange={(e) => {
    setSelectedGovernorate(e.target.value);
    setSelectedCity("");
  }}
  className="mx-2 max-w-36 border-l border-slate-200 bg-transparent px-2 py-2 text-sm text-slate-600 outline-none"
>
  <option value="">كل المحافظات</option>
  {governorates.map((governorate) => (
    <option key={governorate.id} value={String(governorate.id)}>
      {governorate.name_ar}
    </option>
  ))}
</select>
            <select
  value={selectedCity}
  onChange={(e) => setSelectedCity(e.target.value)}
  className="mx-2 max-w-32 border-l border-slate-200 bg-transparent px-2 py-2 text-sm text-slate-600 outline-none"
>
  <option value="">كل المدن</option>
{cities
  .filter(
    (city) =>
      selectedGovernorate === "" ||
      String(city.governorate_id) === selectedGovernorate
  )
  .map((city) => (
    <option key={city.id} value={String(city.id)}>
      {city.name_ar}
    </option>
  ))}
</select>
<input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      document.getElementById("ads-section")?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }}
  className="w-full bg-transparent px-3 text-sm outline-none"
  placeholder="شو عم تدور عليه؟ ابحث عن أي شيء..."
/>
{searchQuery && (
  <button
    onClick={() => setSearchQuery("")}
    className="px-2 text-sm font-bold text-slate-400 hover:text-red-500"
  >
    مسح
  </button>
)}
<button
  onClick={() => {
    document.getElementById("ads-section")?.scrollIntoView({
      behavior: "smooth",
    });
  }}
  className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700"
>
  بحث
</button>
          </div>


<div className="hidden items-center gap-4 md:flex">
  {isLoggedIn ? (
    <>
      <button
        onClick={() => navigate("/my-ads")}
        className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
      >
        <UserRound size={18} />
        إعلاناتي
      </button>

      <button
        onClick={() => navigate("/profile")}
        className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
      >
        <UserRound size={18} />
        الملف الشخصي
      </button>

<button
  onClick={() => navigate("/messages")}
  className="flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
>
  <span>رسائلي</span>
  {unreadMessagesCount > 0 && (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {unreadMessagesCount}
    </span>
  )}
</button>

<div className="relative">
  <button
    onClick={() => setShowNotifications(!showNotifications)}
    className="relative flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
  >
    <Bell size={20} />
    <span>الإشعارات</span>
    {unreadNotificationsCount > 0 && (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
        {unreadNotificationsCount}
      </span>
    )}
  </button>

  {showNotifications && (
    <div className="absolute left-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="font-bold text-slate-800">الإشعارات</h3>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-5 text-center text-sm text-slate-500">
            لا توجد إشعارات حالياً
          </p>
        ) : (
          notifications.map((item: any) => {
            const notification = Array.isArray(item.notifications)
              ? item.notifications[0]
              : item.notifications;

            return (
<div
  key={item.id}
onClick={async () => {
  if (!item.read_at) {
    await markNotificationAsRead(item.id);
  }

  setShowNotifications(false);

  if (notification?.link) {
    if (/^https?:\/\//i.test(notification.link)) {
      window.open(notification.link, "_blank", "noopener,noreferrer");
    } else {
      navigate(
        notification.link.startsWith("/")
          ? notification.link
          : `/${notification.link}`
      );
    }
  }
}}
  className={`cursor-pointer border-b border-slate-100 p-4 ${
    !item.read_at ? "bg-emerald-50" : "bg-white"
  }`}
>
                <p className="font-bold text-slate-800">
                  {notification?.title}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {notification?.body}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleString("ar")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  )}
</div>

      <button
        onClick={() => navigate("/favorites")}
        className="flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-700"
      >
        <Heart size={18} />
        <span>مفضلتي</span>
        {favoriteAdIds.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {favoriteAdIds.length}
          </span>
        )}
      </button>

      <button
onClick={async () => {
  const confirmed = window.confirm(
    "هل أنت متأكد أنك تريد تسجيل الخروج؟"
  );

  if (!confirmed) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("تعذر تسجيل الخروج، حاول مرة أخرى.");
    return;
  }

  navigate("/");
}}
        className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700"
      >
        <LogOut size={18} />
        تسجيل الخروج
      </button>
    </>
  ) : (
    <button
      onClick={() => navigate("/auth")}
      className="flex items-center gap-2 text-sm font-semibold text-slate-600"
    >
      <UserRound size={18} />
      تسجيل الدخول
    </button>
  )}

  {allowNewAds && (
    <button
      onClick={() => navigate("/add-ad")}
      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
    >
      <Plus size={19} />
      أضف إعلانك
    </button>
  )}
</div>




<button
  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
  aria-label="فتح القائمة"
  className="relative rounded-lg p-2 text-slate-600 md:hidden"
>
  <Menu size={24} />

{(unreadMessagesCount > 0 || unreadNotificationsCount > 0) && (
  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
)}
</button>
</div>


{isMobileMenuOpen && (
  <div className="border-t border-slate-100 bg-white px-5 py-4 shadow-md md:hidden">
    <div className="flex flex-col gap-2">
      {isLoggedIn ? (
        <>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/my-ads");
            }}
            className="rounded-xl px-4 py-3 text-right text-sm font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <UserRound size={18} className="ml-2 inline" />
            إعلاناتي
          </button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/profile");
            }}
            className="rounded-xl px-4 py-3 text-right text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <UserRound size={18} className="ml-2 inline" />
            الملف الشخصي
          </button>

<button
  onClick={() => {
    setIsMobileMenuOpen(false);
    navigate("/messages");
  }}
  className="rounded-xl px-4 py-3 text-right text-sm font-bold text-emerald-700 hover:bg-emerald-50"
>
  رسائلي
  {unreadMessagesCount > 0 && (
    <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {unreadMessagesCount}
    </span>
  )}
</button>

<button
  onClick={() => {
    setIsMobileMenuOpen(false);
    setShowNotifications(true);
  }}
  className="flex items-center justify-between rounded-xl px-4 py-3 text-right text-sm font-bold text-emerald-700 hover:bg-emerald-50"
>
  <span className="flex items-center gap-2">
    <Bell size={18} />
    الإشعارات
  </span>
  {unreadNotificationsCount > 0 && (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {unreadNotificationsCount}
    </span>
  )}
</button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/favorites");
            }}
            className="rounded-xl px-4 py-3 text-right text-sm font-bold text-rose-600 hover:bg-rose-50"
          >
            <Heart size={18} className="ml-2 inline" />
            مفضلتي
          </button>

          <button
onClick={async () => {
  const confirmed = window.confirm(
    "هل أنت متأكد أنك تريد تسجيل الخروج؟"
  );

  if (!confirmed) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("تعذر تسجيل الخروج، حاول مرة أخرى.");
    return;
  }

  setIsMobileMenuOpen(false);
  navigate("/");
}}
            className="rounded-xl px-4 py-3 text-right text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </>
      ) : (
        <button
          onClick={() => {
            setIsMobileMenuOpen(false);
            navigate("/auth");
          }}
          className="rounded-xl px-4 py-3 text-right text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <UserRound size={18} className="ml-2 inline" />
          تسجيل الدخول
        </button>
      )}

      {allowNewAds && (
        <button
          onClick={() => {
            setIsMobileMenuOpen(false);
            navigate("/add-ad");
          }}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-right text-sm font-bold text-white hover:bg-emerald-700"
        >
          <Plus size={18} className="ml-2 inline" />
          أضف إعلانك
        </button>
      )}
    </div>
  </div>
)}

{showNotifications && (
  <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-20 md:hidden">
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
        <h3 className="font-bold text-slate-800">
          الإشعارات
        </h3>

        <button
          onClick={() => setShowNotifications(false)}
          className="rounded-lg px-3 py-1 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          إغلاق
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            لا توجد إشعارات حالياً
          </p>
        ) : (
          notifications.map((item: any) => {
            const notification = Array.isArray(item.notifications)
              ? item.notifications[0]
              : item.notifications;

            return (
              <div
                key={item.id}
                onClick={async () => {
                  if (!item.read_at) {
                    await markNotificationAsRead(item.id);
                  }

                  setShowNotifications(false);

                  if (notification?.link) {
                    if (/^https?:\/\//i.test(notification.link)) {
                      window.open(
                        notification.link,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    } else {
                      navigate(
                        notification.link.startsWith("/")
                          ? notification.link
                          : `/${notification.link}`
                      );
                    }
                  }
                }}
                className={`cursor-pointer border-b border-slate-100 p-4 ${
                  !item.read_at ? "bg-emerald-50" : "bg-white"
                }`}
              >
                <p className="font-bold text-slate-800">
                  {notification?.title}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  {notification?.body}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleString("ar")}
                </p>
              </div>
            );
          })
        )}
      </div>

    </div>
  </div>
)}

<div className="border-t border-slate-100 px-5 py-3 md:hidden">
  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
    <Search size={18} className="text-slate-400" />
<input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      document.getElementById("ads-section")?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }}
  className="w-full bg-transparent px-3 text-sm outline-none"
  placeholder="ابحث في السوق..."
/>
  </div>
  <div className="mt-3 grid grid-cols-2 gap-2">
  <select
    value={selectedGovernorate}
    onChange={(e) => {
      setSelectedGovernorate(e.target.value);
      setSelectedCity("");
    }}
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
  >
    <option value="">كل المحافظات</option>
    {governorates.map((governorate) => (
      <option key={governorate.id} value={String(governorate.id)}>
        {governorate.name_ar}
      </option>
    ))}
  </select>

  <select
    value={selectedCity}
    onChange={(e) => setSelectedCity(e.target.value)}
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
  >
    <option value="">كل المدن</option>
    {cities
      .filter(
        (city) =>
          selectedGovernorate === "" ||
          String(city.governorate_id) === selectedGovernorate
      )
      .map((city) => (
        <option key={city.id} value={String(city.id)}>
          {city.name_ar}
        </option>
      ))}
  </select>
</div>
</div>
</header>


      <main className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mt-4 rounded-xl bg-amber-100 p-4 text-center font-black text-amber-900">
  ✅ وصل التحديث الجديد عبر الإنترنت بنجاح
</div>
        <section
  className="relative mt-7 overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-950 via-emerald-800 to-emerald-600 px-7 py-12 text-white md:px-14 md:py-16"
  style={
    heroImageUrl
      ? {
          backgroundImage: `linear-gradient(rgba(2, 44, 34, 0.72), rgba(2, 44, 34, 0.72)), url("${heroImageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : undefined
  }
>
          <div className="relative z-10 max-w-2xl">
            <span className="mb-5 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold">
              سوق واحد... كل ما تبحث عنه
            </span>
            <h2 className="text-3xl font-black leading-tight md:text-5xl">
              بيع واشتري بكل سهولة
              <br />
              <span className="text-emerald-200">من أي مكان في سوريا</span>
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-emerald-50/80 md:text-base">
              اكتشف آلاف الإعلانات المبوبة، واعثر على ما تحتاجه، أو انشر إعلانك
              وتواصل مباشرة مع المهتمين.
            </p>
{allowNewAds && (
  <button
    onClick={() => navigate("/add-ad")}
    className="mt-7 flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-emerald-800 hover:bg-emerald-50"
  >
    <Plus size={19} />
    أضف إعلانك الآن
  </button>
)}
          </div>
          <div className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full border-[45px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        </section>

        <section className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">تصفح حسب التصنيف</h2>
              <p className="mt-1 text-sm text-slate-500">كل ما تحتاجه في مكان واحد</p>
            </div>
          </div>

          
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-9">
            <button
onClick={() => {
  setSelectedCategory(null);
  setSelectedSubCategory(null);
}}  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
    selectedCategory === null
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : "border-slate-100 bg-white text-slate-600 hover:border-emerald-200"
  }`}
>
  كل الإعلانات
</button>
{categories
  .filter((category) => category.parent_id === null)
  .map((category) => {
    const Icon =
      categoryIconMap[category.name_ar as keyof typeof categoryIconMap] ?? Menu;

    const subCategories = categories.filter(
      (sub) => sub.parent_id === category.id
    );

    return (
      <div key={category.id} className="flex flex-col gap-3">
        <button
          onClick={() => {
            setSelectedCategory(category.id);
            setSelectedSubCategory(null);
          }}
          className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border p-4 text-center transition hover:-translate-y-1 hover:shadow-md ${
            selectedCategory === category.id
              ? "border-emerald-500 bg-emerald-50"
              : "border-slate-100 bg-white hover:border-emerald-200"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
            <Icon size={23} />
          </span>

          <span className="text-xs font-bold text-slate-700">
            {category.name_ar}
          </span>
        </button>

{selectedCategory === category.id && subCategories.length > 0 && (
  <div className="flex flex-wrap justify-center gap-2">

    <button
      onClick={() => setSelectedSubCategory(null)}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        selectedSubCategory === null
          ? "border-emerald-500 bg-emerald-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400"
      }`}
    >
      كل إعلانات التصنيف
    </button>

    {subCategories.map((sub) => (
      <button
        key={sub.id}
        onClick={() => setSelectedSubCategory(sub.id)}
        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
          selectedSubCategory === sub.id
            ? "border-emerald-500 bg-emerald-600 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400"
        }`}
      >
        {sub.name_ar}
      </button>
    ))}

  </div>
)}
      </div>
    );
  })}
          </div>
        </section>


<section className="mt-14">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-black text-slate-900">إعلانات مميزة</h2>
        <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
          مختارة
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        مجموعة من الإعلانات التي تستحق المشاهدة
      </p>
    </div>
  </div>

  {featuredAdsLoading && (
    <p className="py-8 text-center text-sm text-slate-500">
      جارٍ تحميل الإعلانات...
    </p>
  )}

 {!featuredAdsLoading && featuredAds.length === 0 && (
    <p className="py-10 text-center text-sm text-slate-500">
      لا توجد إعلانات مميزة حالياً.
    </p>
  )}

  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {featuredAds
      .filter((ad) => {
        const matchesCategory =
          selectedSubCategory !== null
            ? Number(ad.category_id) === selectedSubCategory
            : selectedCategory === null ||
              Number(ad.category_id) === selectedCategory ||
              categories.some(
                (sub) =>
                  sub.parent_id === selectedCategory &&
                  sub.id === Number(ad.category_id)
              );

        const matchesCity =
          selectedCity !== ""
            ? String(ad.city_id) === selectedCity
            : selectedGovernorate === "" ||
              cities.some(
                (city) =>
                  String(city.governorate_id) === selectedGovernorate &&
                  city.id === ad.city_id
              );

        const query = searchQuery.trim().toLowerCase();

        const matchesSearch =
          query === "" ||
          ad.title.toLowerCase().includes(query) ||
          ad.description.toLowerCase().includes(query);

        return matchesCategory && matchesSearch && matchesCity;
      })
      .map((ad) => (
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
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                <Car size={48} />
              </div>
            )}

            <span className="absolute right-3 top-3 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
              إعلان مميز
            </span>

            <button
              type="button"
              aria-label="إضافة للمفضلة"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(ad.id);
              }}
              className="absolute left-3 top-3 rounded-full bg-white/90 p-2 text-slate-500 hover:text-red-500"
            >
              <Heart
                size={18}
                fill={favoriteAdIds.includes(ad.id) ? "currentColor" : "none"}
                className={favoriteAdIds.includes(ad.id) ? "text-red-500" : ""}
              />
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
                <MapPin size={14} /> {ad.city_name}
              </span>
              <span>
                {new Date(ad.created_at).toLocaleDateString("ar-SY")}
              </span>
            </div>
          </div>
        </article>
      ))}
  </div>
</section>



<section className="mt-14">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <div className="flex items-center gap-2">
        <Heart className="text-rose-500" size={23} />
        <h2 className="text-xl font-black text-slate-900">
          أغراض مجانية للتبرع
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        خذ ما تحتاجه، وتبرع بما لم تعد بحاجة إليه
      </p>
    </div>
  </div>

  {donationsLoading && (
    <p className="py-8 text-center text-sm text-slate-500">
      جارٍ تحميل التبرعات...
    </p>
  )}

  {!donationsLoading && donations.length === 0 && (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
      <Heart size={35} className="mx-auto text-rose-300" />
      <p className="mt-3 font-bold text-slate-700">
        لا توجد أغراض متاحة للتبرع حالياً
      </p>
      <p className="mt-1 text-sm text-slate-500">
        كن أول من يشارك غرضاً ليستفيد منه غيره
      </p>
    </div>
  )}

  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {donations.slice(0, 8).map((ad) => (
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
            <div className="flex h-full items-center justify-center text-rose-300">
              <Heart size={45} />
            </div>
          )}

          <span className="absolute right-3 top-3 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">
            للتبرع مجاناً
          </span>
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 min-h-12 font-bold leading-6 text-slate-800">
            {ad.title}
          </h3>

          <p className="mt-3 text-lg font-black text-emerald-700">
            مجاناً ❤️
          </p>

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
</section>


<section className="mt-14" id="ads-section">
  <div className="mb-6 flex items-center justify-between">
    <div>
      <h2 className="text-xl font-black text-slate-900">
        أحدث الإعلانات
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        تصفح أحدث ما أُضيف إلى السوق
      </p>
    </div>
  </div>

  {adsLoading && (
    <p className="py-8 text-center text-sm text-slate-500">
      جارٍ تحميل الإعلانات...
    </p>
  )}

  {!adsLoading && filteredLatestAds.length === 0 && (
    <p className="py-10 text-center text-sm text-slate-500">
      لا توجد إعلانات جديدة حالياً.
    </p>
  )}

  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
{filteredLatestAds
  .slice(0, 8)
  .map((ad) => (
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
              <div className="flex h-full items-center justify-center text-slate-400">
                <Car size={45} />
              </div>
            )}

            <button
              type="button"
              aria-label="إضافة للمفضلة"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(ad.id);
              }}
              className="absolute left-3 top-3 rounded-full bg-white/90 p-2 text-slate-500 hover:text-red-500"
            >
              <Heart
                size={18}
                fill={favoriteAdIds.includes(ad.id) ? "currentColor" : "none"}
                className={favoriteAdIds.includes(ad.id) ? "text-red-500" : ""}
              />
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
                <MapPin size={14} /> {ad.city_name}
              </span>
              <span>
                {new Date(ad.created_at).toLocaleDateString("ar-SY")}
              </span>
            </div>
          </div>
        </article>
      ))}
  </div>
</section>

<section className="mt-8 overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-l from-rose-50 to-white p-7 md:flex md:items-center md:justify-between md:p-10">
  <div>
    <div className="flex items-center gap-2">
      <Heart className="text-rose-500" size={25} />
      <h2 className="text-2xl font-black text-slate-900">
        عندك غرض ما عاد تحتاجه؟
      </h2>
    </div>

    <p className="mt-3 text-sm leading-7 text-slate-600">
      بدل ما يضل مركون عندك، تبرع فيه وخلي غيرك يستفيد منه.
      الخير لما نتشاركه بيكبر.
    </p>
  </div>

  <button
    onClick={() => navigate("/add-ad?type=donation")}
    className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3.5 font-bold text-white transition hover:bg-rose-600 md:mt-0"
  >
    <Heart size={19} />
    تبرع بغرض الآن
  </button>
</section>

        <section className="mt-14 rounded-3xl border border-emerald-100 bg-emerald-50 p-7 md:flex md:items-center md:justify-between md:p-10">
          <div>
            <h2 className="text-2xl font-black text-emerald-950">عندك شي حابب تبيعه؟</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              انشر إعلانك مجاناً ووصل إلى آلاف المهتمين في مختلف المحافظات السورية.
            </p>
          </div>
{allowNewAds && (
  <button
    onClick={() => navigate("/add-ad")}
    className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 font-bold text-white hover:bg-emerald-800 md:mt-0"
  >
    انشر إعلانك
  </button>
)}
        </section>
      </main>

<footer className="border-t border-slate-200 bg-white px-5 py-8 text-center">
  <h2 className="text-xl font-black text-slate-900">{siteName}</h2>

  <p className="mt-2 text-xs text-slate-500">
    السوق السوري للإعلانات المبوبة
  </p>

  {contactEmail && (
    <p className="mt-3 text-xs text-slate-500">
      البريد الإلكتروني:{" "}
      <a href={`mailto:${contactEmail}`} className="text-emerald-600">
        {contactEmail}
      </a>
    </p>
  )}

  {contactPhone && (
    <p className="mt-2 text-xs text-slate-500">
      الهاتف:{" "}
      <a href={`tel:${contactPhone}`} className="text-emerald-600">
        {contactPhone}
      </a>
    </p>
  )}

  <p className="mt-4 text-xs text-slate-400">
    © {new Date().getFullYear()} {siteName} - جميع الحقوق محفوظة
  </p>
</footer>
    </div>
  );
}

