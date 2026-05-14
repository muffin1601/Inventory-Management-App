import { supabase } from '../supabase';

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

export type ProjectOrderRecord = {
  id: string;
  project_id: string;
  order_number: string;
  order_date: string;
  status: string;
  created_at?: string;
};

export type BoqItemRecord = {
  id: string;
  project_id: string;
  order_id?: string;
  variant_id?: string;
  warehouse_id?: string;
  item_name: string;
  manufacturer?: string;
  quantity: number;
  delivered: number;
  unit: string;
  notes?: string;
  created_at?: string;
};

export type BoqHeaderRecord = {
  id: string;
  project_id: string;
  order_id?: string;
  after_index: number;
  text: string;
  created_at?: string;
};

const BOQ_TABLE_CANDIDATES = ['boq_items', 'project_boq_items', 'boq_lines'] as const;

function safeString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
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
    order_id: safeString(row.order_id || row.orderId || ''),
    variant_id: safeString(row.variant_id || row.variantId || row.variant || ''),
    warehouse_id: safeString(row.warehouse_id || row.warehouseId || row.warehouse || ''),
    item_name: safeString(row.item_name || row.item || row.description || row.name || ''),
    manufacturer: safeString(row.manufacturer || row.manufacturers || row.brand || row.make || ''),
    quantity: safeNumber(row.quantity || row.qty || 0, 0),
    delivered: safeNumber(row.delivered || row.delivered_qty || row.delivered_quantity || 0, 0),
    unit: safeString(row.unit || row.uom || 'Nos'),
    notes: safeString(row.notes || row.remark || row.remarks || ''),
    created_at: safeString(row.created_at || ''),
  };
}

async function pickBoqTable(): Promise<(typeof BOQ_TABLE_CANDIDATES)[number]> {
  for (const table of BOQ_TABLE_CANDIDATES) {
    const probe = await supabase.from(table).select('id', { count: 'exact', head: true }).limit(1);
    if (!probe.error) return table;
  }
  throw new Error('BOQ table not found. Please contact your administrator.');
}

function getMissingColumnName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: string; message?: string };
  if (candidate.code !== 'PGRST204' || !candidate.message) return null;

  const match = candidate.message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
}

function isMissingTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase();
  return (
    candidate.code === 'PGRST205' ||
    candidate.code === '42P01' ||
    message.includes(tableName.toLowerCase()) ||
    message.includes('relation') ||
    message.includes('not found') ||
    message.includes('does not exist')
  );
}

function normalizeBoqHeader(row: Record<string, unknown>): BoqHeaderRecord {
  return {
    id: safeString(row.id || ''),
    project_id: safeString(row.project_id || ''),
    order_id: safeString(row.order_id || ''),
    after_index: safeNumber(row.after_index ?? row.afterIndex ?? 0, 0),
    text: safeString(row.text || row.header_text || row.title || ''),
    created_at: safeString(row.created_at || ''),
  };
}

async function insertBoqWithFallback(table: string, payload: Record<string, unknown>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const insert = await supabase.from(table).insert(nextPayload).select('*').single();
    if (!insert.error) return insert;

    const missingColumn = getMissingColumnName(insert.error);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return insert;
    }

    delete nextPayload[missingColumn];
  }

  return await supabase.from(table).insert(nextPayload).select('*').single();
}

async function updateBoqWithFallback(table: string, boqItemId: string, payload: Record<string, unknown>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const update = await supabase
      .from(table)
      .update(nextPayload)
      .eq('id', boqItemId)
      .select('*')
      .single();

    if (!update.error) return update;

    const missingColumn = getMissingColumnName(update.error);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      return update;
    }

    delete nextPayload[missingColumn];
    if (Object.keys(nextPayload).length === 0) {
      throw new Error(`None of the BOQ fields can be updated because the table is missing supported columns.`);
    }
  }

  return await supabase
    .from(table)
    .update(nextPayload)
    .eq('id', boqItemId)
    .select('*')
    .single();
}

