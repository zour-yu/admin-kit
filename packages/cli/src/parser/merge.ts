import type { AdminKitConfig, ResourceConfig } from "@admin-kit/core";

export interface MergeResult {
  mergedConfig: AdminKitConfig;
  warnings: string[];
  addedResources: string[];
  addedColumns: string[];
  addedActions: string[];
}

/**
 * Performs a non-destructive three-way merge between an existing user-customized config
 * and a newly introspected OpenAPI configuration per docs/CLI_SPEC.md Section 5.
 *
 * Rules:
 * - New endpoints/columns/actions: Appended.
 * - User-modified properties (labels, access, visible_if, badge_map, styles): Preserved.
 * - Removed endpoints: Kept with a [WARN] notice rather than silently deleting.
 */
export function mergeConfigs(
  existingConfig: AdminKitConfig,
  newConfig: AdminKitConfig
): MergeResult {
  const merged: AdminKitConfig = JSON.parse(JSON.stringify(existingConfig));
  const warnings: string[] = [];
  const addedResources: string[] = [];
  const addedColumns: string[] = [];
  const addedActions: string[] = [];

  // Update project metadata only if not customized
  if (!merged.project.name && newConfig.project.name) {
    merged.project.name = newConfig.project.name;
  }
  if (!merged.project.base_url && newConfig.project.base_url) {
    merged.project.base_url = newConfig.project.base_url;
  }

  // 1. Merge Resources from newConfig into existingConfig
  for (const [resKey, newRes] of Object.entries(newConfig.resources || {})) {
    const existingRes: ResourceConfig | undefined = merged.resources?.[resKey];

    if (!existingRes) {
      // New resource discovered
      if (!merged.resources) merged.resources = {};
      merged.resources[resKey] = JSON.parse(JSON.stringify(newRes));
      addedResources.push(resKey);
      continue;
    }

    // Existing resource: Preserve user-tweaked labels and access
    if (newRes.endpoint && !existingRes.endpoint) {
      existingRes.endpoint = newRes.endpoint;
    }

    // Merge columns
    if (newRes.table?.columns) {
      if (!existingRes.table) {
        existingRes.table = JSON.parse(JSON.stringify(newRes.table));
      } else {
        const existingColKeys = new Set(existingRes.table.columns.map((c) => c.key));

        for (const newCol of newRes.table.columns) {
          if (!existingColKeys.has(newCol.key)) {
            // New column discovered
            existingRes.table.columns.push(JSON.parse(JSON.stringify(newCol)));
            addedColumns.push(`${resKey}.${newCol.key}`);
          } else {
            // Existing column: only fill missing properties without overriding user customizations
            const existingCol = existingRes.table.columns.find((c) => c.key === newCol.key)!;
            if (!existingCol.type && newCol.type) existingCol.type = newCol.type;
            if (existingCol.badge_map === undefined && newCol.badge_map) {
              existingCol.badge_map = newCol.badge_map;
            }
            if (existingCol.relation === undefined && newCol.relation) {
              existingCol.relation = newCol.relation;
            }
          }
        }
      }
    }

    // Merge custom actions
    if (newRes.actions) {
      if (!existingRes.actions) {
        existingRes.actions = JSON.parse(JSON.stringify(newRes.actions));
      } else {
        const existingActionNames = new Set(existingRes.actions.map((a) => a.name));

        for (const newAct of newRes.actions) {
          if (!existingActionNames.has(newAct.name)) {
            existingRes.actions.push(JSON.parse(JSON.stringify(newAct)));
            addedActions.push(`${resKey}.${newAct.name}`);
          } else {
            const existingAct = existingRes.actions.find((a) => a.name === newAct.name)!;
            // Preserve user-modified visible_if, style, confirm_dialog
            if (!existingAct.api && newAct.api) existingAct.api = newAct.api;
            if (!existingAct.inputs && newAct.inputs) existingAct.inputs = newAct.inputs;
          }
        }
      }
    }

    // Merge mutations
    if (newRes.mutations && !existingRes.mutations) {
      existingRes.mutations = newRes.mutations;
    }
  }

  // 2. Detect Removed Resources (present in existingConfig but absent in newConfig)
  for (const [resKey, existingRes] of Object.entries(existingConfig.resources || {})) {
    if (!newConfig.resources?.[resKey]) {
      warnings.push(
        `[WARN] Resource "${resKey}" (${existingRes.endpoint}) was not found in the new OpenAPI specification. Retaining in configuration.`
      );
    }
  }

  return {
    mergedConfig: merged,
    warnings,
    addedResources,
    addedColumns,
    addedActions,
  };
}
