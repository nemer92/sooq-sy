import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useNavigate } from "react-router-dom";
import siteIcon from "../assets/icon.png";
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
  Gift,
   Share2,
    Heart,
    Star,
  Bell,
  SlidersHorizontal,
  ChevronDown,
  Megaphone,
  X,
  MessageCircle,
  Store as StoreIcon
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

type StorePreview = {
  id: string; name: string; business_type: string; description: string | null;
  governorate: string; city: string; logo_url: string | null; cover_url: string | null;
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
    const [featuredStores, setFeaturedStores] = useState<StorePreview[]>([]);
    const [featuredStoresLoading, setFeaturedStoresLoading] = useState(true);
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
        parsed.every(
          (item): item is "new" | "used" =>
            item === "new" || item === "used"
        )
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("خطأ باستعادة فلتر الحالة:", error);
  }

  return ["new", "used"];
});

const toggleCondition = (condition: "new" | "used") => {
  let updatedConditions: ("new" | "used")[];

  if (selectedConditions.includes(condition)) {
    if (selectedConditions.length === 1) {
      window.alert("يجب اختيار حالة واحدة على الأقل: جديد أو مستعمل.");
      return;
    }

    updatedConditions = selectedConditions.filter(
      (item) => item !== condition
    );
  } else {
    updatedConditions = [...selectedConditions, condition];
  }

  setSelectedConditions(updatedConditions);

  sessionStorage.setItem(
    "sooq_selected_conditions",
    JSON.stringify(updatedConditions)
  );
};
const [siteName, setSiteName] = useState("Sooq.Sy");
const [, setLogoUrl] = useState("");
const [heroImageUrl, setHeroImageUrl] = useState("");
const [contactEmail, setContactEmail] = useState("");
const [contactPhone, setContactPhone] = useState("");
const [allowNewAds, setAllowNewAds] = useState(true);
const [, setSubscriptionsEnabled] = useState(false);
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
      .select("site_name, logo_url, hero_image_url, contact_email, contact_phone, allow_new_ads, subscriptions_enabled")
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
    setSubscriptionsEnabled(data.subscriptions_enabled ?? false);
  }

  loadSiteSettings();
}, []);useEffect(() => {
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
  let active = true;
  async function loadFeaturedStores() {
    const { data, error } = await supabase
      .from("stores")
      .select("id,name,business_type,description,governorate,city,logo_url,cover_url")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) console.error("تعذر تحميل المتاجر:", error);
    if (active) {
      setFeaturedStores((data ?? []) as StorePreview[]);
      setFeaturedStoresLoading(false);
    }
  }
  loadFeaturedStores();
  return () => { active = false; };
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

const matchesCondition = selectedConditions.includes(
  ad.condition as "new" | "used"
);
  return (
  !ad.is_featured &&
  matchesCategory &&
  matchesSearch &&
  matchesCity &&
  matchesCondition
);
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
        
      </button>
    </div>
  </div>
)}



