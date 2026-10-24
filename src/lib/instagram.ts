import {
  IgApiClient,
  IgCheckpointError,
  IgLoginRequiredError,
} from "instagram-private-api";
import { prisma } from "./prisma";

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

/**
 * Returns an authenticated IgApiClient using IG_USERNAME and IG_PASSWORD
 */
async function getAuthenticatedClient(): Promise<IgApiClient> {
  if (cachedIgClient) {
    return cachedIgClient;
  }

  const username = process.env.IG_USERNAME?.trim();
  const password = process.env.IG_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error(
      "Kredensial Instagram tidak ditemukan. Harap isi IG_USERNAME & IG_PASSWORD atau IG_SESSIONID di file .env."
    );
  }

  const ig = new IgApiClient();
  ig.state.generateDevice(username);

  // 1. Try restoring existing session from database
  try {
    const savedSession = await prisma.igSession.findUnique({ where: { id: 1 } });
    if (savedSession?.sessionData) {
      await ig.state.deserialize(JSON.parse(savedSession.sessionData));
      // Test if session is still valid
      await ig.user.info(ig.state.cookieUserId);
      console.log("[Instagram API] Berhasil memulihkan sesi tersimpan untuk @" + username);
      cachedIgClient = ig;
      return ig;
    }
  } catch {
    console.log("[Instagram API] Sesi tersimpan kadaluarsa atau tidak valid. Melakukan login baru...");
  }

  // 2. Perform fresh login
  console.log(`[Instagram API] Melakukan login ke akun Instagram: @${username}...`);
  try {
    await ig.account.login(username, password);
    console.log(`[Instagram API] Login berhasil sebagai @${username}`);

    // 3. Save new session to database
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
    if (
      error.message?.includes("checkpoint_required") ||
      (error as unknown as Record<string, unknown>).name === "IgCheckpointError"
    ) {
      const checkpointErr = new Error("Akun Instagram terkena checkpoint / verifikasi keamanan.");
      checkpointErr.name = "IgCheckpointError";
      throw checkpointErr;
    }
    throw error;
  }
}

/**
 * Gets fresh CSRF token and cookie headers for Instagram Web requests
 */
