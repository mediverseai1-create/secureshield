"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireApp, type AppContext } from "@/lib/context";
import { logActivity } from "@/lib/data";
import { withCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/plans";
import { GEMINI_MODEL, UNTRUSTED_DATA_RULE, generateJson, isGeminiConfigured, type InlineFile } from "@/lib/gemini";
import { blank } from "@/lib/schemas";
import type { ActionResult, Conversation } from "@/lib/types";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mp3", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", webm: "audio/webm",
};
const TEXT_EXT = ["txt", "vtt", "srt", "md", "text"];

const list = z.array(z.string()).default([]).transform((a) => a.map((s) => s.trim()).filter(Boolean).slice(0, 10));
const analysisOut = z.object({
  transcript: z.string().optional().nullable(),
  summary: z.string().min(1),
  intent: z.string().optional().nullable(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]).optional().nullable(),
  sentiment_reasoning: z.string().optional().nullable(),
  objections: list,
  commitments: list,
  competitors: list,
  decision_criteria: list,
  next_action: z.string().optional().nullable(),
});

const SYSTEM = `You analyse sales conversations for a revenue team. Work ONLY from the conversation provided.
Rules:
- Never invent facts. If the conversation does not support a field, return null (for text fields) or an empty array.
- "summary": 2-4 plain sentences about what was discussed and decided.
- "intent": the buyer's apparent purpose or buying intent, only if stated or clearly implied.
- "sentiment": one of positive, neutral, negative, mixed — about the buyer's attitude toward the deal; explain briefly in "sentiment_reasoning" using what was said.
- "objections": concerns or pushback raised by the buyer, each as a short sentence.
- "commitments": specific promises made by either side (who will do what, by when if stated).
- "competitors": names of competing vendors or alternatives that were explicitly mentioned.
- "decision_criteria": what the buyer said they will use to decide (price, security review, timeline, etc.).
- "next_action": the single most useful next step for the seller, grounded in the conversation.
${UNTRUSTED_DATA_RULE}
Respond with JSON only, matching this shape:
{"transcript": string|null (only when asked to transcribe audio), "summary": string, "intent": string|null, "sentiment": "positive"|"neutral"|"negative"|"mixed"|null, "sentiment_reasoning": string|null, "objections": string[], "commitments": string[], "competitors": string[], "decision_criteria": string[], "next_action": string|null}`;

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";

export async function createConversation(formData: FormData): Promise<ActionResult<{ id: string; analyzed: boolean; warning?: string }>> {
  const app = await requireApp();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Enter a title for the conversation." };
  if (title.length > 200) return { ok: false, error: "The title is too long." };
  const pasted = String(formData.get("transcript") ?? "").trim();
  const file = formData.get("file");
  const analyzeNow = formData.get("analyze") === "on";
  const id = randomUUID();

  let transcript: string | null = pasted || null;
  let storagePath: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;
  let sourceType: "transcript" | "audio" = "transcript";
  let uploadBody: Buffer | null = null;

  if (file instanceof File && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (TEXT_EXT.includes(ext)) {
      if (file.size > MAX_TEXT_BYTES) return { ok: false, error: "Transcript files are limited to 2 MB." };
      transcript = (await file.text()).trim() || transcript;
      fileName = file.name;
    } else if (AUDIO_TYPES[ext]) {
      if (file.size > MAX_AUDIO_BYTES) return { ok: false, error: "Audio files are limited to 12 MB. Compress the recording or upload a transcript instead." };
      sourceType = "audio";
      mimeType = AUDIO_TYPES[ext];
      fileName = file.name;
      fileSize = file.size;
      storagePath = `${app.org.id}/${id}/${safeName(file.name)}`;
      uploadBody = Buffer.from(await file.arrayBuffer());
    } else {
      return { ok: false, error: "Unsupported file type. Upload a transcript (.txt, .vtt, .srt, .md) or audio (.mp3, .wav, .m4a, .aac, .ogg, .flac, .webm)." };
    }
  }
  if (!transcript && !storagePath) return { ok: false, error: "Paste a transcript or upload a transcript or audio file." };
  if (transcript && transcript.length > 200_000) return { ok: false, error: "The transcript is too long (200,000 characters max)." };
  if (transcript && transcript.length < 40 && !storagePath) return { ok: false, error: "The transcript is too short to analyse." };

  if (uploadBody && storagePath) {
    const { error } = await app.supabase.storage.from("conversation-files").upload(storagePath, uploadBody, { contentType: mimeType ?? undefined, upsert: false });
    if (error) return { ok: false, error: "The recording could not be stored. Please try again." };
  }

  const { error } = await app.supabase.from("conversations").insert({
    id,
    org_id: app.org.id,
    title,
    source_type: sourceType,
    transcript: storagePath ? null : transcript,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType,
    file_size: fileSize,
    account_id: blank(String(formData.get("account_id") ?? "")),
    opportunity_id: blank(String(formData.get("opportunity_id") ?? "")),
    participants: blank(String(formData.get("participants") ?? "")),
    occurred_at: formData.get("occurred_at") ? new Date(`${String(formData.get("occurred_at"))}T12:00:00Z`).toISOString() : new Date().toISOString(),
  });
  if (error) {
    if (storagePath) await app.supabase.storage.from("conversation-files").remove([storagePath]);
    return { ok: false, error: error.message.includes("foreign key") ? "The selected account or opportunity does not exist in this workspace." : "The conversation could not be saved." };
  }
  await logActivity(app.supabase, app.org.id, app.userId, "conversation.created", `Added conversation “${title}”`, "conversation", id);
  revalidatePath("/conversations");

  if (!analyzeNow) return { ok: true, id, analyzed: false };
  const r = await runAnalysis(app, id);
  return r.ok ? { ok: true, id, analyzed: true } : { ok: true, id, analyzed: false, warning: r.error };
}

