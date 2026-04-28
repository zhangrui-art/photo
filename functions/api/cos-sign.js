const REGION = "ap-nanjing";

async function hmacSha1(key, data) {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const secretId = env.COS_SECRET_ID;
  const secretKey = env.COS_SECRET_KEY;
  const bucket = env.COS_BUCKET;
  const host = `${bucket}.cos.${REGION}.myqcloud.com`;

  const { keys } = await request.json();
  if (!keys || !Array.isArray(keys)) {
    return new Response(JSON.stringify({ error: "Missing keys array" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  const urls = {};
  for (const key of keys) {
    const cosPath = `/${key}`;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7200;
    const keyTime = `${now};${exp}`;
    const signKey = await hmacSha1(secretKey, keyTime);

    const httpString = `get\n${cosPath}\n\n\n`;
    const httpStringHash = await sha1(httpString);
    const stringToSign = `sha1\n${keyTime}\n${httpStringHash}\n`;
    const signature = hexEncode(await hmacSha1(signKey, stringToSign));

    const auth = `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=&q-url-param-list=&q-signature=${signature}`;
    urls[key] = `https://${host}${cosPath}?${auth}`;
  }

  return new Response(JSON.stringify({ urls }), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
