import {
  IgApiClient,
  IgCheckpointError,
  IgLoginRequiredError,
} from "instagram-private-api";
import { eq } from "drizzle-orm";
import { db, toSqliteDateTime } from "./db";
import { igSessions } from "./schema";
import sharp from "sharp";

export { IgCheckpointError, IgLoginRequiredError };

interface WebUploadResult {
  status: string;
  media?: {
    id: string;
    code: string;
  };
  message?: string;
}

let cachedIgClient: IgApiClient | null = null;

async function getAuthenticatedClient(): Promise<IgApiClient> {
  if (cachedIgClient) return cachedIgClient;
  const username = process.env.IG_USERNAME?.trim();
  const password = process.env.IG_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("Kredensial Instagram tidak ditemukan. Harap isi IG_USERNAME & IG_PASSWORD atau IG_SESSIONID di file .env.");
  }
  const ig = new IgApiClient();
  ig.state.generateDevice(username);
  try {
    const [savedSession] = await db.select().from(igSessions).where(eq(igSessions.id, 1));
    if (savedSession?.sessionData) {
      await ig.state.deserialize(JSON.parse(savedSession.sessionData));
      await ig.user.info(ig.state.cookieUserId);
      console.log("[Instagram API] Berhasil memulihkan sesi tersimpan untuk @" + username);
      cachedIgClient = ig;
      return ig;
    }
  } catch {
    console.log("[Instagram API] Sesi tersimpan kadaluarsa atau tidak valid. Melakukan login baru...");
  }
  console.log(`[Instagram API] Melakukan login ke akun Instagram: @${username}...`);
  try {
    await ig.account.login(username, password);
    console.log(`[Instagram API] Login berhasil sebagai @${username}`);
    const serialized = await ig.state.serialize();
    delete (serialized as Record<string, unknown>).constants;
    const now = toSqliteDateTime();
    await db
      .insert(igSessions)
      .values({ id: 1, sessionData: JSON.stringify(serialized), updatedAt: now })
      .onConflictDoUpdate({
        target: igSessions.id,
        set: { sessionData: JSON.stringify(serialized), updatedAt: now },
      });
    cachedIgClient = ig;
    return ig;
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message?.includes("checkpoint_required") || (error as unknown as Record<string, unknown>).name === "IgCheckpointError") {
      const checkpointErr = new Error("Akun Instagram terkena checkpoint / verifikasi keamanan.");
      checkpointErr.name = "IgCheckpointError";
      throw checkpointErr;
    }
    throw error;
  }
}

async function getWebAuthContext(): Promise<{ cookieHeader: string; csrfToken: string; userId: string }> {
  const sid = process.env.IG_SESSIONID?.trim() || "";
  if (!sid) throw new Error("IG_SESSIONID tidak ditemukan di file .env.");
  const userId = sid.split("%3A")[0].split(":")[0];

  // Fetch homepage WITH sessionid so Instagram returns CSRF token for the authenticated session.
  // redirect: "manual" prevents infinite 302 redirect loop (TypeError: fetch failed) when session is expired.
  const homeRes = await fetch("https://www.instagram.com/", {
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Cookie: `sessionid=${sid}; ds_user_id=${userId}`,
    },
  });

  const cookies = homeRes.headers.getSetCookie();
  const isDeleted = cookies.some((c) => c.includes("sessionid=deleted"));
  const location = homeRes.headers.get("location") || "";

  if (isDeleted || location.includes("accounts/login") || location.includes("challenge")) {
    const loginErr = new Error(
      "IG_SESSIONID di file .env sudah kadaluarsa (Instagram menghapus cookie: sessionid=deleted). Silakan buka https://www.instagram.com di browser, login kembali, salin nilai cookie sessionid yang baru, lalu masukkan ke file .env."
    );
    loginErr.name = "IgLoginRequiredError";
    throw loginErr;
  }

  const csrf = cookies.find((c) => c.startsWith("csrftoken="))?.split(";")[0]?.split("=")[1] || "";

  // If IG didn't rotate the CSRF via Set-Cookie, parse it from the page's meta tag
  let resolvedCsrf = csrf;
  if (!resolvedCsrf) {
    const html = await homeRes.text().catch(() => "");
    const match = html.match(/"csrf_token"\s*:\s*"([^"]+)"/);
    resolvedCsrf = match?.[1] || "missing";
  }

  const cookieHeader = `sessionid=${sid}; ds_user_id=${userId}; csrftoken=${resolvedCsrf}`;
  console.log(`[Instagram Web] Auth context: userId=${userId}, csrf=${resolvedCsrf.slice(0, 8)}...`);
  return { cookieHeader, csrfToken: resolvedCsrf, userId };
}

