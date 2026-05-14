"use client";

import React from 'react';
import styles from './Projects.module.css';
import Link from 'next/link';
import { Plus, Search, Eye, Pencil, Trash2, X } from 'lucide-react';
import { projectsService, type ProjectRecord, type BoqItemRecord } from '@/lib/services/projects';
import { useUi } from '@/components/ui/AppProviders';
import { useSupabaseRealtime } from '@/lib/hooks/useSupabaseRealtime';

export default function ProjectsPage() {
  const ui = useUi();
  const [projects, setProjects] = React.useState<ProjectRecord[]>([]);
  const [allBoq, setAllBoq] = React.useState<BoqItemRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProjectId, setEditingProjectId] = React.useState<string>('');
  const [formName, setFormName] = React.useState('');
  const [formClient, setFormClient] = React.useState('');
  const [formAddress, setFormAddress] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.client_name || ''}`.toLowerCase().includes(q));
  }, [projects, query]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [result, boqResult] = await Promise.all([
        projectsService.listProjects(),
        projectsService.listAllBoqItems()
      ]);
      setProjects(result);
      setAllBoq(boqResult);
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : 'Unable to load projects';
      ui.showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [ui]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useSupabaseRealtime(
    'projects-list-live',
    React.useMemo(() => [
      { table: 'projects' },
      { table: 'boq_items' },
    ], []),
    () => {
      void load();
    },
  );

  const openCreate = React.useCallback(() => {
    setEditingProjectId('');
    setFormName('');
    setFormClient('');
    setFormAddress('');
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((project: ProjectRecord) => {
    setEditingProjectId(project.id);
    setFormName(project.name || '');
    setFormClient(project.client_name || '');
    setFormAddress(project.delivery_address || '');
    setDialogOpen(true);
  }, []);

  const saveProject = React.useCallback(async () => {
    const name = formName.trim();
    const client = formClient.trim();
    const address = formAddress.trim();

    if (!name) {
      ui.showToast('Enter project name.', 'info');
      return;
    }

    if (!client) {
      ui.showToast('Enter client name.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProjectId) {
        await projectsService.updateProject({
          projectId: editingProjectId,
          name,
          client_name: client,
          delivery_address: address || undefined,
        });
        ui.showToast('Project updated.', 'success');
      } else {
        await projectsService.createProject({
          name,
          client_name: client,
          delivery_address: address || undefined,
        });
        ui.showToast('Project created.', 'success');
      }

      setDialogOpen(false);
      setEditingProjectId('');
      setFormName('');
      setFormClient('');
      setFormAddress('');
      await load();
    } catch (err) {
      console.error(err);
      ui.showToast('Could not save project. Please contact admin if this keeps happening.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [editingProjectId, formAddress, formClient, formName, load, ui]);

  const deleteProject = React.useCallback(
    async (project: ProjectRecord) => {
      const confirm = await ui.confirmAction({
        title: 'Delete this project?',
        message: 'This will remove the project from the list.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        requireReason: true,
        reasonLabel: 'Reason',
        reasonPlaceholder: 'Why are you deleting this project?',
      });

      if (!confirm.confirmed) return;

      try {
        await projectsService.deleteProject(project.id);
        ui.showToast('Project deleted.', 'success');
        await load();
      } catch (err) {
        console.error(err);
        ui.showToast('Could not delete project.', 'error');
      }
    },
    [load, ui],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Client / Project Management</h1>
          <p className={styles.subtitle}>Track delivery progress and project BOQs</p>
        </div>
        <button className={styles.primaryAction} onClick={openCreate}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={16} color="var(--text-secondary)" />
            <input
              className={styles.searchInput}
              placeholder="Search projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* <span className={styles.badge} title="Live database connection">
            <Building2 size={14} /> Live Mode
          </span> */}
        </div>

        {isLoading ? (
          <div className={styles.empty}>Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No projects yet. Click "New Project" to create one.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Client / Project</th>
                  <th>Location</th>
                  <th className={styles.numericCell}>Delivered %</th>
                  <th className={styles.numericCell}>Pending %</th>
                  <th className={styles.actionsCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const projectItems = allBoq.filter(i => i.project_id === project.id);
                  const totalQty = projectItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
                  const totalDelivered = projectItems.reduce((sum, i) => sum + (i.delivered || 0), 0);
                  
                  const deliveredPct = totalQty > 0 ? Math.round((totalDelivered / totalQty) * 100) : 0;
                  const pendingPct = totalQty > 0 ? 100 - deliveredPct : 0;

                  return (
                    <tr key={project.id}>
                      <td>
                        <div className={styles.projectName}>{project.name}</div>
                        <div className={styles.clientName}>{project.client_name || 'No client'}</div>
                      </td>
                      <td>{project.delivery_address || '-'}</td>
                      <td className={styles.numericCell}>
                        <div className={styles.progressLabel}>{deliveredPct}%</div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${deliveredPct}%` }} />
                        </div>
                      </td>
                      <td className={styles.numericCell}>
                        <div className={styles.progressLabel}>{pendingPct}%</div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${pendingPct}%`, background: '#f87171' }} />
                        </div>
                      </td>
                      <td className={styles.actionsCell}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link href={`/projects/${project.id}`} className={styles.primaryLink} title="View Orders">
                            <Eye size={14} /> View Orders
                          </Link>
                          <button type="button" className={styles.iconAction} onClick={() => openEdit(project)}>
                            <Pencil size={16} />
                          </button>
                          <button type="button" className={`${styles.iconAction} ${styles.iconDanger}`} onClick={() => void deleteProject(project)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogOpen ? (
        <div className={styles.overlay} onClick={() => (isSaving ? null : setDialogOpen(false))}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <div className={styles.dialogTitle}>{editingProjectId ? 'Edit Project' : 'New Project'}</div>
              <button type="button" className={styles.closeBtn} onClick={() => (isSaving ? null : setDialogOpen(false))}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Project Name *</label>
                  <input className={styles.input} value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Client Name *</label>
                  <input className={styles.input} value={formClient} onChange={(e) => setFormClient(e.target.value)} />
                </div>
                <div className={`${styles.field} ${styles.formGridWide}`}>
                  <label className={styles.label}>Delivery Address</label>
                  <textarea className={styles.textarea} value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
                </div>
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button className={styles.secondaryAction} disabled={isSaving} onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button className={styles.primaryAction} disabled={isSaving} onClick={() => void saveProject()}>
                {isSaving ? 'Saving...' : editingProjectId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