<header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 shadow-[0_2px_18px_rgba(15,23,42,0.035)] backdrop-blur-xl">
  <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr] items-center gap-x-5 gap-y-4 px-3 py-3 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)] md:gap-x-6 md:py-4">

    {/* الشعار */}
    <a
      href="/"
      className="group flex min-w-0 items-center gap-2.5 md:col-start-1 md:row-start-1"
    >
      <div className="shrink-0 rounded-2xl bg-emerald-50 p-1 shadow-sm ring-1 ring-emerald-100/80 transition duration-300 group-hover:scale-[1.03] group-hover:shadow-md">
        <img
          src={siteIcon}
          alt="Sooq.Sy"
          className="h-10 w-10 rounded-xl object-contain sm:h-11 sm:w-11"
        />
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
          {siteName}
        </h1>
        <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400 sm:text-[10px]">
          السوق السوري للإعلانات المبوبة
        </p>
      </div>
    </a>

    {/* روابط الحساب - الكمبيوتر */}
    <div className="hidden min-w-0 flex-wrap items-center justify-end gap-1.5 lg:gap-2 md:col-start-2 md:row-start-1 md:flex">
      {isLoggedIn ? (
        <>
          <button
            onClick={() => navigate("/my-ads")}
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-800 lg:px-3"
          >
            <UserRound size={17} className="transition-transform group-hover:scale-110" />
            إعلاناتي
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-emerald-700 lg:px-3"
          >
            <UserRound size={17} className="transition-transform group-hover:scale-110" />
            الملف الشخصي
          </button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              navigate("/messages");
            }}
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-700 lg:px-3"
          >
            <MessageCircle size={17} className="transition-transform group-hover:scale-110" />
            رسائلي
            {unreadMessagesCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-rose-200">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* الإشعارات */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-all duration-200 lg:px-3 ${
                showNotifications
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              }`}
            >
              <Bell size={18} className="transition-transform group-hover:rotate-[-10deg]" />
              <span>الإشعارات</span>
              {unreadNotificationsCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-rose-200">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute left-0 top-full z-[70] mt-3 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.14)] animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                      <Bell size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">الإشعارات</h3>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        آخر التحديثات والتنبيهات
                      </p>
                    </div>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">
                      {unreadNotificationsCount} جديد
                    </span>
                  )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                      <div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-400">
                        <Bell size={23} />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">
                        لا توجد إشعارات حالياً
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        ستظهر تحديثاتك الجديدة هنا
                      </p>
                    </div>
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

                            const link = notification?.link;
                            if (!link) return;

                            try {
                              if (/^https?:\/\//i.test(link)) {
                                const url = new URL(link);

                                if (
                                  url.hostname === "nemer92.github.io" &&
                                  url.pathname.startsWith("/sooq-sy/ad/")
                                ) {
                                  const adId = url.pathname
                                    .replace("/sooq-sy/ad/", "")
                                    .replace(/\/$/, "");

                                  navigate(`/ad/${encodeURIComponent(adId)}`);
                                } else {
                                  window.open(link, "_blank", "noopener,noreferrer");
                                }
                              } else {
                                navigate(link.startsWith("/") ? link : `/${link}`);
                              }
                            } catch (error) {
                              console.error("Invalid notification link:", error);
                            }
                          }}
                          className={`group cursor-pointer border-b border-slate-100/80 p-4 transition-colors duration-200 hover:bg-emerald-50/60 ${
                            !item.read_at ? "bg-emerald-50/70" : "bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              !item.read_at ? "bg-emerald-500" : "bg-transparent"
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-800 transition-colors group-hover:text-emerald-700">
                                {notification?.title}
                              </p>
                              <p className="mt-1 whitespace-pre-line text-sm leading-7 text-slate-600">
                                {notification?.body}
                              </p>
                              <p className="mt-2 text-[10px] font-medium text-slate-400">
                                {new Date(item.created_at).toLocaleString("ar")}
                              </p>
                            </div>
                          </div>
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
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 hover:text-rose-700 lg:px-3"
          >
            <Heart size={17} className="transition-transform group-hover:scale-110" />
            <span>مفضلتي</span>
            {favoriteAdIds.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm shadow-rose-200">
                {favoriteAdIds.length}
              </span>
            )}
          </button>

          <button
            onClick={async () => {
              const confirmed = await window.sooqConfirm(
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
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 lg:px-3"
          >
            <LogOut size={17} className="transition-transform group-hover:-translate-x-0.5" />
            تسجيل الخروج
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-emerald-700"
          >
            <UserRound size={17} />
            تسجيل الدخول
          </button>

          <a
            href="https://sooq-sy.pages.dev/app.apk"
            download="Sooq-SY.apk"
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 transition-transform group-hover:-translate-y-0.5"
            >
              <path d="M17.6 9.48 19.44 6.3a.5.5 0 0 0-.86-.5l-1.86 3.22a11.3 11.3 0 0 0-9.44 0L5.42 5.8a.5.5 0 1 0-.86.5L6.4 9.48A10.2 10.2 0 0 0 2 17h20a10.2 10.2 0 0 0-4.4-7.52ZM7.5 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm9 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            </svg>
            تحميل تطبيق Sooq.Sy
            <span className="mr-auto text-emerald-500">↓</span>
          </a>
        </>
      )}

      {allowNewAds && (
        <div className="flex items-center gap-2 border-r border-slate-100 pr-2">
          <button
            onClick={() => navigate("/add-ad?type=donation")}
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-l from-rose-500 to-rose-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm shadow-rose-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-rose-200/80 active:translate-y-0"
          >
            <Heart size={17} className="transition-transform group-hover:scale-110" />
            تبرع الآن
          </button>

          <button
            onClick={() => navigate("/add-ad")}
            className="group flex items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-l from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-200/80 active:translate-y-0"
          >
            <Plus size={18} className="transition-transform group-hover:rotate-90" />
            أضف إعلانك
          </button>
        </div>
      )}
    </div>

    {/* زر قائمة الموبايل */}
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      aria-label="فتح القائمة"
      aria-expanded={isMobileMenuOpen}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 md:hidden ${
        isMobileMenuOpen
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
      }`}
    >
      {isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
      {(unreadMessagesCount > 0 || unreadNotificationsCount > 0) && (
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-rose-500" />
      )}
    </button>

    {/* البحث والفلاتر - الكمبيوتر */}
    <div className="hidden min-w-0 items-center gap-3 md:col-span-2 md:row-start-2 md:flex">
      <div className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm transition-all duration-200 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-50">
        <Search size={19} className="mr-4 shrink-0 text-emerald-600" />
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
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="شو عم تدور عليه؟ ابحث عن أي شيء..."
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mx-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            مسح
          </button>
        )}
      </div>

      <div className="flex w-[390px] shrink-0 items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
        <div className="relative min-w-0 flex-1">
          <select
            value={selectedGovernorate}
            onChange={(e) => {
              setSelectedGovernorate(e.target.value);
              setSelectedCity("");
            }}
            className="h-11 w-full appearance-none rounded-xl border border-transparent bg-slate-50 px-3 pl-9 text-xs font-semibold text-slate-700 outline-none transition-all hover:bg-emerald-50/60 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
          >
            <option value="">كل المحافظات</option>
            {governorates.map((governorate) => (
              <option key={governorate.id} value={String(governorate.id)}>
                {governorate.name_ar}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative min-w-0 flex-1">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-transparent bg-slate-50 px-3 pl-9 text-xs font-semibold text-slate-700 outline-none transition-all hover:bg-emerald-50/60 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
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
          <ChevronDown size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {(searchQuery || selectedGovernorate || selectedCity) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedGovernorate("");
              setSelectedCity("");
            }}
            title="مسح البحث والفلاتر"
            aria-label="مسح البحث والفلاتر"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500 transition-all hover:bg-rose-100 active:scale-95"
          >
            <X size={17} />
          </button>
        )}
      </div>
    </div>
  </div>

  {/* قائمة الموبايل */}

{isMobileMenuOpen && (
  <>
    <style>{`
      @keyframes mobileMenuDrop {
        from {
          opacity: 0;
          transform: translateY(-14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>

    <div
      className="border-t border-slate-100 bg-white px-3 py-4 shadow-[0_12px_25px_rgba(15,23,42,0.07)] md:hidden sm:px-5"
      style={{ animation: "mobileMenuDrop 260ms cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="mx-auto max-w-7xl">
        {isLoggedIn ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5">
            <div className="mb-1 border-b border-slate-100 px-3 py-3">
              <p className="text-sm font-bold text-slate-800">حسابك</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                إدارة حسابك ومتابعة نشاطك
              </p>
            </div>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/my-ads");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Megaphone size={18} />
              </span>
              <span className="flex-1">إعلاناتي</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/profile");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <UserRound size={18} />
              </span>
              <span className="flex-1">الملف الشخصي</span>
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/messages");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <MessageCircle size={18} />
              </span>
              <span className="flex-1">رسائلي</span>
              {unreadMessagesCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadMessagesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowNotifications(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Bell size={18} />
              </span>
              <span className="flex-1">الإشعارات</span>
              {unreadNotificationsCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/favorites");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
            >
              <span className="rounded-xl bg-rose-50 p-2 text-rose-600">
                <Heart size={18} />
              </span>
              <span className="flex-1">مفضلتي</span>
              {favoriteAdIds.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {favoriteAdIds.length}
                </span>
              )}
            </button>

            <div className="my-1 border-t border-slate-100" />

            <button
              onClick={async () => {
                const confirmed = await window.sooqConfirm(
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
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <span className="rounded-xl bg-rose-50 p-2">
                <LogOut size={18} />
              </span>
              تسجيل الخروج
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/auth");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <UserRound size={18} />
              </span>
              تسجيل الدخول
            </button>
          </div>
        )}

{/* مشاركة التطبيق وربح النقاط */}

<button
  onClick={async () => {
    setIsMobileMenuOpen(false);

    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser();

      if (userError || !user) {
        alert("يرجى تسجيل الدخول أولاً.");
        return;
      }

      const { data: referralData, error: referralError } =
        await supabase
          .from("referral_codes")
          .select("code")
          .eq("user_id", user.id)
          .single();

      if (referralError || !referralData?.code) {
        alert("تعذر تحميل رابط الدعوة، حاول مرة أخرى.");
        return;
      }

      const basePath = window.location.pathname.startsWith("/sooq-sy")
        ? "/sooq-sy"
        : "";

      const link = `${window.location.origin}${basePath}/auth?ref=${encodeURIComponent(referralData.code)}`;

      if (navigator.share) {
        await navigator.share({
          title: "انضم إلى Sooq.Sy",
          text: "شارك تطبيق سوق سوريا مع أصدقائك وادعهم للانضمام، واربح النقاط!",
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        alert("تم نسخ رابط الدعوة بنجاح، شاركه مع أصدقائك واربح النقاط!");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;

      alert("تعذرت مشاركة الرابط، حاول مرة أخرى.");
    }
  }}
  className="mt-1 flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white px-3 py-3 text-right text-sm font-bold text-emerald-800 transition hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99]"
>
  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
    <Gift size={19} />
  </span>

  <span className="flex-1">
    <span className="block">شارك التطبيق واربح نقاط</span>
    <span className="mt-0.5 block text-[10px] font-medium text-emerald-600">
      ادعُ أصدقاءك واكسب المكافآت
    </span>
  </span>

  <Share2 size={17} className="text-emerald-600" />
</button>


        {allowNewAds && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/add-ad?type=donation");
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-rose-500 to-rose-600 px-3 py-3.5 text-sm font-bold text-white shadow-sm shadow-rose-200/70 transition active:scale-[0.98]"
            >
              <Heart size={17} />
              تبرع الآن
            </button>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate("/add-ad");
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-emerald-700 px-3 py-3.5 text-sm font-bold text-white shadow-sm shadow-emerald-200/70 transition active:scale-[0.98]"
            >
              <Plus size={18} />
              أضف إعلانك
            </button>
          </div>
        )}
      </div>
    </div>
  </>
)}


  {/* إشعارات الموبايل */}
  {showNotifications && (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 px-3 pt-16 backdrop-blur-[3px] md:hidden sm:px-4 sm:pt-20"
      onClick={() => setShowNotifications(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.25)] animate-in fade-in slide-in-from-top-3 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Bell size={19} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">الإشعارات</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">كل جديد يخص حسابك</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNotifications(false)}
            aria-label="إغلاق الإشعارات"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
              <div className="mb-3 rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Bell size={25} />
              </div>
              <p className="text-sm font-bold text-slate-600">لا توجد إشعارات حالياً</p>
              <p className="mt-1 text-xs text-slate-400">ستظهر إشعاراتك الجديدة هنا</p>
            </div>
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

                    const link = notification?.link;
                    if (!link) return;

                    try {
                      if (/^https?:\/\//i.test(link)) {
                        const url = new URL(link);

                        if (
                          url.hostname === "nemer92.github.io" &&
                          url.pathname.startsWith("/sooq-sy/ad/")
                        ) {
                          const adId = url.pathname
                            .replace("/sooq-sy/ad/", "")
                            .replace(/\/$/, "");
                          navigate(`/ad/${encodeURIComponent(adId)}`);
                        } else {
                          window.open(link, "_blank", "noopener,noreferrer");
                        }
                      } else {
                        navigate(link.startsWith("/") ? link : `/${link}`);
                      }
                    } catch (error) {
                      console.error("Invalid notification link:", error);
                    }
                  }}
                  className={`cursor-pointer border-b border-slate-100 p-4 transition-colors hover:bg-emerald-50/60 ${
                    !item.read_at ? "bg-emerald-50/70" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                      !item.read_at ? "bg-emerald-500" : "bg-transparent"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">
                        {notification?.title}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-7 text-slate-600">
                        {notification?.body}
                      </p>
                      <p className="mt-2 text-[10px] font-medium text-slate-400">
                        {new Date(item.created_at).toLocaleString("ar")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  )}

  {/* البحث والفلاتر - الموبايل */}

<div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2 md:hidden sm:px-5">
  <div className="mx-auto max-w-7xl">

    {/* البحث */}
    <div className="flex h-10 items-center gap-2 overflow-hidden rounded-xl border border-slate-200/80 bg-white px-2.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-all focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-50">
      <Search size={16} className="shrink-0 text-emerald-600" />

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
        className="h-full min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400"
        placeholder="ابحث عن أي شيء في السوق..."
      />

      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-50"
        >
          مسح
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          document.getElementById("ads-section")?.scrollIntoView({
            behavior: "smooth",
          });
        }}
        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
      >
        بحث
      </button>
    </div>

    {/* المحافظة والمدينة */}
    <div className="mt-2 grid grid-cols-2 gap-2">

      <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 transition focus-within:border-emerald-300">
        <span className="mb-0.5 block text-[9px] font-medium text-slate-400">
          المحافظة
        </span>

        <div className="relative">
          <select
            value={selectedGovernorate}
            onChange={(e) => {
              setSelectedGovernorate(e.target.value);
              setSelectedCity("");
            }}
            className="w-full appearance-none bg-transparent pl-5 text-[11px] font-semibold text-slate-700 outline-none"
          >
            <option value="">كل المحافظات</option>
            {governorates.map((governorate) => (
              <option key={governorate.id} value={String(governorate.id)}>
                {governorate.name_ar}
              </option>
            ))}
          </select>

          <ChevronDown
            size={12}
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 transition focus-within:border-emerald-300">
        <span className="mb-0.5 block text-[9px] font-medium text-slate-400">
          المدينة
        </span>

        <div className="relative">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full appearance-none bg-transparent pl-5 text-[11px] font-semibold text-slate-700 outline-none"
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

          <ChevronDown
            size={12}
            className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>
    </div>

    {/* مسح الفلاتر */}
    {(searchQuery || selectedGovernorate || selectedCity) && (
      <button
        type="button"
        onClick={() => {
          setSearchQuery("");
          setSelectedGovernorate("");
          setSelectedCity("");
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-100 bg-white py-1.5 text-[10px] font-semibold text-rose-500 transition hover:bg-rose-50 active:scale-[0.99]"
      >
        <X size={12} />
        مسح البحث والفلاتر
      </button>
    )}
  </div>
</div>

</header>




      <main className="mx-auto max-w-7xl px-5 pb-16">
       {/*  <div className="mt-4 rounded-xl bg-amber-100 p-4 text-center font-black text-amber-900">
  رسالة وسط البرنامج
</div>  */}
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



<div className="relative z-10 w-full max-w-xl">
  <span className="mb-1.5 inline-block rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold">
    سوق واحد... كل ما تبحث عنه
  </span>

  <h2 className="text-lg font-black leading-snug sm:text-xl md:text-3xl">
    بيع واشتري بكل سهولة
    <span className="mr-1.5 text-emerald-200">
      من أي مكان في سوريا
    </span>
  </h2>

  <p className="mt-1.5 max-w-lg text-[10px] leading-4 text-emerald-50/80 sm:text-xs sm:leading-5">
    اكتشف آلاف الإعلانات المبوبة، واعثر على ما تحتاجه، أو انشر إعلانك وتواصل مباشرة مع المهتمين.
  </p>

  {allowNewAds && (
    <button
      onClick={() => navigate("/add-ad")}
      className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[10px] font-bold text-emerald-800 transition hover:bg-emerald-50 sm:text-xs"
    >
      <Plus size={14} />
      أضف إعلانك الآن
    </button>
  )}
</div>


<div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full border-[25px] border-white/5" />
<div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

</section>
{true && (



<section className="relative isolate mt-5 overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-l from-emerald-100 via-white to-amber-100 px-4 py-4 shadow-[0_0_18px_rgba(16,185,129,0.25),0_0_35px_rgba(245,158,11,0.12)] sm:mt-8 sm:rounded-3xl sm:p-6 md:flex md:items-center md:justify-between md:gap-5">

  <style>
    {`
      @keyframes premiumShine {
        0% {
          transform: translateX(-180%) skewX(-25deg);
          opacity: 0;
        }
        15% { opacity: 1; }
        70% { opacity: 1; }
        100% {
          transform: translateX(450%) skewX(-25deg);
          opacity: 0;
        }
      }

      @keyframes premiumGlow {
        0%, 100% {
          box-shadow: 0 0 10px rgba(16,185,129,.25),
                      0 0 20px rgba(16,185,129,.12);
        }
        50% {
          box-shadow: 0 0 22px rgba(16,185,129,.55),
                      0 0 42px rgba(245,158,11,.25);
        }
      }

      @keyframes starPulse {
        0%, 100% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(1.18) rotate(12deg); }
      }
    `}
  </style>

  {/* شعاع لمعان قوي ومتكرر */}
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute -inset-y-12 left-0 w-[35%] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 blur-sm animate-[premiumShine_2.2s_ease-in-out_infinite]" />
    <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/10 via-transparent to-amber-200/20" />
  </div>

  <div className="flex min-w-0 items-start gap-3">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-200 to-amber-100 text-emerald-800 shadow-md animate-[premiumGlow_2s_ease-in-out_infinite] sm:h-12 sm:w-12">
      <Star size={24} className="fill-emerald-500/30 animate-[starPulse_1.8s_ease-in-out_infinite]" />
    </span>

    <div className="min-w-0">
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white/90 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 shadow-sm sm:text-xs">
        <Star size={12} className="fill-emerald-500 text-emerald-600" />
        باقات Sooq.Sy
      </span>

      <h2 className="mt-1.5 text-sm font-extrabold leading-6 text-gray-900 sm:text-lg">
        ارتقِ بإعلاناتك مع باقات الاشتراك
      </h2>

      <p className="mt-1 text-[11px] leading-5 text-gray-700 sm:text-sm">
        فرص ظهور أكبر وإعلانات مميزة مع الباقة المناسبة لك.
      </p>
    </div>
  </div>

  <button
    type="button"
    onClick={() => navigate("/subscriptions")}
    className="group relative mt-3 flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl border border-emerald-400/50 bg-gradient-to-l from-emerald-800 via-emerald-600 to-emerald-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(16,185,129,0.65)] sm:mt-4 sm:w-auto sm:px-5 sm:py-3 sm:text-sm md:mt-0"
  >
    <span className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:translate-x-[300%] group-hover:transition-transform group-hover:duration-700" />
    <Star size={16} className="relative fill-white/30" />
    <span className="relative">استكشف الباقات</span>
  </button>
</section>



)}



<section className="mt-5 sm:mt-8">
  <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-sm sm:rounded-3xl sm:p-6">

    {/* رأس القسم */}
<div className="relative mb-4 flex items-center sm:mb-6">
  <div className="w-full text-right">
    <h2 className="text-base font-black tracking-tight text-slate-900 sm:text-xl">
      تصفح حسب التصنيف
    </h2>
    <p className="mt-1 text-[11px] text-slate-500 sm:text-sm">
      اختر القسم المناسب للعثور على ما تبحث عنه
    </p>
  </div>

  <span className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
    <Menu size={22} />
  </span>
</div>

    {/* ألوان التصنيفات */}
    {/*
      نسخة الموبايل
    */}
    <div className="sm:hidden">
      <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedSubCategory(null);
          }}
          className={`flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 transition-all duration-200 ${
            selectedCategory === null
              ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-200"
              : "border-slate-200 bg-white text-slate-600 active:bg-emerald-50"
          }`}
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            selectedCategory === null
              ? "bg-white/20"
              : "bg-emerald-50 text-emerald-700"
          }`}>
            <Menu size={21} />
          </span>
          <span className="whitespace-nowrap text-[11px] font-extrabold">
            الكل
          </span>
        </button>

        {categories
          .filter((category) => category.parent_id === null)
          .map((category) => {
            const Icon =
              categoryIconMap[
                category.name_ar as keyof typeof categoryIconMap
              ] ?? Menu;

            const isActive = selectedCategory === category.id;

            const colorStyles = [
              "bg-blue-50 text-blue-600 border-blue-100",
              "bg-purple-50 text-purple-600 border-purple-100",
              "bg-rose-50 text-rose-600 border-rose-100",
              "bg-amber-50 text-amber-600 border-amber-100",
              "bg-cyan-50 text-cyan-600 border-cyan-100",
              "bg-emerald-50 text-emerald-600 border-emerald-100",
              "bg-orange-50 text-orange-600 border-orange-100",
              "bg-indigo-50 text-indigo-600 border-indigo-100",
            ];

            const colorIndex =
              Math.abs(
                category.name_ar
                  .split("")
                  .reduce((sum, char) => sum + char.charCodeAt(0), 0)
              ) % colorStyles.length;

            return (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedSubCategory(null);
                }}
                className={`flex min-w-[82px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                  isActive
                    ? "border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-200"
                    : "border-slate-200 bg-white text-slate-700 active:bg-slate-50"
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  isActive
                    ? "border-white/20 bg-white/20 text-white"
                    : colorStyles[colorIndex]
                }`}>
                  <Icon size={21} />
                </span>

                <span className="whitespace-nowrap text-[11px] font-extrabold">
                  {category.name_ar}
                </span>
              </button>
            );
          })}
      </div>

      {/* التصنيفات الفرعية للموبايل */}
      {selectedCategory && (
        <div className="mt-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="mb-2 text-[11px] font-black text-emerald-800">
            التصنيفات الفرعية
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setSelectedSubCategory(null)}
              className={`shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition ${
                selectedSubCategory === null
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-white bg-white text-slate-600"
              }`}
            >
              كل التصنيف
            </button>

            {categories
              .filter((sub) => sub.parent_id === selectedCategory)
              .map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(sub.id)}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-[11px] font-bold transition ${
                    selectedSubCategory === sub.id
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-white bg-white text-slate-600"
                  }`}
                >
                  {sub.name_ar}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>

    {/* نسخة الكمبيوتر */}
    <div className="hidden sm:block">
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden px-1 pb-4 pt-1 [scrollbar-width:thin] [scrollbar-color:#a7f3d0_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-300">

        <button
          onClick={() => {
            setSelectedCategory(null);
            setSelectedSubCategory(null);
          }}
          className={`flex min-w-[175px] shrink-0 items-center gap-3 rounded-2xl border p-3.5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
            selectedCategory === null
              ? "border-emerald-400 bg-emerald-50 shadow-sm"
              : "border-slate-200 bg-white hover:border-emerald-200"
          }`}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            selectedCategory === null
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-700"
          }`}>
            <Menu size={23} />
          </span>
          <span className={`whitespace-nowrap text-sm font-black ${
            selectedCategory === null ? "text-emerald-800" : "text-slate-800"
          }`}>
            كل الإعلانات
          </span>
        </button>

        {categories
          .filter((category) => category.parent_id === null)
          .map((category) => {
            const Icon =
              categoryIconMap[
                category.name_ar as keyof typeof categoryIconMap
              ] ?? Menu;

            const isActive = selectedCategory === category.id;

            const colorStyles = [
              "bg-blue-50 text-blue-600 border-blue-100",
              "bg-purple-50 text-purple-600 border-purple-100",
              "bg-rose-50 text-rose-600 border-rose-100",
              "bg-amber-50 text-amber-600 border-amber-100",
              "bg-cyan-50 text-cyan-600 border-cyan-100",
              "bg-emerald-50 text-emerald-600 border-emerald-100",
              "bg-orange-50 text-orange-600 border-orange-100",
              "bg-indigo-50 text-indigo-600 border-indigo-100",
            ];

            const colorIndex =
              Math.abs(
                category.name_ar
                  .split("")
                  .reduce((sum, char) => sum + char.charCodeAt(0), 0)
              ) % colorStyles.length;

            const subCategories = categories.filter(
              (sub) => sub.parent_id === category.id
            );

            return (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedSubCategory(null);
                }}
                className={`group flex min-w-[175px] shrink-0 items-center gap-3 rounded-2xl border p-3.5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                  isActive
                    ? "border-emerald-400 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-200"
                }`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
                  isActive
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : colorStyles[colorIndex]
                }`}>
                  <Icon size={23} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className={`block whitespace-nowrap text-sm font-black ${
                    isActive ? "text-emerald-800" : "text-slate-800"
                  }`}>
                    {category.name_ar}
                  </span>

                  <span className="mt-1.5 block whitespace-nowrap text-[10px] font-medium text-slate-400">
                    {subCategories.length > 0
                      ? `${subCategories.length} تصنيف فرعي`
                      : "تصفح الإعلانات"}
                  </span>
                </span>
              </button>
            );
          })}
      </div>

      {/* التصنيفات الفرعية للكمبيوتر */}
      {selectedCategory && (
        <div className="mt-2 rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50/80 to-white p-3.5">
          <div className="mb-3 flex items-center gap-2 text-xs font-black text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            التصنيفات الفرعية
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:#a7f3d0_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-300">
            <button
              onClick={() => setSelectedSubCategory(null)}
              className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                selectedSubCategory === null
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
              }`}
            >
              كل إعلانات التصنيف
            </button>

            {categories
              .filter((sub) => sub.parent_id === selectedCategory)
              .map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(sub.id)}
                  className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                    selectedSubCategory === sub.id
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
                >
                  {sub.name_ar}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>

  </div>
</section>


<section
  dir="rtl"
  className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mt-6 sm:rounded-3xl sm:p-4"
>
  <div className="mb-3 flex items-center gap-2">
    <SlidersHorizontal size={18} className="text-emerald-600" />
    <h3 className="text-sm font-black text-slate-800">
      حالة الإعلان
    </h3>
    <span className="text-[10px] text-slate-400">
      يمكنك اختيار الحالتين معاً
    </span>
  </div>

  <div className="grid grid-cols-2 gap-3">
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
        selectedConditions.includes("new")
          ? "border-emerald-400 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={selectedConditions.includes("new")}
        onChange={() => toggleCondition("new")}
        className="h-5 w-5 accent-emerald-600"
      />
      <span className="text-sm font-bold text-slate-700">
        جديد
      </span>
    </label>

    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
        selectedConditions.includes("used")
          ? "border-emerald-400 bg-emerald-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={selectedConditions.includes("used")}
        onChange={() => toggleCondition("used")}
        className="h-5 w-5 accent-emerald-600"
      />
      <span className="text-sm font-bold text-slate-700">
        مستعمل
      </span>
    </label>
  </div>
</section>


<section
  dir="rtl"
  className="featured-premium relative isolate mt-14 overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-bl from-amber-100 via-yellow-50 to-amber-200 p-4 shadow-[0_0_18px_rgba(245,158,11,0.22),0_0_35px_rgba(251,191,36,0.12)] sm:p-6"
>
  <style>
    {`
      @keyframes goldShine {
        0% {
          transform: translateX(-180%) skewX(-22deg);
          opacity: 0;
        }
        15%, 75% { opacity: .75; }
        100% {
          transform: translateX(450%) skewX(-22deg);
          opacity: 0;
        }
      }

      @keyframes goldGlow {
        0%, 100% {
          box-shadow: 0 0 10px rgba(245,158,11,.16);
          border-color: rgba(245,158,11,.55);
        }
        50% {
          box-shadow: 0 0 22px rgba(245,158,11,.42),
                      0 0 35px rgba(251,191,36,.20);
          border-color: rgba(217,119,6,.85);
        }
      }

      @keyframes starSparkle {
        0%, 100% { transform: rotate(-8deg) scale(1); filter: drop-shadow(0 0 2px rgba(245,158,11,.3)); }
        50% { transform: rotate(12deg) scale(1.2); filter: drop-shadow(0 0 9px rgba(245,158,11,.9)); }
      }

      @keyframes badgeShine {
        0% { transform: translateX(-160%) skewX(-25deg); }
        100% { transform: translateX(260%) skewX(-25deg); }
      }

      .featured-premium::before {
        content: "";
        position: absolute;
        z-index: -1;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          110deg,
          transparent 20%,
          rgba(255,255,255,.65) 45%,
          rgba(255,255,255,.18) 52%,
          transparent 72%
        );
        background-size: 220% 100%;
        animation: goldShine 3s ease-in-out infinite;
      }

      .featured-premium .featured-card {
        animation: goldGlow 3s ease-in-out infinite;
      }

      .featured-premium .featured-badge {
        position: relative;
        overflow: hidden;
      }

      .featured-premium .featured-badge::after {
        content: "";
        position: absolute;
        inset: -20% auto -20% -60%;
        width: 45%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
        animation: badgeShine 2.5s ease-in-out infinite;
      }

      .featured-premium .featured-star {
        display: inline-block;
        animation: starSparkle 1.8s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .featured-premium::before,
        .featured-premium .featured-card,
        .featured-premium .featured-badge::after,
        .featured-premium .featured-star {
          animation: none !important;
        }
      }
    `}
  </style>

  <div className="relative z-10 mb-6 flex items-center justify-between gap-3">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="featured-star text-2xl">⭐</span>

        <h2 className="text-xl font-black text-amber-950">
          إعلانات مميزة
        </h2>

        <span className="rounded-md border border-amber-400 bg-gradient-to-l from-amber-200 to-yellow-100 px-2 py-1 text-[10px] font-bold text-amber-950 shadow-sm">
          مختارة بعناية
        </span>
      </div>

      <p className="mt-1 text-sm text-amber-900">
        مجموعة من الإعلانات التي تستحق المشاهدة
      </p>
    </div>

    <button
      type="button"
      onClick={() => navigate("/featured-ads")}
      className="shrink-0 rounded-xl border border-amber-400 bg-white/90 px-3 py-2 text-xs font-black text-amber-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-md sm:px-4 sm:text-sm"
    >
      عرض الكل ←
    </button>
  </div>

  {featuredAdsLoading && (
    <p className="relative z-10 py-8 text-center text-sm font-semibold text-amber-900">
      جارٍ تحميل الإعلانات...
    </p>
  )}

  {!featuredAdsLoading && featuredAds.length === 0 && (
    <p className="relative z-10 py-10 text-center text-sm text-amber-900">
      لا توجد إعلانات مميزة حالياً.
    </p>
  )}

  {!featuredAdsLoading && featuredAds.length > 0 && (
    <div className="relative z-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
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

          const matchesCondition = selectedConditions.includes(
            ad.condition as "new" | "used"
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

          return (
            matchesCategory &&
            matchesSearch &&
            matchesCity &&
            matchesCondition
          );
        })
        .map((ad) => (
          <article
            key={ad.id}
            onClick={() => navigate(`/ad/${ad.id}`)}
            className="featured-card group w-[270px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-md shadow-amber-300/30 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[300px] lg:w-[310px]"
          >
            <div className="relative h-52 overflow-hidden bg-amber-50">
              {ad.images.length > 0 ? (
                <img
                  src={ad.images[0]}
                  alt={ad.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-amber-400">
                  <Car size={48} />
                </div>
              )}

              <span className="featured-badge absolute right-3 top-3 rounded-lg border border-amber-400 bg-gradient-to-l from-amber-300 to-yellow-100 px-3 py-1.5 text-xs font-black text-amber-950 shadow-[0_0_12px_rgba(245,158,11,0.35)]">
                ⭐ إعلان مميز
              </span>

              <button
                type="button"
                aria-label="إضافة للمفضلة"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(ad.id);
                }}
                className="absolute left-3 top-3 rounded-full bg-white/90 p-2 text-slate-500 shadow-sm transition hover:scale-110 hover:text-red-500"
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

              <div className="mt-4 flex items-center justify-between border-t border-amber-100 pt-3 text-xs text-slate-400">
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
  )}
</section>






<section
  dir="rtl"
  className="mt-10 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-bl from-emerald-100 via-white to-teal-100 p-4 shadow-md shadow-emerald-100/70 sm:p-6"
>
  <div className="mb-6 flex items-center justify-between gap-3">
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm"><StoreIcon size={22} /></span>
        <h2 className="text-xl font-black text-emerald-950">متاجر مميزة</h2>
        <span className="rounded-md border border-emerald-200 bg-white/80 px-2 py-1 text-[10px] font-bold text-emerald-800">تسوق من المتجر مباشرة</span>
      </div>
      <p className="mt-2 text-sm text-emerald-800">اكتشف المتاجر المحلية وتصفح منتجاتها من مكان واحد</p>
    </div>
    <button type="button" onClick={() => navigate("/stores")} className="shrink-0 rounded-xl border border-emerald-300 bg-white/90 px-3 py-2 text-xs font-black text-emerald-900 transition hover:bg-emerald-200 sm:px-4 sm:text-sm">كل المتاجر ←</button>
  </div>
  {featuredStoresLoading && <p className="py-8 text-center text-sm text-emerald-800">جارٍ تحميل المتاجر...</p>}
  {!featuredStoresLoading && featuredStores.length === 0 && <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/60 py-8 text-center text-sm text-emerald-800">ستظهر المتاجر هنا بعد تفعيلها</div>}
  {!featuredStoresLoading && featuredStores.length > 0 && (

<div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
  {featuredStores.map((store) => (
    <button
      key={store.id}
      type="button"
      onClick={() => navigate(`/store/${store.id}`)}
      className="group w-[245px] shrink-0 snap-start overflow-hidden rounded-2xl border border-emerald-200 bg-white text-right shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:w-[275px]"
    >
      {/* غلاف المتجر */}
      <div
        className="relative z-0 h-28 bg-gradient-to-l from-emerald-200 via-teal-100 to-slate-100"
        style={
          store.cover_url
            ? {
                backgroundImage: `url(${store.cover_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-emerald-800 shadow-sm">
          متجر
        </span>
      </div>

      <div className="relative z-10 px-4 pb-4">
        {/* شعار المتجر */}
        <div className="relative z-20 -mt-8 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="relative z-10 h-full w-full object-cover"
            />
          ) : (
            <StoreIcon size={27} className="text-emerald-600" />
          )}
        </div>

        <h3 className="truncate text-base font-black text-slate-900">
          {store.name}
        </h3>

        <p className="mt-1 truncate text-sm font-bold text-emerald-700">
          {store.business_type}
        </p>

        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={13} />
          {[store.governorate, store.city].filter(Boolean).join(" - ") ||
            "الموقع غير محدد"}
        </p>

        <span className="mt-4 inline-flex rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 transition group-hover:bg-emerald-600 group-hover:text-white">
          تصفح المتجر ←
        </span>
      </div>
    </button>
  ))}
</div>

  )}
</section>

<section
  className="mt-14 rounded-3xl border border-emerald-200 bg-gradient-to-bl from-emerald-50 via-white to-teal-50 p-4 shadow-sm sm:p-6"
  id="ads-section"
  dir="rtl"
>
  <div className="mb-6 flex items-center justify-between gap-3">
    <div>
      <h2 className="text-xl font-black text-emerald-950">
        أحدث الإعلانات
      </h2>
      <p className="mt-1 text-sm text-emerald-800">
        تصفح أحدث ما أُضيف إلى السوق
      </p>
    </div>

    <button
      type="button"
      onClick={() => navigate("/regular-ads")}
      className="shrink-0 rounded-xl border border-emerald-300 bg-white/80 px-3 py-2 text-xs font-black text-emerald-900 transition hover:bg-emerald-100 sm:px-4 sm:text-sm"
    >
      عرض الكل ←
    </button>
  </div>

  {adsLoading && (
    <p className="py-8 text-center text-sm text-emerald-800">
      جارٍ تحميل الإعلانات...
    </p>
  )}

  {!adsLoading && filteredLatestAds.length === 0 && (
    <p className="py-10 text-center text-sm text-emerald-800">
      لا توجد إعلانات جديدة حالياً.
    </p>
  )}

  {!adsLoading && filteredLatestAds.length > 0 && (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
      {filteredLatestAds.slice(0, 8).map((ad) => (
        <article
          key={ad.id}
          onClick={() =>
            navigate(`/ad/${ad.id}`, {
              state: { from: "/" },
            })
          }
          className="group w-[270px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white shadow-md shadow-emerald-100/50 transition hover:-translate-y-1 hover:shadow-xl sm:w-[300px] lg:w-[310px]"
        >
          <div className="relative h-52 overflow-hidden bg-emerald-50">
            {ad.images.length > 0 ? (
              <img
                src={ad.images[0]}
                alt={ad.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-emerald-400">
                <Car size={48} />
              </div>
            )}

            <span className="absolute right-3 top-3 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
              إعلان للبيع
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

            <div className="mt-4 flex items-center justify-between border-t border-emerald-100 pt-3 text-xs text-slate-400">
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
</section>





<section
  className="mt-14 rounded-3xl border border-rose-200 bg-gradient-to-bl from-rose-50 via-white to-pink-50 p-4 shadow-sm sm:p-6"
  dir="rtl"
>
  <div className="mb-6 flex items-center justify-between gap-3">
    <div>
      <div className="flex items-center gap-2">
        <Heart
  className="text-rose-500"
  size={23}
  style={{
    animation: "heartbeat 3s ease-in-out infinite",
    transformOrigin: "center",
  }}
/>
        <h2 className="text-xl font-black text-rose-950">
          أغراض مجانية للتبرع
        </h2>
      </div>
      <p className="mt-1 text-sm text-rose-800">
        خذ ما تحتاجه، وتبرع بما لم تعد بحاجة إليه
      </p>
    </div>

    <button
      type="button"
      onClick={() => navigate("/donations")}
      className="shrink-0 rounded-xl border border-rose-300 bg-white/80 px-3 py-2 text-xs font-black text-rose-900 transition hover:bg-rose-100 sm:px-4 sm:text-sm"
    >
      عرض الكل ←
    </button>
  </div>

  {donationsLoading && (
    <p className="py-8 text-center text-sm text-rose-800">
      جارٍ تحميل التبرعات...
    </p>
  )}

  {!donationsLoading && donations.length === 0 && (
    <div className="rounded-2xl border border-dashed border-rose-200 bg-white/80 py-10 text-center">
      <Heart size={35} className="mx-auto text-rose-300" />
      <p className="mt-3 font-bold text-slate-700">
        لا توجد أغراض متاحة للتبرع حالياً
      </p>
      <p className="mt-1 text-sm text-slate-500">
        كن أول من يشارك غرضاً ليستفيد منه غيره
      </p>
    </div>
  )}

  {!donationsLoading && donations.length > 0 && (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
      {donations.slice(0, 8).map((ad) => (
        <article
          key={ad.id}
          onClick={() => navigate(`/ad/${ad.id}`)}
          className="group w-[270px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border-2 border-rose-200 bg-white shadow-md shadow-rose-100/50 transition hover:-translate-y-1 hover:shadow-xl sm:w-[300px] lg:w-[310px]"
        >
          <div className="relative h-52 overflow-hidden bg-rose-50">
            {ad.images.length > 0 ? (
              <img
                src={ad.images[0]}
                alt={ad.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-rose-50 text-rose-400">
                <Heart size={48} />
              </div>
            )}

            <span className="absolute right-3 top-3 rounded-lg border border-rose-300 bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800">
              ❤️ للتبرع مجاناً
            </span>
          </div>

          <div className="p-4">
            <h3 className="line-clamp-2 min-h-12 font-bold leading-6 text-slate-800">
              {ad.title}
            </h3>

            <p className="mt-3 text-xl font-black text-rose-600">
              مجاناً ❤️
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-rose-100 pt-3 text-xs text-slate-400">
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
</section>


{/* بطاقة نشر إعلان */}
<section className="mt-8 rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-5 shadow-sm transition-shadow hover:shadow-md md:flex md:items-center md:justify-between md:gap-5 md:p-6">
  <div className="min-w-0">
    <h2 className="text-lg font-extrabold text-emerald-950">
      عندك شي حابب تبيعه؟
    </h2>
    <p className="mt-1.5 text-xs leading-6 text-emerald-800 sm:text-sm">
      انشر إعلانك مجاناً ووصل إلى آلاف المهتمين في مختلف المحافظات السورية.
    </p>
  </div>

  {allowNewAds && (
    <button
      onClick={() => navigate("/add-ad")}
      className="mt-4 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 md:mt-0"
    >
      انشر إعلانك
    </button>
  )}
</section>

{/* بطاقة التبرع */}
<section
  dir="rtl"
  className="mt-4 overflow-hidden rounded-2xl border border-rose-100 bg-gradient-to-l from-rose-50 to-white p-5 shadow-sm transition-shadow hover:shadow-md md:flex md:items-center md:justify-between md:gap-5 md:p-6"
>
  <div className="min-w-0">
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
        <Heart size={17} />
      </span>
      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-700">
        الخير بيجمعنا ❤️
      </span>
    </div>

    <h2 className="text-lg font-extrabold text-rose-950">
      عندك شي حابب تتبرع فيه؟
    </h2>

    <p className="mt-1.5 max-w-xl text-xs leading-6 text-rose-800 sm:text-sm">
      غرض ما عدت بحاجة إله ممكن يكون سبب فرحة لشخص تاني.
      شارك أغراضك مجاناً وساهم بنشر الخير ومساعدة غيرك.
    </p>
  </div>

  <button
    onClick={() => navigate("/add-ad?type=donation")}
    className="mt-4 flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 md:mt-0"
  >
    <Heart size={17} />
    تبرع الآن
  </button>
</section>

      </main>



<footer className="relative mt-8 overflow-hidden bg-slate-950 px-4 pb-4 pt-7 text-white md:mt-12 md:px-5 md:pb-6 md:pt-12">
  {/* لمسات جمالية */}
  <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
  <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

  <div className="relative mx-auto max-w-6xl">
    <div className="grid gap-5 text-center md:grid-cols-3 md:gap-8 md:text-right">

      {/* هوية الموقع */}
      <div>
        <h2 className="text-xl font-black tracking-wide text-white md:text-2xl">
          {siteName}
        </h2>
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-emerald-500 md:mt-3 md:md:mx-0" />
        <p className="mt-2 text-xs leading-6 text-slate-400 md:mt-4 md:text-sm md:leading-7">
          السوق السوري للإعلانات المبوبة
          <br />
          مكانك للبيع والشراء والتبرع.
        </p>
      </div>

      {/* التواصل */}
      <div>
        <h3 className="mb-2 text-sm font-black text-white md:mb-4 md:text-base">
          تواصل معنا
        </h3>

        <div className="flex flex-wrap items-center justify-center gap-3 md:flex-col md:items-start">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-emerald-400 md:text-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-emerald-400">
                ✉
              </span>
              <span dir="ltr">{contactEmail}</span>
            </a>
          )}

          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              className="flex items-center gap-2 text-xs text-slate-400 transition hover:text-emerald-400 md:text-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-emerald-400">
                ☎
              </span>
              <span dir="ltr">{contactPhone}</span>
            </a>
          )}
        </div>
      </div>

      {/* تحميل التطبيق */}
      <div>
        <h3 className="mb-2 text-sm font-black text-white md:mb-3 md:text-base">
          حمّل تطبيق Sooq Sy
        </h3>

        <p className="text-xs leading-6 text-slate-400 md:text-sm md:leading-7">
          تابع إعلاناتك بسهولة من موبايلك.
        </p>

        <a
          href="https://sooq-sy.pages.dev/app.apk"
          download="Sooq-SY.apk"
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 shadow-sm transition hover:bg-emerald-500/20 hover:text-emerald-300 md:mt-4 md:px-5 md:py-2.5 md:text-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M17.6 9.48 19.44 6.3a.5.5 0 0 0-.86-.5l-1.86 3.22a11.3 11.3 0 0 0-9.44 0L5.42 5.8a.5.5 0 1 0-.86.5L6.4 9.48A10.2 10.2 0 0 0 2 17h20a10.2 10.2 0 0 0-4.4-7.52ZM7.5 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm9 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
            <path d="M4 18h16v1a2 2 0 0 1-2 2h-1v2h-2v-2H9v2H7v-2H6a2 2 0 0 1-2-2v-1Z" />
          </svg>
          تحميل التطبيق ↓
        </a>

        <p className="mt-1 text-[10px] text-slate-500">
          متوفر لأجهزة Android بصيغة APK
        </p>
      </div>
    </div>

    {/* الحقوق */}
    <div className="mt-6 border-t border-white/10 pt-3 text-center md:mt-10 md:pt-5">
      <p className="text-[10px] text-slate-500 md:text-xs">
        © {new Date().getFullYear()} {siteName} - جميع الحقوق محفوظة
      </p>
      <p className="mt-1 text-[10px] font-medium text-slate-600 md:mt-2 md:text-[11px]">
        صنع بكل محبة لخدمة المجتمع السوري
      </p>
    </div>
  </div>
</footer>


    </div>
  );
}