async function uploadPhotoToWeb(
  buffer: Buffer,
  authContext: { cookieHeader: string; csrfToken: string },
  isSidecar = false
): Promise<{ uploadId: string; name: string; width: number; height: number }> {
  const uploadId = Date.now().toString();
  const name = `${uploadId}_0_${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

  // Get image dimensions with sharp
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 1080;
  const height = meta.height ?? 1080;

  const ruploadParams: Record<string, unknown> = {
    upload_id: uploadId,
    media_type: 1,
    image_compression: JSON.stringify({ lib_name: "moz", lib_version: "3.1.m", quality: "80" }),
  };
  if (isSidecar) ruploadParams.is_sidecar = "1";

  const res = await fetch(`https://www.instagram.com/rupload_igphoto/${name}`, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Cookie: authContext.cookieHeader,
      "X-Entity-Type": "image/jpeg",
      Offset: "0",
      "X-Entity-Name": name,
      "X-Entity-Length": buffer.length.toString(),
      "X-Instagram-Rupload-Params": JSON.stringify(ruploadParams),
      "Content-Type": "application/octet-stream",
      "Content-Length": buffer.length.toString(),
      "X-IG-App-ID": "936619743392459",
      "X-ASBD-ID": "129477",
      Referer: "https://www.instagram.com/",
    },
    body: new Uint8Array(buffer),
  });
  const data = (await res.json()) as { status: string };
  if (data.status !== "ok") throw new Error(`Gagal upload foto ke rupload_igphoto: ${JSON.stringify(data)}`);
  return { uploadId, name, width, height };
}

export interface PublishResult {
  mediaId: string;
  code?: string;
}

export interface PublishStoryOptions {
  feedMediaId?: string;
  postCode?: string;
}