export const projectsService = {
  async listProjects(): Promise<ProjectRecord[]> {
    const response = await supabase.from('projects').select('*').order('created_at', { ascending: false });

    if (response.error) {
      console.error('Failed to fetch projects:', response.error);
      throw new Error(`Failed to fetch projects: ${response.error.message}`);
    }

    const normalized = (response.data || []).map((row) => normalizeProject(row as Record<string, unknown>));
    const filtered = normalized
      .filter((item) => item.id && item.name)
      .filter((row) => {
        const rawRow = (response.data || []).find((d) => (d as Record<string, unknown>).id === row.id) as Record<string, unknown> | undefined;
        return !rawRow || rawRow.deleted_at == null;
      });

    return filtered;
  },

  async createProject(input: { name: string; client_name: string; delivery_address?: string; code?: string }): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('Project name is required');

    const code = input.code?.trim() || '';
    const client_name = input.client_name.trim();
    if (!client_name) throw new Error('Client name is required');

    const delivery_address = input.delivery_address?.trim() || '';

    const payload: Record<string, unknown> = { name, client_name };
    if (code) payload.code = code;
    if (delivery_address) payload.delivery_address = delivery_address;

    const insert = await supabase.from('projects').insert(payload).select('*').single();
    
    if (insert.error) {
      console.error('Failed to create project:', insert.error);
      throw new Error(`Failed to create project: ${insert.error.message}`);
    }

    return normalizeProject(insert.data as Record<string, unknown>);
  },

  async getProject(projectId: string): Promise<ProjectRecord | null> {
    const response = await supabase.from('projects').select('*').eq('id', projectId).single();
    
    if (response.error) {
      if (response.error.code === 'PGRST116') {
        return null;
      }
      console.error('Failed to fetch project:', response.error);
      throw new Error(`Failed to fetch project: ${response.error.message}`);
    }

    return normalizeProject(response.data as Record<string, unknown>);
  },

  async updateProject(input: {
    projectId: string;
    name: string;
    client_name: string;
    delivery_address?: string;
    code?: string;
  }): Promise<ProjectRecord> {
    const name = input.name.trim();
    if (!name) throw new Error('Project name is required');

    const code = input.code?.trim() || '';
    const client_name = input.client_name.trim();
    if (!client_name) throw new Error('Client name is required');

    const delivery_address = input.delivery_address?.trim() || '';

    const payload: Record<string, unknown> = { name, client_name };
    if (code) payload.code = code;
    if (delivery_address) payload.delivery_address = delivery_address;

    const update = await supabase
      .from('projects')
      .update(payload)
      .eq('id', input.projectId)
      .select('*')
      .single();

    if (update.error) {
      console.error('Failed to update project:', update.error);
      throw new Error(`Failed to update project: ${update.error.message}`);
    }

    return normalizeProject(update.data as Record<string, unknown>);
  },

  async deleteProject(projectId: string): Promise<void> {
    const response = await supabase.from('projects').delete().eq('id', projectId);

    if (response.error) {
      console.error('Failed to delete project:', response.error);
      if (response.error.code === '23503') {
        throw new Error('Cannot delete this project because it has active dependencies.');
      }
      throw new Error(`Failed to delete project: ${response.error.message}`);
    }
  },

  async listBoqItems(projectId: string): Promise<BoqItemRecord[]> {
    const table = await pickBoqTable();

    const response = await supabase
      .from(table)
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (response.error) {
      console.error('Failed to fetch BOQ items:', response.error);
      throw new Error(`Failed to fetch BOQ items: ${response.error.message}`);
    }

    return (response.data || [])
      .map((row) => normalizeBoqItem(row as Record<string, unknown>))
      .filter((row) => row.id && row.item_name);
  },

  async listAllBoqItems(): Promise<BoqItemRecord[]> {
    const table = await pickBoqTable();

    const response = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: true });

    if (response.error) {
      console.error('Failed to fetch all BOQ items:', response.error);
      throw new Error(`Failed to fetch BOQ items: ${response.error.message}`);
    }

    return (response.data || [])
      .map((row) => normalizeBoqItem(row as Record<string, unknown>))
      .filter((row) => row.id && row.item_name);
  },

  async addBoqItem(input: {
    projectId: string;
    order_id?: string;
    variant_id?: string;
    warehouse_id?: string;
    item_name: string;
    manufacturer?: string;
    quantity: number;
    delivered?: number;
    unit: string;
    notes?: string;
  }): Promise<BoqItemRecord> {
    const table = await pickBoqTable();

    const trimmedName = input.item_name.trim();
    if (!trimmedName) throw new Error('Item name is required');

    const trimmedUnit = input.unit.trim();
    if (!trimmedUnit) throw new Error('Unit is required');

    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new Error('Quantity must be a positive number');
    }

    const payload: Record<string, unknown> = {
      project_id: input.projectId,
      item_name: trimmedName,
      quantity: input.quantity,
      delivered: input.delivered || 0,
      unit: trimmedUnit,
    };

    if (input.order_id) payload.order_id = input.order_id;
    if (input.variant_id) payload.variant_id = input.variant_id;
    if (input.warehouse_id) payload.warehouse_id = input.warehouse_id;
    if (input.manufacturer) payload.manufacturer = input.manufacturer.trim();
    if (input.notes) payload.notes = input.notes.trim();

    const insert = await insertBoqWithFallback(table, payload);

    if (insert.error) {
      console.error('Failed to add BOQ item:', insert.error);
      throw new Error(`Failed to add BOQ item: ${insert.error.message}`);
    }

    return normalizeBoqItem(insert.data as Record<string, unknown>);
  },

  async updateBoqItem(input: {
    projectId: string;
    boqItemId: string;
    item_name?: string;
    manufacturer?: string;
    quantity?: number;
    unit?: string;
    variant_id?: string;
    warehouse_id?: string;
    delivered?: number;
  }): Promise<BoqItemRecord> {
    const table = await pickBoqTable();

    const payload: Record<string, unknown> = {};

    if (input.item_name !== undefined) {
      const trimmed = input.item_name.trim();
      if (!trimmed) throw new Error('Item name cannot be empty');
      payload.item_name = trimmed;
    }

    if (input.manufacturer !== undefined) payload.manufacturer = input.manufacturer.trim();
    if (input.variant_id !== undefined) payload.variant_id = input.variant_id;
    if (input.quantity !== undefined) {
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error('Quantity must be a positive number');
      }
      payload.quantity = input.quantity;
    }
    if (input.unit !== undefined) {
      const trimmed = input.unit.trim();
      if (!trimmed) throw new Error('Unit cannot be empty');
      payload.unit = trimmed;
    }
    if (input.warehouse_id !== undefined) payload.warehouse_id = input.warehouse_id;
    if (input.delivered !== undefined) payload.delivered = input.delivered;

    if (Object.keys(payload).length === 0) {
      throw new Error('No fields to update');
    }

    const update = await updateBoqWithFallback(table, input.boqItemId, payload);

    if (update.error) {
      console.error('Failed to update BOQ item:', update.error);
      throw new Error(`Failed to update BOQ item: ${update.error.message}`);
    }

    return normalizeBoqItem(update.data as Record<string, unknown>);
  },

  async deleteBoqItem(projectId: string, boqItemId: string): Promise<void> {
    const table = await pickBoqTable();
    const { error } = await supabase.from(table).delete().eq('id', boqItemId);
    if (error) {
      console.error('Failed to delete BOQ item:', error);
      throw new Error(`Failed to delete BOQ item: ${error.message}`);
    }
  },

  async listBoqHeaders(projectId: string, orderId: string): Promise<BoqHeaderRecord[]> {
    let query = supabase
      .from('boq_headers')
      .select('*')
      .eq('project_id', projectId)
      .order('after_index', { ascending: true })
      .order('created_at', { ascending: true });

    query = orderId === 'master' ? query.is('order_id', null) : query.eq('order_id', orderId);
    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error, 'boq_headers')) return [];
      console.error('Failed to fetch BOQ headers:', error);
      throw new Error(`Failed to fetch BOQ headers: ${error.message}`);
    }

    return (data || [])
      .map((row) => normalizeBoqHeader(row as Record<string, unknown>))
      .filter((row) => row.id && row.text);
  },

  async createBoqHeader(input: {
    projectId: string;
    orderId: string;
    afterIndex: number;
    text: string;
  }): Promise<BoqHeaderRecord> {
    const text = input.text.trim();
    if (!text) throw new Error('Header text is required');

    const payload = {
      project_id: input.projectId,
      order_id: input.orderId === 'master' ? null : input.orderId,
      after_index: input.afterIndex,
      text,
    };

    const { data, error } = await supabase.from('boq_headers').insert(payload).select('*').single();
    if (error) {
      console.error('Failed to create BOQ header:', error);
      throw new Error(`Failed to create BOQ header: ${error.message}`);
    }

    return normalizeBoqHeader(data as Record<string, unknown>);
  },

  async deleteBoqHeader(headerId: string): Promise<void> {
    const { error } = await supabase.from('boq_headers').delete().eq('id', headerId);
    if (error) {
      console.error('Failed to delete BOQ header:', error);
      throw new Error(`Failed to delete BOQ header: ${error.message}`);
    }
  },

  async listProjectOrders(projectId: string): Promise<ProjectOrderRecord[]> {
    const { data, error } = await supabase
      .from('project_orders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch project orders:', error.message);
      return [];
    }

    return (data || []).map((row) => normalizeProjectOrder(row as Record<string, unknown>));
  },

  async createProjectOrder(input: {
    projectId: string;
    order_number: string;
    order_date?: string;
    status?: string;
  }): Promise<ProjectOrderRecord> {
    const payload = {
      project_id: input.projectId,
      order_number: input.order_number.trim(),
      order_date: input.order_date || new Date().toISOString().split('T')[0],
      status: input.status || 'PENDING',
    };

    const { data, error } = await supabase
      .from('project_orders')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create project order:', error);
      throw new Error(`Failed to create project order: ${error.message}`);
    }

    return normalizeProjectOrder(data as Record<string, unknown>);
  },

  async updateProjectOrder(projectId: string, orderId: string, input: {
    order_number?: string;
    order_date?: string;
    status?: string;
  }): Promise<ProjectOrderRecord> {
    const payload: Record<string, unknown> = {};
    if (input.order_number !== undefined) payload.order_number = input.order_number.trim();
    if (input.order_date !== undefined) payload.order_date = input.order_date;
    if (input.status !== undefined) payload.status = input.status;

    const { data, error } = await supabase
      .from('project_orders')
      .update(payload)
      .eq('id', orderId)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to update project order:', error);
      throw new Error(`Failed to update project order: ${error.message}`);
    }

    return normalizeProjectOrder(data as Record<string, unknown>);
  },

  async deleteProjectOrder(projectId: string, orderId: string): Promise<void> {
    const table = await pickBoqTable();
    await supabase.from(table).delete().eq('order_id', orderId);

    const { error } = await supabase
      .from('project_orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('Failed to delete project order:', error);
      throw new Error(`Failed to delete project order: ${error.message}`);
    }
  },

  async listBoqItemsForOrder(projectId: string, orderId: string): Promise<BoqItemRecord[]> {
    const table = await pickBoqTable();
    const response = await supabase
      .from(table)
      .select('*')
      .eq('project_id', projectId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (response.error) {
      console.error('Failed to fetch order BOQ items:', response.error);
      throw new Error(`Failed to fetch order BOQ items: ${response.error.message}`);
    }

    return (response.data || [])
      .map((row) => normalizeBoqItem(row as Record<string, unknown>))
      .filter((row) => row.id && row.item_name);
  },
};

function normalizeProjectOrder(row: Record<string, unknown>): ProjectOrderRecord {
  return {
    id: safeString(row.id || ''),
    project_id: safeString(row.project_id || ''),
    order_number: safeString(row.order_number || row.po_number || row.id || ''),
    order_date: safeString(row.order_date || row.date || safeString(row.created_at).split('T')[0] || ''),
    status: safeString(row.status || 'PENDING'),
    created_at: safeString(row.created_at || ''),
  };
}