export async function analyzeConversation(id: string): Promise<ActionResult> {
  const app = await requireApp();
  return runAnalysis(app, id);
}

async function runAnalysis(app: AppContext, id: string): Promise<ActionResult> {
  if (!isGeminiConfigured()) return { ok: false, error: "AI analysis is not configured for this deployment yet." };
  const { data: conv } = await app.supabase.from("conversations").select("*").eq("id", id).eq("org_id", app.org.id).maybeSingle<Conversation>();
  if (!conv) return { ok: false, error: "Conversation not found." };

  const [account, opp] = await Promise.all([
    conv.account_id ? app.supabase.from("accounts").select("name").eq("id", conv.account_id).maybeSingle() : Promise.resolve({ data: null }),
    conv.opportunity_id ? app.supabase.from("opportunities").select("name,stage,amount").eq("id", conv.opportunity_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const context = [
    `Title: ${conv.title}`,
    conv.participants ? `Participants: ${conv.participants}` : null,
    account.data ? `Account: ${(account.data as { name: string }).name}` : null,
    opp.data ? `Opportunity: ${(opp.data as { name: string }).name} (stage ${(opp.data as { stage: string }).stage})` : null,
  ].filter(Boolean).join("\n");

  const result = await withCredits(
    app.supabase,
    app.org.id,
    "conversation_analysis",
    async () => {
      if (conv.source_type === "audio" && conv.storage_path) {
        const { data: blob, error } = await app.supabase.storage.from("conversation-files").download(conv.storage_path);
        if (error || !blob) throw new Error("The recording could not be read from storage.");
        const file: InlineFile = { mimeType: conv.mime_type ?? "audio/mp3", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") };
        return generateJson(
          {
            system: SYSTEM,
            file,
            prompt: `${context}\n\nThe attached audio is a recorded sales conversation. First transcribe it faithfully into "transcript" (label speakers if you can tell them apart), then analyse it.`,
          },
          analysisOut,
        );
      }
      return generateJson(
        { system: SYSTEM, prompt: `${context}\n\n<transcript>\n${(conv.transcript ?? "").slice(0, 120_000)}\n</transcript>` },
        analysisOut,
      );
    },
    { description: `Analysis: ${conv.title}`, metadata: { conversation_id: id } },
  );

  if (!result.ok) {
    await app.supabase.from("conversations").update({ status: "failed", error: result.error }).eq("id", id).eq("org_id", app.org.id);
    revalidatePath("/conversations");
    revalidatePath(`/conversations/${id}`);
    return { ok: false, error: result.error };
  }

  const a = result.data;
  const { error } = await app.supabase.from("conversation_analyses").upsert(
    {
      org_id: app.org.id,
      conversation_id: id,
      summary: a.summary,
      intent: a.intent ?? null,
      sentiment: a.sentiment ?? null,
      sentiment_reasoning: a.sentiment_reasoning ?? null,
      objections: a.objections,
      commitments: a.commitments,
      competitors: a.competitors,
      decision_criteria: a.decision_criteria,
      next_action: a.next_action ?? null,
      model: GEMINI_MODEL,
      credits_used: CREDIT_COSTS.conversation_analysis,
    },
    { onConflict: "conversation_id" },
  );
  if (error) return { ok: false, error: "The analysis finished but could not be saved. Please try again." };

  await app.supabase
    .from("conversations")
    .update({ status: "analyzed", error: null, ...(conv.source_type === "audio" && a.transcript ? { transcript: a.transcript } : {}) })
    .eq("id", id)
    .eq("org_id", app.org.id);
  await logActivity(app.supabase, app.org.id, app.userId, "conversation.analyzed", `Analysed conversation “${conv.title}”`, "conversation", id, { credits: CREDIT_COSTS.conversation_analysis });
  revalidatePath("/conversations");
  revalidatePath(`/conversations/${id}`);
  revalidatePath("/usage");
  return { ok: true };
}

export async function deleteConversation(id: string): Promise<ActionResult> {
  const app = await requireApp();
  const { data: conv } = await app.supabase.from("conversations").select("storage_path,title").eq("id", id).eq("org_id", app.org.id).maybeSingle();
  const { data, error } = await app.supabase.from("conversations").delete().eq("id", id).eq("org_id", app.org.id).select("id");
  if (error) return { ok: false, error: "The conversation could not be deleted." };
  if (!data?.length) return { ok: false, error: "Only owners and admins can delete conversations." };
  if (conv?.storage_path) await app.supabase.storage.from("conversation-files").remove([conv.storage_path as string]);
  await logActivity(app.supabase, app.org.id, app.userId, "conversation.deleted", `Deleted conversation “${conv?.title ?? ""}”`, "conversation", id);
  revalidatePath("/conversations");
  return { ok: true };
}