export async function publishImage(buffer: Buffer, caption: string): Promise<PublishResult> {
  if (process.env.IG_DEV_MOCK === "true") {
    console.log("[Instagram MOCK] Mode simulasi aktif. Menfess berhasil disimulasikan.");
    return { mediaId: `mock_media_${Date.now()}`, code: "mock_code" };
  }
  if (process.env.IG_SESSIONID?.trim()) {
    const auth = await getWebAuthContext();
    const { uploadId } = await uploadPhotoToWeb(buffer, auth, false);
    const form = new URLSearchParams();
    form.append("upload_id", uploadId);
    form.append("caption", caption);
    form.append("source_type", "4");
    const configRes = await fetch("https://www.instagram.com/api/v1/media/configure/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: auth.cookieHeader,
        "X-CSRFToken": auth.csrfToken,
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.instagram.com/",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const configData = (await configRes.json()) as WebUploadResult;
    if (configData.status !== "ok" || !configData.media) {
      if (configData.message?.includes("checkpoint_required")) {
        const checkpointErr = new Error("Instagram checkpoint_required terdeteksi.");
        checkpointErr.name = "IgCheckpointError";
        throw checkpointErr;
      }
      if (configData.message?.includes("login_required")) {
        const loginErr = new Error("Instagram session expired (login_required).");
        loginErr.name = "IgLoginRequiredError";
        throw loginErr;
      }
      throw new Error(`Konfigurasi media gagal: ${configData.message || JSON.stringify(configData)}`);
    }
    const code = configData.media.code;
    const postCode = code ? ` (https://www.instagram.com/p/${code}/)` : "";
    console.log(`[Instagram Web] Berhasil memposting ke feed: ${configData.media.id}${postCode}`);
    return { mediaId: configData.media.id, code };
  }
  const ig = await getAuthenticatedClient();
  const publishResult = await ig.publish.photo({ file: buffer, caption });
  const code = (publishResult as unknown as { media?: { code?: string } })?.media?.code;
  const postCode = code ? ` (https://www.instagram.com/p/${code}/)` : "";
  console.log(`[Instagram App API] Berhasil memposting foto tunggal: ${publishResult.media.id}${postCode}`);
  return { mediaId: publishResult.media.id, code };
}

export async function publishAlbum(buffers: Buffer[], caption: string): Promise<PublishResult> {
  if (buffers.length === 1) return publishImage(buffers[0], caption);

  if (process.env.IG_DEV_MOCK === "true") {
    console.log(`[Instagram MOCK] Mode simulasi aktif. Album (${buffers.length} slide) berhasil disimulasikan.`);
    return { mediaId: `mock_album_${Date.now()}`, code: "mock_code" };
  }

  // 1. Web session path (proven working via JSON payload on configure_sidecar)
  if (process.env.IG_SESSIONID?.trim()) {
    const auth = await getWebAuthContext();
    const clientSidecarId = Date.now().toString();

    interface ChildUpload {
      uploadId: string;
      width: number;
      height: number;
    }
    const uploadedChildren: ChildUpload[] = [];

    for (let i = 0; i < buffers.length; i++) {
      console.log(`[Instagram Web] Mengupload slide ${i + 1}/${buffers.length}...`);
      const meta = await sharp(buffers[i]).metadata();
      const width = meta.width ?? 1080;
      const height = meta.height ?? 1080;
      const { uploadId } = await uploadPhotoToWeb(buffers[i], auth, true);
      uploadedChildren.push({ uploadId, width, height });

      if (i < buffers.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`[Instagram Web] Mengkonfigurasi carousel dengan ${uploadedChildren.length} slide...`);

    const childrenMetadata = uploadedChildren.map((child) => ({
      upload_id: child.uploadId,
      source_type: "4",
      caption: null,
      timezone_offset: "0",
      extra: JSON.stringify({ source_width: child.width, source_height: child.height }),
      edits: JSON.stringify({
        crop_original_size: [child.width, child.height],
        crop_center: [0.0, -0.0],
        crop_zoom: 1.0,
      }),
      device: JSON.stringify({
        manufacturer: "Google",
        model: "Pixel 6",
        android_version: 31,
        android_release: "12",
      }),
    }));

    const payload = {
      _csrftoken: auth.csrfToken,
      _uid: auth.userId,
      _uuid: "b545d625-f712-4f18-bbd9-95a9b736b42b",
      client_sidecar_id: clientSidecarId,
      upload_id: clientSidecarId,
      caption,
      children_metadata: childrenMetadata,
      source_type: "4",
      timezone_offset: "0",
    };

    const configRes = await fetch("https://www.instagram.com/api/v1/media/configure_sidecar/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: auth.cookieHeader,
        "X-CSRFToken": auth.csrfToken,
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.instagram.com/",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const configData = (await configRes.json()) as WebUploadResult;

    if (configData.status !== "ok" || !configData.media) {
      if (configData.message?.includes("checkpoint_required")) {
        const checkpointErr = new Error("Instagram checkpoint_required terdeteksi.");
        checkpointErr.name = "IgCheckpointError";
        throw checkpointErr;
      }
      if (configData.message?.includes("login_required")) {
        const loginErr = new Error("Instagram session expired (login_required).");
        loginErr.name = "IgLoginRequiredError";
        throw loginErr;
      }
      throw new Error(`Konfigurasi carousel gagal: ${configData.message || JSON.stringify(configData)}`);
    }

    const code = configData.media.code;
    const postCode = code ? ` (https://www.instagram.com/p/${code}/)` : "";
    console.log(`[Instagram Web] Berhasil memposting carousel (${buffers.length} slide): ${configData.media.id}${postCode}`);
    return { mediaId: configData.media.id, code };
  }

  // 2. Fallback: IgApiClient (Mobile App API)
  const ig = await getAuthenticatedClient();

  interface ChildMeta {
    upload_id: string;
    width: number;
    height: number;
  }
  const children: ChildMeta[] = [];

  for (let i = 0; i < buffers.length; i++) {
    console.log(`[Instagram App API] Mengupload slide ${i + 1}/${buffers.length}...`);
    const meta = await sharp(buffers[i]).metadata();
    const width = meta.width ?? 1080;
    const height = meta.height ?? 1080;
    const uploaded = await ig.upload.photo({ file: buffers[i], isSidecar: true });
    children.push({ upload_id: uploaded.upload_id, width, height });
    if (i < buffers.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`[Instagram App API] Mengkonfigurasi carousel dengan ${children.length} slide...`);
  const result = await ig.media.configureSidecar({
    caption,
    children_metadata: children.map(({ upload_id, width, height }) => ({
      upload_id,
      width,
      height,
    })),
  });
  const rawId = result?.media?.id ?? result?.media_id ?? JSON.stringify(result).slice(0, 30);
  const mediaId = rawId.toString();
  const code = (result?.media as unknown as { code?: string })?.code;
  const postCode = code ? ` (https://www.instagram.com/p/${code}/)` : "";
  console.log(`[Instagram App API] Berhasil memposting carousel (${buffers.length} slide): ${mediaId}${postCode}`);
  return { mediaId, code };
}

export function buildCaption(
  recipient?: string | null,
  sender?: string | null,
  menfessId?: number
): string {
  const lines: string[] = [];
  if (recipient) lines.push(`To: ${recipient}`);
  if (sender) lines.push(`From: ${sender}`);
  lines.push("");
  lines.push("Pesan dikirim secara anonim melalui UNJ Menfess.");
  if (menfessId) {
    lines.push(`#menfessunj #unjmenfess #${menfessId}`);
  } else {
    lines.push("#menfessunj #unjmenfess");
  }
  return lines.join("\n").trim();
}

/**
 * Converts a numeric Instagram media ID into a standard shortcode (e.g. De6ta_zmVs0)
 */
export function numericIdToShortcode(numericId: string): string {
  try {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let shortcode = "";
    let n = BigInt(numericId.split("_")[0]);
    const zero = BigInt(0);
    const sixtyFour = BigInt(64);
    while (n > zero) {
      const rem = Number(n % sixtyFour);
      n = n / sixtyFour;
      shortcode = alphabet[rem] + shortcode;
    }
    return shortcode;
  } catch {
    return "";
  }
}

/**
 * Publishes a 1080x1920 vertical image to Instagram Story (SG).
 * Connects the Story directly to the Feed post so tapping opens the original post.
 */
export async function publishStory(
  buffer: Buffer,
  optionsOrFeedMediaId?: string | PublishStoryOptions
): Promise<string> {
  if (process.env.IG_DEV_MOCK === "true") {
    console.log("[Instagram MOCK] Mode simulasi aktif. Story (SG) berhasil disimulasikan.");
    return `mock_story_${Date.now()}`;
  }

  const options: PublishStoryOptions =
    typeof optionsOrFeedMediaId === "string"
      ? { feedMediaId: optionsOrFeedMediaId }
      : optionsOrFeedMediaId || {};

  const feedMediaId = options.feedMediaId;
  const postCode = options.postCode;

  // Instagram requires numeric media_id (strip _userId suffix if present)
  const cleanMediaId = feedMediaId ? feedMediaId.split("_")[0] : undefined;
  const shortcode = postCode || (cleanMediaId ? numericIdToShortcode(cleanMediaId) : undefined);
  const postUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined;

  // 1. Web session path
  if (process.env.IG_SESSIONID?.trim()) {
    const auth = await getWebAuthContext();
    const { uploadId } = await uploadPhotoToWeb(buffer, auth, false);

    const form = new URLSearchParams();
    form.append("upload_id", uploadId);
    form.append("source_type", "3");
    form.append("configure_mode", "1");
    form.append("client_shared_at", Date.now().toString());

    if (cleanMediaId) {
      const mediaStickers = [
        {
          media_id: cleanMediaId,
          x: 0.5,
          y: 0.48,
          width: 0.85,
          height: 0.55,
          rotation: 0.0,
          type: "feed_media",
        },
      ];
      form.append("attached_media", JSON.stringify(mediaStickers));
      form.append("reshared_media_id", cleanMediaId);
      form.append("story_media_stickers", JSON.stringify(mediaStickers));
      form.append("story_sticker_ids", `media_simple_${cleanMediaId}`);
    }

    if (postUrl) {
      form.append("story_cta", JSON.stringify([{ links: [{ webUri: postUrl }] }]));
      form.append(
        "story_link_stickers",
        JSON.stringify([
          {
            x: 0.5,
            y: 0.78,
            z: 0,
            width: 0.5,
            height: 0.08,
            rotation: 0.0,
            url: postUrl,
            link_title: "Lihat Postingan",
            link_type: "weblink",
          },
        ])
      );
    }

    let configRes = await fetch("https://www.instagram.com/api/v1/media/configure_to_story/", {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: auth.cookieHeader,
        "X-CSRFToken": auth.csrfToken,
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "129477",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.instagram.com/",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    let configData = (await configRes.json()) as WebUploadResult;

    // Fallback: If configure with stickers was rejected, re-upload fresh photo buffer and configure cleanly
    if ((configData.status !== "ok" || !configData.media) && (cleanMediaId || postUrl)) {
      console.warn("[Instagram Web] Konfigurasi stiker ditolak. Mengunggah ulang story tanpa stiker metadata...");
      try {
        const { uploadId: retryUploadId } = await uploadPhotoToWeb(buffer, auth, false);
        const simpleForm = new URLSearchParams();
        simpleForm.append("upload_id", retryUploadId);
        simpleForm.append("source_type", "3");
        simpleForm.append("configure_mode", "1");
        simpleForm.append("client_shared_at", Date.now().toString());

        configRes = await fetch("https://www.instagram.com/api/v1/media/configure_to_story/", {
          method: "POST",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Cookie: auth.cookieHeader,
            "X-CSRFToken": auth.csrfToken,
            "X-IG-App-ID": "936619743392459",
            "X-ASBD-ID": "129477",
            "X-Requested-With": "XMLHttpRequest",
            Referer: "https://www.instagram.com/",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: simpleForm.toString(),
        });
        configData = (await configRes.json()) as WebUploadResult;
      } catch (retryErr) {
        console.warn("[Instagram Web] Percobaan fallback upload story gagal:", retryErr);
      }
    }

    if (configData.status !== "ok" || !configData.media) {
      if (configData.message?.includes("checkpoint_required")) {
        const checkpointErr = new Error("Instagram checkpoint_required terdeteksi.");
        checkpointErr.name = "IgCheckpointError";
        throw checkpointErr;
      }
      if (configData.message?.includes("login_required")) {
        const loginErr = new Error("Instagram session expired (login_required).");
        loginErr.name = "IgLoginRequiredError";
        throw loginErr;
      }
      throw new Error(`Konfigurasi story gagal: ${configData.message || JSON.stringify(configData)}`);
    }

    console.log(
      `[Instagram Web] Berhasil memposting ke Story (SG): ${configData.media.id}${
        postUrl ? ` (Tersambung ke ${postUrl})` : ""
      }`
    );
    return configData.media.id;
  }

  // 2. Mobile App API path
  const ig = await getAuthenticatedClient();
  const storyOptions: Record<string, unknown> = { file: buffer };
  const stickerIds: string[] = [];

  if (cleanMediaId) {
    const attachedMedia = {
      media_id: cleanMediaId,
      x: 0.5,
      y: 0.48,
      width: 0.85,
      height: 0.55,
      rotation: 0.0,
    };
    storyOptions.media = attachedMedia;
    storyOptions.attached_media = [attachedMedia];
    storyOptions.reshared_media_id = cleanMediaId;
    stickerIds.push(`media_simple_${cleanMediaId}`);
  }

  if (postUrl) {
    storyOptions.link = postUrl;
    storyOptions.story_cta = [
      {
        links: [{ webUri: postUrl }],
      },
    ];
  }

  if (stickerIds.length > 0) {
    storyOptions.story_sticker_ids = stickerIds.join(",");
  }

  const result = await ig.publish.story(storyOptions as any);
  const mediaId = (result?.media?.id || result?.id || "story_ok").toString();
  console.log(
    `[Instagram App API] Berhasil memposting ke Story (SG): ${mediaId}${
      postUrl ? ` (Tersambung ke ${postUrl})` : ""
    }`
  );
  return mediaId;
}
