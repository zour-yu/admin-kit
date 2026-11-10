import { z } from "zod";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { AdminKitConfig } from "@admin-kit/core";

export const BadgeColorSchema = z.enum(["gray", "red", "yellow", "green", "blue", "purple"]);

export const ColumnEnrichmentSchema = z.object({
  key: z.string().describe("Exact column key corresponding to the resource table column"),
  label: z.string().optional().describe("Human-readable title/label (e.g. 'created_at' -> 'Created At')"),
  sensitive: z.boolean().optional().describe("Set to true if this field represents sensitive PII or credentials (password, token, ssn, secret, tax_id)"),
  badge_map: z.record(z.string(), BadgeColorSchema).optional().describe("Semantic badge color mapping for enum/status values (e.g. pending -> yellow, approved -> green, rejected -> red)"),
  hidden_by_default: z.boolean().optional().describe("Set to true for secondary metadata if the resource has many columns"),
});

export const ActionEnrichmentSchema = z.object({
  name: z.string().describe("Exact name of the custom action (e.g. approve, reject)"),
  visible_if: z.string().optional().describe("Conditional visibility expression based on row status (e.g. \"row.status == 'pending'\")"),
  style: z.enum(["primary", "secondary", "success", "danger", "warning"]).optional().describe("Semantic button styling (success for approve, danger for reject/delete, warning for suspend)"),
  confirm_dialog: z.object({
    title: z.string().describe("Dialog title for confirmation prompt"),
    message: z.string().describe("Human-readable confirmation warning explanation"),
    confirm_text: z.string().optional(),
    cancel_text: z.string().optional(),
  }).optional().describe("Confirmation prompt for state-changing or destructive actions"),
});

export const ResourceEnrichmentSchema = z.object({
  resource_key: z.string().describe("Exact resource key from the base configuration"),
  label: z.string().optional().describe("Human-readable resource label"),
  columns: z.array(ColumnEnrichmentSchema).optional().describe("Enriched column configurations"),
  actions: z.array(ActionEnrichmentSchema).optional().describe("Enriched custom action configurations"),
});

export const AiEnrichmentPayloadSchema = z.object({
  resources: z.array(ResourceEnrichmentSchema).describe("List of resource enrichments"),
});

export type AiEnrichmentPayload = z.infer<typeof AiEnrichmentPayloadSchema>;

export interface AiSynthesisOptions {
  apiKey?: string;
  modelName?: string;
}

/**
 * Builds a structured, compact summary of the deterministic schema to pass to the LLM.
 */
function buildSchemaSummary(config: AdminKitConfig): string {
  const summary: Record<string, any> = {};

  for (const [key, res] of Object.entries(config.resources || {})) {
    summary[key] = {
      label: res.label,
      endpoint: res.endpoint,
      columns: (res.table?.columns || []).map((col) => ({
        key: col.key,
        type: col.type,
        current_label: col.label,
        current_badge_map: col.badge_map,
        sensitive: col.sensitive,
      })),
      actions: (res.actions || []).map((act) => ({
        name: act.name,
        endpoint: act.api?.endpoint,
        method: act.api?.method,
        current_visible_if: act.visible_if,
        inputs: (act.inputs || []).map((inp) => ({ key: inp.key, type: inp.type })),
      })),
    };
  }

  return JSON.stringify(summary, null, 2);
}

/**
 * Enriches deterministic AdminKitConfig using Gemini structured outputs.
 */
