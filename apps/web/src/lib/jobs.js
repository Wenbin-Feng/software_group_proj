import { api } from "./api";

// Polls a background job and reports each update, so screens can show live progress.
export async function waitForJob(
  jobId,
  { onUpdate, signal, interval = 700, timeout = 300000, failure } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { job } = await api(`/api/jobs/${jobId}`);
    onUpdate?.(job);
    if (job.status === "failed")
      throw new Error(job.error || failure || "The task could not be completed.");
    if (job.status === "succeeded") return job.result;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return null;
}

export const WIKI_STEPS = [
  { at: 0, label: "Waiting for a free slot" },
  { at: 10, label: "Reading your sources" },
  { at: 20, label: "Writing wiki pages" },
  { at: 75, label: "Linking and saving" },
];
export const VISUAL_STEPS = [
  { at: 0, label: "Waiting for a free slot" },
  { at: 10, label: "Reading your sources" },
  { at: 20, label: "Designing the steps" },
  { at: 85, label: "Building the page" },
];
export const CHAT_STEPS = [
  { at: 0, label: "Searching your sources" },
  { at: 40, label: "Writing the answer" },
];
