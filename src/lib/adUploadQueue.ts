import { supabase } from "./supabase";
import { addSooqWatermark } from "./imageWatermark";

type QueuedImage = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

type QueuedAd = {
  key: string;
  userId: string;
  payload: Record<string, any>;
  files: QueuedImage[];
  createdAt: number;
};

const DB_NAME = "sooq-ad-upload-queue";
const STORE_NAME = "pending-ads";
let processing = false;

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveQueuedAd(ad: QueuedAd): Promise<void> {
  const db = await openQueue();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(ad);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
}

async function getQueuedAds(): Promise<QueuedAd[]> {
  const db = await openQueue();

  const result = await new Promise<QueuedAd[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => resolve(request.result as QueuedAd[]);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return result;
}

async function removeQueuedAd(key: string): Promise<void> {
  const db = await openQueue();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
}

export async function enqueueAdUpload(input: {
  key: string;
  userId: string;
  payload: Record<string, any>;
  files: File[];
}): Promise<void> {
  if (input.files.length < 1 || input.files.length > 3) {
    throw new Error("يجب اختيار صورة واحدة على الأقل وبحد أقصى 3 صور.");
  }

  await saveQueuedAd({
    key: input.key,
    userId: input.userId,
    payload: { ...input.payload },
    files: input.files.map((file) => ({
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
    })),
    createdAt: Date.now(),
  });
}

async function uploadOneAd(ad: QueuedAd): Promise<void> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (sessionData.session?.user.id !== ad.userId) {
    return;
  }

  let adId: string | null = null;

  const { data: existing, error: lookupError } = await supabase
    .from("ads")
    .select("id,status")
    .eq("submission_key", ad.key)
    .eq("user_id", ad.userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.id) {
    adId = existing.id;

    if (existing.status === "pending" || existing.status === "approved") {
      await removeQueuedAd(ad.key);
      return;
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from("ads")
      .insert({
        ...ad.payload,
        status: "uploading",
        expected_image_count: ad.files.length,
        submission_key: ad.key,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    adId = created.id;
  }

  if (!adId) throw new Error("تعذر تحديد رقم الإعلان.");

  const imageRecords: {
    ad_id: string;
    image_path: string;
    sort_order: number;
  }[] = [];

  for (let index = 0; index < ad.files.length; index++) {
    const queuedImage = ad.files[index];
    const originalFile = new File(
      [queuedImage.blob],
      queuedImage.name,
      {
        type: queuedImage.type,
        lastModified: queuedImage.lastModified,
      }
    );

    const watermarkedFile = await addSooqWatermark(originalFile);
    const imagePath = `${ad.userId}/${adId}/${ad.key}-${index}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("ad-images")
      .upload(imagePath, watermarkedFile, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      const message = String(uploadError.message ?? "").toLowerCase();
      const duplicate =
        String(uploadError.statusCode ?? "") === "409" ||
        message.includes("already exists") ||
        message.includes("duplicate") ||
        message.includes("resource already");

      if (!duplicate) throw uploadError;
    }

    imageRecords.push({
      ad_id: adId,
      image_path: imagePath,
      sort_order: index,
    });
  }

  const { error: recordsError } = await supabase
    .from("ad_images")
    .upsert(imageRecords, {
      onConflict: "ad_id,image_path",
      ignoreDuplicates: true,
    });

  if (recordsError) throw recordsError;

  const { error: publishError } = await supabase
    .from("ads")
    .update({ status: "pending" })
    .eq("id", adId)
    .eq("user_id", ad.userId)
    .eq("status", "uploading");

  if (publishError) throw publishError;

  await removeQueuedAd(ad.key);
}

export async function processPendingAdUploads(): Promise<void> {
  if (processing || !navigator.onLine) return;

  processing = true;
  let hadFailure = false;

  try {
    const queuedAds = await getQueuedAds();

    for (const ad of queuedAds) {
      if (!navigator.onLine) break;

      try {
        await uploadOneAd(ad);
      } catch (error) {
        hadFailure = true;
        console.error("تعذّر استكمال رفع الإعلان:", ad.key, error);
      }
    }
  } catch (error) {
    hadFailure = true;
    console.error("تعذّر قراءة طابور رفع الإعلانات:", error);
  } finally {
    processing = false;

    if (hadFailure && navigator.onLine) {
      window.setTimeout(() => {
        void processPendingAdUploads();
      }, 15000);
    }
  }
}