export async function synthesizeAiEnrichment(
  baseConfig: AdminKitConfig,
  options: AiSynthesisOptions = {}
): Promise<AdminKitConfig> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn(
      "[admin-kit/ai] ⚠️ GEMINI_API_KEY not found in environment. Falling back to deterministic configuration without failing."
    );
    return baseConfig;
  }

  try {
    console.log(`[admin-kit/ai] Synthesizing operational schema intelligence with Google Gemini...`);

    const google = createGoogleGenerativeAI({ apiKey });
    const model = google(options.modelName || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite");

    const schemaSummary = buildSchemaSummary(baseConfig);

    const prompt = `
You are an expert admin dashboard engineer enriching an OpenAPI-derived schema for AdminKit Studio.
Below is the deterministically parsed schema summary:

${schemaSummary}

Please analyze this schema and provide operational enrichments:
1. Map status/state enum values to semantic colors:
   - "green" for positive/completed/approved/active states
   - "yellow" for pending/processing/review/draft states
   - "red" for rejected/failed/banned/cancelled/fraud states
   - "gray" or "blue" for neutral/informational states
2. Derive "visible_if" conditional expressions for custom row actions based on status columns (e.g. row.status == 'pending').
3. Assign semantic action styles:
   - "success" for approve, verify, activate
   - "danger" for reject, delete, ban, cancel
   - "warning" for suspend, flag, escalate
4. Generate human-readable "confirm_dialog" prompts for state-mutating actions (e.g. "Approve Refund?", "Are you sure you want to approve this refund?").
5. Flag sensitive keys (password, token, ssn, secret, tax_id, secret_key) with sensitive: true.
6. Suggest clean, readable column labels where property keys are snake_case (e.g. "created_at" -> "Created At", "user_id" -> "User").

IMPORTANT GUARDRAIL: Do not invent any new resources or action names. Only enrich the exact resource_keys and action names present in the summary.
`;

    const result = await generateObject({
      model,
      schema: AiEnrichmentPayloadSchema,
      prompt,
    });

    const enrichment = result.object;
    return deepMergeAiEnrichment(baseConfig, enrichment);
  } catch (err: any) {
    console.warn(
      `[admin-kit/ai] ⚠️ AI synthesis failed (${err.message || err}). Safely falling back to deterministic configuration.`
    );
    return baseConfig;
  }
}

/**
 * Deep-merges the AI's enrichment fields back into the base configuration.
 * Adheres strictly to guardrails: never hallucinates endpoints or overrides structural contracts.
 */
export function deepMergeAiEnrichment(
  baseConfig: AdminKitConfig,
  enrichment: AiEnrichmentPayload
): AdminKitConfig {
  const merged: AdminKitConfig = JSON.parse(JSON.stringify(baseConfig));

  for (const resEnrich of enrichment.resources || []) {
    const targetResource = merged.resources?.[resEnrich.resource_key];
    if (!targetResource) {
      // Guardrail: Skip hallucinated resources
      continue;
    }

    if (resEnrich.label) {
      targetResource.label = resEnrich.label;
    }

    // Merge columns
    if (resEnrich.columns && targetResource.table?.columns) {
      for (const colEnrich of resEnrich.columns) {
        const targetCol = targetResource.table.columns.find((c) => c.key === colEnrich.key);
        if (!targetCol) continue;

        if (colEnrich.label) {
          targetCol.label = colEnrich.label;
        }

        if (colEnrich.sensitive !== undefined) {
          targetCol.sensitive = colEnrich.sensitive;
        }

        if (colEnrich.hidden_by_default !== undefined) {
          targetCol.hidden_by_default = colEnrich.hidden_by_default;
        }

        if (colEnrich.badge_map && Object.keys(colEnrich.badge_map).length > 0) {
          targetCol.type = "badge";
          targetCol.badge_map = {
            ...(targetCol.badge_map || {}),
            ...colEnrich.badge_map,
          };
        }
      }
    }

    // Merge actions
    if (resEnrich.actions && targetResource.actions) {
      for (const actEnrich of resEnrich.actions) {
        const targetAct = targetResource.actions.find((a) => a.name === actEnrich.name);
        if (!targetAct) continue;

        if (actEnrich.visible_if) {
          targetAct.visible_if = actEnrich.visible_if;
        }

        if (actEnrich.style) {
          targetAct.style = actEnrich.style;
        }

        if (actEnrich.confirm_dialog) {
          targetAct.confirm_dialog = {
            title: actEnrich.confirm_dialog.title,
            message: actEnrich.confirm_dialog.message,
            confirm_text: actEnrich.confirm_dialog.confirm_text || "Confirm",
            cancel_text: actEnrich.confirm_dialog.cancel_text || "Cancel",
          };
        }
      }
    }
  }

  return merged;
}

