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

export async function onRequestGet(context) {
  const { env } = context;
  const secretId = env.COS_SECRET_ID;
  const secretKey = env.COS_SECRET_KEY;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 1800;
  const keyTime = `${now};${exp}`;
  const signKey = hexEncode(await hmacSha1(secretKey, keyTime));

  return new Response(JSON.stringify({
    secretId,
    signKey,
    keyTime,
    bucket: env.COS_BUCKET,
    region: REGION,
  }), {
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
