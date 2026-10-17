export async function saveOriginal(id, file, context = {}) {
  const response = await fetch(
    `/api/materials/${encodeURIComponent(id)}/original?courseId=${encodeURIComponent(context.courseId || "")}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body: file,
    },
  );
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(
      detail.message ||
        detail.error ||
        "The original file could not be uploaded.",
    );
  }
  const result = await response.json();
  if (response.status === 202) {
    for (let count = 0; count < 240; count++) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      const status = await fetch(
        `/api/materials/${encodeURIComponent(id)}/processing`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const value = await status.json();
      if (!status.ok)
        throw new Error(value.error || "The document could not be processed.");
      if (value.job.status === "failed")
        throw new Error(value.job.error || "The document could not be parsed.");
      if (value.job.status === "succeeded")
        return { metadata: value.job.metadata };
    }
    throw new Error(
      "The document is still processing. Please try again shortly.",
    );
  }
  return result;
}
export async function getOriginal(id) {
  const response = await fetch(
    `/api/materials/${encodeURIComponent(id)}/original`,
    { credentials: "same-origin", cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error("The original file could not be downloaded.");
  const blob = await response.blob();
  return new File(
    [blob],
    decodeURIComponent(response.headers.get("x-file-name") || "material"),
    { type: blob.type },
  );
}
