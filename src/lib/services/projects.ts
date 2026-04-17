import { supabase } from '../supabase';

export type DataSource = 'supabase' | 'local';

export type ProjectRecord = {
  id: string;
  name: string;
  code?: string;
  client_name?: string;
  delivery_address?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type BoqItemRecord = {
  id: string;
  project_id: string;
  variant_id?: string;
  item_name: string;
  manufacturer?: string;
  quantity: number;
  delivered: number;
  unit: string;
  notes?: string;
  created_at?: string;
};

const PROJECTS_KEY = 'ims_projects_v1';
const BOQ_ITEMS_KEY = 'ims_project_boq_items_v1';

const BOQ_TABLE_CANDIDATES = ['boq_items', 'project_boq_items', 'boq_lines'] as const;

function safeString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function makeId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

function readLocalProjects(): ProjectRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeProject(row as Record<string, unknown>))
      .filter((row) => row.id && row.name);
  } catch {
    return [];
  }
}

function writeLocalProjects(projects: ProjectRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function readLocalBoqItems(): Record<string, BoqItemRecord[]> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(BOQ_ITEMS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const rawState = parsed as Record<string, unknown>;
    const state: Record<string, BoqItemRecord[]> = {};
    Object.entries(rawState).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        state[key] = value
          .map((row) => normalizeBoqItem(row as Record<string, unknown>))
          .filter((row) => row.id && row.item_name);
      }
    });
    return state;
  } catch {
    return {};
  }
}

function writeLocalBoqItems(state: Record<string, BoqItemRecord[]>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOQ_ITEMS_KEY, JSON.stringify(state));
}

function normalizeProject(row: Record<string, unknown>): ProjectRecord {
  const name = safeString(row.name || row.project_name || row.title || row.project || '');
  return {
    id: safeString(row.id || row.project_id || ''),
    name,
    code: safeString(row.code || row.project_code || ''),
    client_name: safeString(row.client_name || row.client || row.clientName || ''),
    delivery_address: safeString(row.delivery_address || row.address || row.deliveryAddress || row.site_address || ''),
    status: safeString(row.status || ''),
    created_at: safeString(row.created_at || ''),
    updated_at: safeString(row.updated_at || row.modified_at || ''),
  };
}

function normalizeBoqItem(row: Record<string, unknown>): BoqItemRecord {
  return {
    id: safeString(row.id || ''),
    project_id: safeString(row.project_id || row.projectId || ''),
    variant_id: safeString(row.variant_id || row.variantId || row.variant || ''),
    item_name: safeString(row.item_name || row.item || row.description || row.name || ''),
    manufacturer: safeString(row.manufacturer || row.manufacturers || row.brand || row.make || ''),
    quantity: safeNumber(row.quantity || row.qty || 0, 0),
    delivered: safeNumber(row.delivered || row.delivered_qty || row.delivered_quantity || 0, 0),
    unit: safeString(row.unit || row.uom || 'Nos'),
    notes: safeString(row.notes || row.remark || row.remarks || ''),
    created_at: safeString(row.created_at || ''),
  };
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string; status?: number };
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return (
    candidate.status === 404 ||
    candidate.code === 'PGRST205' ||
    candidate.code === '42P01' ||
    message.includes('could not find') ||
    message.includes('relation') ||
    message.includes('not found')
  );
}

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string; status?: number };
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return candidate.code === '42703' || message.includes('column') || message.includes('does not exist');
}

async function pickBoqTable(): Promise<(typeof BOQ_TABLE_CANDIDATES)[number] | null> {
  for (const table of BOQ_TABLE_CANDIDATES) {
    const probe = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    if (!probe.error) return table;
    if (!isMissingTableError(probe.error)) return table;
  }
  return null;
}

