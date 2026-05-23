import fs from "node:fs/promises";

const APP_URL = process.env.APP_URL || "https://ai-doc-studio.vercel.app";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PDF_PATH = process.env.PDF_PATH;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const MAX_ATTEMPTS = Number.parseInt(process.env.MAX_ATTEMPTS || "25", 10);

if (!ACCESS_TOKEN) {
  throw new Error("Missing ACCESS_TOKEN");
}

if (!PDF_PATH) {
  throw new Error("Missing PDF_PATH");
}

if (!Number.isInteger(MAX_ATTEMPTS) || MAX_ATTEMPTS < 1) {
  throw new Error("MAX_ATTEMPTS must be a positive integer");
}

const pdfBuffer = await fs.readFile(PDF_PATH);
const fileName = PDF_PATH.split("/").pop() || "rate-limit-test.pdf";
const mimeType = "application/pdf";

async function parseResponse(response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  return { response, data: await parseResponse(response) };
}

function buildSignedUploadUrl(signedUpload) {
  if (signedUpload?.signedUrl) {
    return signedUpload.signedUrl;
  }

  if (SUPABASE_URL && signedUpload?.path && signedUpload?.token) {
    return `${SUPABASE_URL}/storage/v1/object/upload/sign/${signedUpload.path}?token=${signedUpload.token}`;
  }

  return null;
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  console.log(`\n=== Attempt ${attempt}/${MAX_ATTEMPTS} ===`);

  const create = await postJson(`${APP_URL}/api/uploads/create`, {
    fileName,
    fileSize: pdfBuffer.byteLength,
    mimeType,
  });

  console.log("create status:", create.response.status);

  if (!create.response.ok) {
    console.log("create body:", create.data);
    process.exit(1);
  }

  const { documentId, signedUpload } = create.data ?? {};
  const uploadUrl = buildSignedUploadUrl(signedUpload);

  if (!documentId) {
    throw new Error("Missing documentId in /api/uploads/create response");
  }

  if (!uploadUrl) {
    throw new Error("Missing signed upload URL. Set SUPABASE_URL if needed.");
  }

  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", new Blob([pdfBuffer], { type: mimeType }), fileName);

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: form,
  });

  console.log("upload status:", upload.status);

  if (!upload.ok) {
    console.log("upload body:", await parseResponse(upload));
    process.exit(1);
  }

  const reconstruct = await postJson(`${APP_URL}/api/documents/reconstruct`, {
    documentId,
  });

  const headers = reconstruct.response.headers;
  console.log("reconstruct status:", reconstruct.response.status);
  console.log("x-request-id:", headers.get("x-request-id"));
  console.log("x-ratelimit-limit:", headers.get("x-ratelimit-limit"));
  console.log("x-ratelimit-remaining:", headers.get("x-ratelimit-remaining"));
  console.log("retry-after:", headers.get("retry-after"));

  if (reconstruct.response.status === 429) {
    console.log("429 body:", reconstruct.data);
    console.log("\nRate limit is working.");
    process.exit(0);
  }

  if (!reconstruct.response.ok) {
    console.log("unexpected reconstruct body:", reconstruct.data);
    process.exit(1);
  }

  console.log("reconstruct body: success");
}

console.log(`\nNo 429 after ${MAX_ATTEMPTS} attempts. Investigate limiter behavior.`);
process.exit(2);
