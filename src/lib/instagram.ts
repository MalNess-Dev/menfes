import {
  IgApiClient,
  IgCheckpointError,
  IgLoginRequiredError,
} from "instagram-private-api";
import { prisma } from "./prisma";
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
    const savedSession = await prisma.igSession.findUnique({ where: { id: 1 } });
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
    await prisma.igSession.upsert({
      where: { id: 1 },
      update: { sessionData: JSON.stringify(serialized) },
      create: { id: 1, sessionData: JSON.stringify(serialized) },
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
  // Without this, you get an anonymous CSRF token which causes HTTP 500 on sidecar configure.
  const homeRes = await fetch("https://www.instagram.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Cookie: `sessionid=${sid}; ds_user_id=${userId}`,
    },
  });
  const cookies = homeRes.headers.getSetCookie();
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

export async function publishImage(buffer: Buffer, caption: string): Promise<string> {
  if (process.env.IG_DEV_MOCK === "true") {
    console.log("[Instagram MOCK] Mode simulasi aktif. Menfess berhasil disimulasikan.");
    return `mock_media_${Date.now()}`;
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
    const postCode = configData.media.code ? ` (https://www.instagram.com/p/${configData.media.code}/)` : "";
    console.log(`[Instagram Web] Berhasil memposting ke feed: ${configData.media.id}${postCode}`);
    return configData.media.id;
  }
  const ig = await getAuthenticatedClient();
  const publishResult = await ig.publish.photo({ file: buffer, caption });
  console.log(`[Instagram App API] Berhasil memposting foto tunggal: ${publishResult.media.id}`);
  return publishResult.media.id;
}

export async function publishAlbum(buffers: Buffer[], caption: string): Promise<string> {
  if (buffers.length === 1) return publishImage(buffers[0], caption);

  if (process.env.IG_DEV_MOCK === "true") {
    console.log(`[Instagram MOCK] Mode simulasi aktif. Album (${buffers.length} slide) berhasil disimulasikan.`);
    return `mock_album_${Date.now()}`;
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

    const postCode = configData.media.code ? ` (https://www.instagram.com/p/${configData.media.code}/)` : "";
    console.log(`[Instagram Web] Berhasil memposting carousel (${buffers.length} slide): ${configData.media.id}${postCode}`);
    return configData.media.id;
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
  const mediaId = result?.media?.id ?? result?.media_id ?? JSON.stringify(result).slice(0, 30);
  const postCode = result?.media?.code ? ` (https://www.instagram.com/p/${result.media.code}/)` : "";
  console.log(`[Instagram App API] Berhasil memposting carousel (${buffers.length} slide): ${mediaId}${postCode}`);
  return mediaId;
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
