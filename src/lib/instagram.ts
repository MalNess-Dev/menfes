import {
  IgApiClient,
  IgCheckpointError,
  IgLoginRequiredError,
} from "instagram-private-api";

export { IgCheckpointError, IgLoginRequiredError };

interface WebUploadResult {
  status: string;
  media?: {
    id: string;
    code: string;
  };
  message?: string;
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
    body: buffer,
  });

  const data = (await res.json()) as { status: string };
  if (data.status !== "ok") {
    throw new Error(`Gagal upload foto ke rupload_igphoto: ${JSON.stringify(data)}`);
  }

  return { uploadId, name };
}

/**
 * Publishes a single image to Instagram using Web endpoints
 */
export async function publishImage(buffer: Buffer, caption: string): Promise<string> {
  const auth = await getWebAuthContext();

  // 1. Upload photo bytes
  const { uploadId } = await uploadPhotoToWeb(buffer, auth, false);

  // 2. Configure media
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
      const checkpointErr = new IgCheckpointError();
      checkpointErr.message = "Instagram checkpoint_required terdeteksi.";
      throw checkpointErr;
    }
    if (configData.message?.includes("login_required")) {
      const loginErr = new IgLoginRequiredError();
      loginErr.message = "Instagram session expired (login_required).";
      throw loginErr;
    }
    throw new Error(`Konfigurasi media gagal: ${configData.message || JSON.stringify(configData)}`);
  }

  const postCode = configData.media.code ? ` (https://www.instagram.com/p/${configData.media.code}/)` : "";
  console.log(`[Instagram] Berhasil memposting ke feed: ${configData.media.id}${postCode}`);
  return configData.media.id;
}

/**
 * Publishes an album / carousel (up to 10 images) to Instagram
 */
export async function publishAlbum(buffers: Buffer[], caption: string): Promise<string> {
  if (buffers.length === 1) {
    return publishImage(buffers[0], caption);
  }

  const auth = await getWebAuthContext();
  const sidecarUploadId = Date.now().toString();
  const childrenMetadata: Array<{ upload_id: string; source_type: string }> = [];

  // 1. Upload each child slide
  for (let i = 0; i < buffers.length; i++) {
    const { uploadId } = await uploadPhotoToWeb(buffers[i], auth, true);
    childrenMetadata.push({
      upload_id: uploadId,
      source_type: "4",
    });
  }

  // 2. Configure sidecar
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
    return configData.media.id;
  }

  // Fallback: If web sidecar API fails, publish first slide with full message caption so the menfess is not lost
  console.warn("[Instagram] Sidecar web configure tidak berhasil, memposting slide utama sebagai foto tunggal...");
  return publishImage(buffers[0], caption);
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
  lines.push("Pesan dikirim secara anonim melalui Simple IG Menfess.");
  if (menfessId) {
    lines.push(`#menfess #${menfessId}`);
  } else {
    lines.push("#menfess");
  }

  return lines.join("\n").trim();
}