async function getWebAuthContext(): Promise<{
  cookieHeader: string;
  csrfToken: string;
  userId: string;
}> {
  const sid = process.env.IG_SESSIONID?.trim() || "";
  if (!sid) {
    throw new Error("IG_SESSIONID tidak ditemukan di file .env.");
  }

  const userId = sid.split("%3A")[0].split(":")[0];

  // Fetch CSRF token from web home
  const homeRes = await fetch("https://www.instagram.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const cookies = homeRes.headers.getSetCookie();
  const csrf =
    cookies.find((c) => c.startsWith("csrftoken="))?.split(";")[0]?.split("=")[1] ||
    "missing";

  const cookieHeader = `sessionid=${sid}; ds_user_id=${userId}; csrftoken=${csrf}`;

  return {
    cookieHeader,
    csrfToken: csrf,
    userId,
  };
}

/**
 * Uploads a single image buffer to Instagram Web rupload endpoint
 */
async function uploadPhotoToWeb(
  buffer: Buffer,
  authContext: { cookieHeader: string; csrfToken: string },
  isSidecar = false
): Promise<{ uploadId: string; name: string }> {
  const uploadId = Date.now().toString();
  const name = `${uploadId}_0_${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

  const ruploadParams: Record<string, unknown> = {
    upload_id: uploadId,
    media_type: 1,
    image_compression: JSON.stringify({ lib_name: "moz", lib_version: "3.1.m", quality: "80" }),
  };

  if (isSidecar) {
    ruploadParams.is_sidecar = "1";
  }

  const res = await fetch(`https://www.instagram.com/rupload_igphoto/${name}`, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
  if (data.status !== "ok") {
    throw new Error(`Gagal upload foto ke rupload_igphoto: ${JSON.stringify(data)}`);
  }

  return { uploadId, name };
}

/**
 * Publishes a single image to Instagram
 */
export async function publishImage(buffer: Buffer, caption: string): Promise<string> {
  // 1. Mock simulation mode if enabled in .env
  if (process.env.IG_DEV_MOCK === "true") {
    console.log("[Instagram MOCK] Mode simulasi aktif. Menfess berhasil disimulasikan.");
    return `mock_media_${Date.now()}`;
  }

  // 2. If IG_SESSIONID is provided, use Web endpoints
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

  // 3. Fallback: Use IgApiClient with IG_USERNAME & IG_PASSWORD
  const ig = await getAuthenticatedClient();
  const publishResult = await ig.publish.photo({
    file: buffer,
    caption,
  });

  console.log(`[Instagram App API] Berhasil memposting foto tunggal: ${publishResult.media.id}`);
  return publishResult.media.id;
}

/**
 * Publishes an album / carousel (up to 10 images) to Instagram
 */
export async function publishAlbum(buffers: Buffer[], caption: string): Promise<string> {
  if (buffers.length === 1) {
    return publishImage(buffers[0], caption);
  }

  // 1. Mock simulation mode if enabled in .env
  if (process.env.IG_DEV_MOCK === "true") {
    console.log(`[Instagram MOCK] Mode simulasi aktif. Album (${buffers.length} slide) berhasil disimulasikan.`);
    return `mock_album_${Date.now()}`;
  }

  // 2. If IG_SESSIONID is provided, use Web endpoints
  if (process.env.IG_SESSIONID?.trim()) {
    const auth = await getWebAuthContext();
    const sidecarUploadId = Date.now().toString();
    const childrenMetadata: Array<{ upload_id: string; source_type: string }> = [];

    for (let i = 0; i < buffers.length; i++) {
      const { uploadId } = await uploadPhotoToWeb(buffers[i], auth, true);
      childrenMetadata.push({
        upload_id: uploadId,
        source_type: "4",
      });
    }

    const form = new URLSearchParams();
    form.append("client_sidecar_id", sidecarUploadId);
    form.append("upload_id", sidecarUploadId);
    form.append("caption", caption);
    form.append("children_metadata", JSON.stringify(childrenMetadata));
    form.append("source_type", "4");

    const configRes = await fetch("https://www.instagram.com/api/v1/media/configure_sidecar/", {
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

    const configData = (await configRes.json()) as WebUploadResult;

    if (configData.status === "ok" && configData.media) {
      console.log(`[Instagram Web] Berhasil memposting carousel: ${configData.media.id}`);
      return configData.media.id;
    }

    console.warn("[Instagram] Sidecar web configure gagal, mencoba foto tunggal...");
    return publishImage(buffers[0], caption);
  }

  // 3. Fallback: Use IgApiClient with IG_USERNAME & IG_PASSWORD
  const ig = await getAuthenticatedClient();
  const albumResult = await ig.publish.album({
    items: buffers.map((b) => ({ file: b })),
    caption,
  });

  console.log(`[Instagram App API] Berhasil memposting carousel (${buffers.length} slide): ${albumResult.media.id}`);
  return albumResult.media.id;
}

/**
 * Generates a clean caption according to the PRD
 */
export function buildCaption(
  recipient?: string | null,
  sender?: string | null,
  menfessId?: number
): string {
  const lines: string[] = [];

  if (recipient) {
    lines.push(`To: ${recipient}`);
  }
  if (sender) {
    lines.push(`From: ${sender}`);
  }

  lines.push("");
  lines.push("Pesan dikirim secara anonim melalui UNJ Menfess.");
  if (menfessId) {
    lines.push(`#menfessunj #unjmenfess #${menfessId}`);
  } else {
    lines.push("#menfessunj #unjmenfess");
  }

  return lines.join("\n").trim();
}
