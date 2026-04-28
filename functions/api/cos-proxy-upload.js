const REGION = "ap-nanjing";

async function hmacSha1(key, data) {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function hexEncode(arr) {
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha1(data) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(data));
  return hexEncode(new Uint8Array(buf));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-COS-Key",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const secretId = env.COS_SECRET_ID;
    const secretKey = env.COS_SECRET_KEY;
    const bucket = env.COS_BUCKET;

    if (!secretId || !secretKey || !bucket) {
      return new Response(JSON.stringify({
        error: "Missing env vars",
        has_id: !!secretId,
        has_key: !!secretKey,
        has_bucket: !!bucket,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const host = `${bucket}.cos.${REGION}.myqcloud.com`;

    const cosKey = request.headers.get("X-COS-Key");
    if (!cosKey) {
      return new Response(JSON.stringify({ error: "Missing X-COS-Key header" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const body = await request.arrayBuffer();
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";

    const cosPath = `/${cosKey}`;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7200;
    const keyTime = `${now};${exp}`;
    const signKey = hexEncode(await hmacSha1(secretKey, keyTime));

    const httpString = `put\n${cosPath}\n\n\n`;
    const httpStringHash = await sha1(httpString);
    const stringToSign = `sha1\n${keyTime}\n${httpStringHash}\n`;
    const signature = hexEncode(await hmacSha1(signKey, stringToSign));

    const auth = `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=&q-url-param-list=&q-signature=${signature}`;

    const cosUrl = `https://${host}${cosPath}`;

    const cosResponse = await fetch(cosUrl, {
      method: "PUT",
      headers: {
        Authorization: auth,
        "Content-Type": contentType,
        "Content-Length": body.byteLength.toString(),
      },
      body: body,
    });

    if (!cosResponse.ok) {
      const errorText = await cosResponse.text();
      return new Response(JSON.stringify({
        error: "COS rejected the request",
        status: cosResponse.status,
        detail: errorText,
        debug: { cosUrl, cosPath, bodySize: body.byteLength },
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: "Unexpected error in proxy",
      message: e.message,
      stack: e.stack,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }
}