export const projectsService = {
  async listProjects(): Promise<{ source: DataSource; projects: ProjectRecord[]; warning?: string }> {
    const response = await supabase.from('projects').select('*').is('deleted_at', null);

    if (response.error) {
      if (isMissingColumnError(response.error)) {
        const fallback = await supabase.from('projects').select('*');
        if (!fallback.error) {
          const normalized = (fallback.data || []).map((row) => normalizeProject(row as Record<string, unknown>));
          return { source: 'supabase', projects: normalized.filter((row) => row.id && row.name) };
        }
      }
      if (isMissingTableError(response.error)) {
        return {
          source: 'local',
          projects: readLocalProjects(),
          warning: 'Projects are saved only on this device because the Projects table is not available.',
        };
      }

      return {
        source: 'local',
        projects: readLocalProjects(),
        warning: 'Unable to load projects from server; showing local projects.',
      };
    }

    const normalized = (response.data || []).map((row) => normalizeProject(row as Record<string, unknown>));
    return { source: 'supabase', projects: normalized.filter((row) => row.id && row.name) };
  },

  async createProject(input: { name: string; client_name: string; delivery_address?: string; code?: string }) {
    const name = input.name.trim();
    const code = input.code?.trim() || '';
    const client_name = input.client_name.trim();
    const delivery_address = input.delivery_address?.trim() || '';

    const list = await this.listProjects();

    if (list.source === 'local') {
      const now = new Date().toISOString();
      const next: ProjectRecord = {
        id: makeId('project'),
        name,
        code,
        client_name,
        delivery_address,
        created_at: now,
        updated_at: now,
        status: 'ACTIVE',
      };
      const updated = [next, ...list.projects];
      writeLocalProjects(updated);
      return { source: 'local' as const, project: next };
    }

    const payload: Record<string, unknown> = { name };
    if (code) payload.code = code;
    if (client_name) payload.client_name = client_name;
    if (delivery_address) payload.delivery_address = delivery_address;

    const insert = await supabase.from('projects').insert(payload).select('*').single();
    if (insert.error) {
      if (isMissingColumnError(insert.error)) {
        const fallbackPayload: Record<string, unknown> = { name };
        if (code) fallbackPayload.code = code;
        if (client_name) fallbackPayload.client = client_name;
        if (delivery_address) fallbackPayload.delivery_address = delivery_address;
        const fallbackInsert = await supabase.from('projects').insert(fallbackPayload).select('*').single();
        if (fallbackInsert.error) {
          if (isMissingColumnError(fallbackInsert.error)) {
            const legacyPayload: Record<string, unknown> = { name };
            if (code) legacyPayload.code = code;
            if (client_name) legacyPayload.client = client_name;
            if (delivery_address) legacyPayload.address = delivery_address;
            const legacyInsert = await supabase.from('projects').insert(legacyPayload).select('*').single();
            if (legacyInsert.error) throw legacyInsert.error;
            return { source: 'supabase' as const, project: normalizeProject(legacyInsert.data as Record<string, unknown>) };
          }
          throw fallbackInsert.error;
        }
        return { source: 'supabase' as const, project: normalizeProject(fallbackInsert.data as Record<string, unknown>) };
      }
      throw insert.error;
    }
    return { source: 'supabase' as const, project: normalizeProject(insert.data as Record<string, unknown>) };
  },

  async getProject(projectId: string) {
    const response = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (response.error) {
      const local = readLocalProjects().find((p) => p.id === projectId);
      return { source: 'local' as const, project: local || null };
    }
    return { source: 'supabase' as const, project: normalizeProject(response.data as Record<string, unknown>) };
  },

  async updateProject(input: { projectId: string; name: string; client_name: string; delivery_address?: string; code?: string }) {
    const name = input.name.trim();
    const code = input.code?.trim() || '';
    const client_name = input.client_name.trim();
    const delivery_address = input.delivery_address?.trim() || '';

    const list = await this.listProjects();

    if (list.source === 'local') {
      const next = list.projects.map((p) =>
        p.id === input.projectId
          ? { ...p, name, code, client_name, delivery_address, updated_at: new Date().toISOString() }
          : p,
      );
      writeLocalProjects(next);
      const updated = next.find((p) => p.id === input.projectId) || null;
      return { source: 'local' as const, project: updated };
    }

    const payload: Record<string, unknown> = { name };
    if (code) payload.code = code;
    if (client_name) payload.client_name = client_name;
    if (delivery_address) payload.delivery_address = delivery_address;

    const update = await supabase.from('projects').update(payload).eq('id', input.projectId).select('*').single();
    if (update.error) {
      if (isMissingColumnError(update.error)) {
        const fallbackPayload: Record<string, unknown> = { name };
        if (code) fallbackPayload.code = code;
        if (client_name) fallbackPayload.client = client_name;
        if (delivery_address) fallbackPayload.delivery_address = delivery_address;
        const fallbackUpdate = await supabase
          .from('projects')
          .update(fallbackPayload)
          .eq('id', input.projectId)
          .select('*')
          .single();
        if (fallbackUpdate.error) {
          if (isMissingColumnError(fallbackUpdate.error)) {
            const legacyPayload: Record<string, unknown> = { name };
            if (code) legacyPayload.code = code;
            if (client_name) legacyPayload.client = client_name;
            if (delivery_address) legacyPayload.address = delivery_address;
            const legacyUpdate = await supabase
              .from('projects')
              .update(legacyPayload)
              .eq('id', input.projectId)
              .select('*')
              .single();
            if (legacyUpdate.error) throw legacyUpdate.error;
            return { source: 'supabase' as const, project: normalizeProject(legacyUpdate.data as Record<string, unknown>) };
          }
          throw fallbackUpdate.error;
        }
        return { source: 'supabase' as const, project: normalizeProject(fallbackUpdate.data as Record<string, unknown>) };
      }
      throw update.error;
    }
    return { source: 'supabase' as const, project: normalizeProject(update.data as Record<string, unknown>) };
  },

  async deleteProject(projectId: string) {
    const list = await this.listProjects();
    if (list.source === 'local') {
      const next = list.projects.filter((p) => p.id !== projectId);
      writeLocalProjects(next);
      return { source: 'local' as const };
    }

    const soft = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId);
    if (soft.error) {
      if (isMissingColumnError(soft.error)) {
        const hard = await supabase.from('projects').delete().eq('id', projectId);
        if (hard.error) throw hard.error;
        return { source: 'supabase' as const };
      }
      throw soft.error;
    }
    return { source: 'supabase' as const };
  },

  async listBoqItems(projectId: string): Promise<{ source: DataSource; items: BoqItemRecord[]; warning?: string }> {
    const table = await pickBoqTable();
    if (!table) {
      const state = readLocalBoqItems();
      return { source: 'local', items: state[projectId] || [], warning: 'BOQ is saved only on this device.' };
    }

    const response = await supabase.from(table).select('*').eq('project_id', projectId);
    if (response.error) {
      if (isMissingTableError(response.error)) {
        const state = readLocalBoqItems();
        return { source: 'local', items: state[projectId] || [], warning: 'BOQ is saved only on this device.' };
      }
      const state = readLocalBoqItems();
      return { source: 'local', items: state[projectId] || [], warning: 'Unable to load BOQ from server; showing local BOQ.' };
    }

    return {
      source: 'supabase',
      items: (response.data || [])
        .map((row) => normalizeBoqItem(row as Record<string, unknown>))
        .filter((row) => row.id && row.item_name),
    };
  },

  async listAllBoqItems(): Promise<{ source: DataSource; items: BoqItemRecord[]; warning?: string }> {
    const table = await pickBoqTable();
    if (!table) {
      const state = readLocalBoqItems();
      return {
        source: 'local',
        items: Object.values(state).flat(),
        warning: 'BOQ is saved only on this device.',
      };
    }

    const response = await supabase.from(table).select('*');
    if (response.error) {
      if (isMissingTableError(response.error)) {
        const state = readLocalBoqItems();
        return {
          source: 'local',
          items: Object.values(state).flat(),
          warning: 'BOQ is saved only on this device.',
        };
      }
      const state = readLocalBoqItems();
      return {
        source: 'local',
        items: Object.values(state).flat(),
        warning: 'Unable to load BOQ from server; showing local BOQ.',
      };
    }

    return {
      source: 'supabase',
      items: (response.data || [])
        .map((row) => normalizeBoqItem(row as Record<string, unknown>))
        .filter((row) => row.id && row.item_name),
    };
  },

  async addBoqItem(input: {
    projectId: string;
    variant_id?: string;
    item_name: string;
    manufacturer?: string;
    quantity: number;
    delivered?: number;
    unit: string;
    notes?: string;
  }) {
    const table = await pickBoqTable();
    const trimmedName = input.item_name.trim();
    const trimmedManufacturer = input.manufacturer?.trim() || '';
    const trimmedUnit = input.unit.trim();
    const trimmedNotes = input.notes?.trim() || '';
    const delivered = typeof input.delivered === 'number' && Number.isFinite(input.delivered) ? input.delivered : 0;

    if (!table) {
      const state = readLocalBoqItems();
      const now = new Date().toISOString();
      const next: BoqItemRecord = {
        id: makeId('boq'),
        project_id: input.projectId,
        variant_id: input.variant_id,
        item_name: trimmedName,
        manufacturer: trimmedManufacturer,
        quantity: input.quantity,
        delivered,
        unit: trimmedUnit,
        notes: trimmedNotes,
        created_at: now,
      };
      const updated = { ...state, [input.projectId]: [next, ...(state[input.projectId] || [])] };
      writeLocalBoqItems(updated);
      return { source: 'local' as const, item: next };
    }

    const payload: Record<string, unknown> = {
      project_id: input.projectId,
      item_name: trimmedName,
      quantity: input.quantity,
      unit: trimmedUnit,
      notes: trimmedNotes,
    };

    if (trimmedManufacturer) payload.manufacturer = trimmedManufacturer;
    if (delivered) payload.delivered = delivered;
    if (input.variant_id) payload.variant_id = input.variant_id;

    const insert = await supabase.from(table).insert(payload).select('*').single();

    if (insert.error) {
      if (isMissingColumnError(insert.error)) {
        const fallbackPayload: Record<string, unknown> = {
          project_id: input.projectId,
          item_name: trimmedName,
          quantity: input.quantity,
          unit: trimmedUnit,
          notes: trimmedNotes,
        };
        if (trimmedManufacturer) fallbackPayload.manufacturer = trimmedManufacturer;
        if (delivered) fallbackPayload.delivered = delivered;

        const fallbackInsert = await supabase
          .from(table)
          .insert(fallbackPayload)
          .select('*')
          .single();
        if (fallbackInsert.error) throw fallbackInsert.error;
        return { source: 'supabase' as const, item: normalizeBoqItem(fallbackInsert.data as Record<string, unknown>) };
      }
      throw insert.error;
    }

    return { source: 'supabase' as const, item: normalizeBoqItem(insert.data as Record<string, unknown>) };
  },

  async deleteBoqItem(projectId: string, boqItemId: string) {
    const table = await pickBoqTable();
    if (!table) {
      const state = readLocalBoqItems();
      const next = (state[projectId] || []).filter((item) => item.id !== boqItemId);
      writeLocalBoqItems({ ...state, [projectId]: next });
      return { source: 'local' as const };
    }

    const del = await supabase.from(table).delete().eq('id', boqItemId);
    if (del.error) throw del.error;
    return { source: 'supabase' as const };
  },
};
