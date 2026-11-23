
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("ADS_CLEANUP_SECRET") ?? "";
  const suppliedSecret = req.headers.get("x-cleanup-secret") ?? "";

  if (
    !expectedSecret ||
    !suppliedSecret ||
    !safeCompare(expectedSecret, suppliedSecret)
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase configuration" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // 1. Save image paths in the durable queue, then delete eligible ads.
    const { data: deletedCount, error: prepareError } =
      await supabase.rpc("prepare_expired_ads_cleanup");

    if (prepareError) {
      throw new Error(`Preparing expired ads failed: ${prepareError.message}`);
    }

    // 2. Read pending image deletions.
    const { data: queueItems, error: queueError } = await supabase
      .from("ad_storage_cleanup_queue")
      .select("id, object_path, attempts")
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(100);

    if (queueError) {
      throw new Error(`Reading cleanup queue failed: ${queueError.message}`);
    }

    let imagesDeleted = 0;
    let imagesFailed = 0;

    if (queueItems && queueItems.length > 0) {
      const paths = queueItems.map((item) => item.object_path);

      // 3. Delete actual files from Supabase Storage.
      const { error: storageError } = await supabase.storage
        .from("ad-images")
        .remove(paths);

      if (storageError) {
        // Keep the items pending so the next scheduled run can retry.
        const message = storageError.message.slice(0, 1000);

        for (const item of queueItems) {
          await supabase
            .from("ad_storage_cleanup_queue")
            .update({
              attempts: item.attempts + 1,
              last_error: message,
            })
            .eq("id", item.id);
        }

        imagesFailed = queueItems.length;
      } else {
        // 4. Mark successfully removed files as completed.
        const ids = queueItems.map((item) => item.id);

        const { error: updateError } = await supabase
          .from("ad_storage_cleanup_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            last_error: null,
          })
          .in("id", ids);

        if (updateError) {
          // The storage files are already removed. Leaving the queue pending
          // is safe: another removal attempt is harmless.
          throw new Error(
            `Files deleted, but queue update failed: ${updateError.message}`,
          );
        }

        imagesDeleted = queueItems.length;
      }
    }

    return jsonResponse({
      success: imagesFailed === 0,
      deleted_ads: deletedCount ?? 0,
      images_deleted: imagesDeleted,
      images_pending_retry: imagesFailed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Ads cleanup failed:", message);

    return jsonResponse({ error: message }, 500);
  }
});
