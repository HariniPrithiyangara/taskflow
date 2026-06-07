import axios from 'axios';
import { API_BASE_URL } from '../context/AuthContext';

/**
 * Shared axios instance — token injected automatically via interceptor.
 */
const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskflow_token');
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// ===========================================================================
// Task Service
// ===========================================================================
export const taskService = {
  /**
   * Fetch paginated + filtered tasks.
   * Returns axios response whose .data is:
   *   { count, total_pages, current_page, page_size, next, previous, results }
   *
   * @param {{ search?, status?, ordering?, project?, page? }} filters
   */
  getTasks(filters = {}) {
    const params = {};
    if (filters.search)   params.search   = filters.search;
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    if (filters.ordering) params.ordering = filters.ordering;
    if (filters.project)  params.project  = filters.project;
    if (filters.page && filters.page > 1) params.page = filters.page;
    return api.get('/tasks/', { params });
  },

  /**
   * Fetch global aggregate stats (always all tasks, no filter).
   * Returns { total, pending, in_progress, completed, overdue }
   */
  getStats() {
    return api.get('/tasks/stats/');
  },

  /**
   * Create a new task.
   */
  createTask(data) {
    const payload = { ...data, due_date: data.due_date || null };
    return api.post('/tasks/', payload);
  },

  /**
   * Partially update a task (PATCH).
   */
  updateTask(id, data) {
    const payload = { ...data };
    if ('due_date' in payload && !payload.due_date) payload.due_date = null;
    return api.patch(`/tasks/${id}/`, payload);
  },

  /**
   * Delete a task.
   */
  deleteTask(id) {
    return api.delete(`/tasks/${id}/`);
  },
};

// ===========================================================================
// Project Service
// ===========================================================================
export const projectService = {
  getProjects(filters = {}) {
    const params = filters.search ? { search: filters.search } : {};
    return api.get('/projects/', { params });
  },
  createProject(data)      { return api.post('/projects/', data); },
  updateProject(id, data)  { return api.patch(`/projects/${id}/`, data); },
  deleteProject(id)        { return api.delete(`/projects/${id}/`); },
};
