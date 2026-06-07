import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/api';
import {
  Bell, Calendar, ChevronLeft, ChevronRight, Circle,
  CircleAlert, CircleCheck, CirclePlay, Clock, LayoutGrid,
  LogOut, Pen, Plus, Save, Search, Sparkles, SquareCheckBig,
  Trash2, X, AlertTriangle, BarChart3, TrendingUp,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 6;

/** Parse a YYYY-MM-DD string without timezone shift. */
const parseLocalDate = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Format a due date string for display. */
const fmtDate = (str) => {
  if (!str) return 'No due date';
  return parseLocalDate(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

/** Format an ISO datetime string (created_at / updated_at) for display. */
const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const PRIORITY_STYLES = {
  High:   'bg-red-50 text-red-700 border-red-100',
  Medium: 'bg-amber-50 text-amber-700 border-amber-100',
  Low:    'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const STATUS_STYLES = {
  Pending:     'bg-blue-50 text-blue-700 border-blue-100',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-100',
  Completed:   'bg-emerald-50 text-emerald-700 border-emerald-100',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Single stat card */
const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4 hover:shadow-md transition-shadow">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  </div>
);

/** Pagination control bar */
const Pagination = ({ currentPage, totalPages, totalCount, pageSize, onPageChange, isLoading }) => {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end   = Math.min(currentPage * pageSize, totalCount);

  // Build page number array with ellipsis
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    const lo = Math.max(2, currentPage - 1);
    const hi = Math.min(totalPages - 1, currentPage + 1);
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
      <p className="text-xs text-slate-400 font-medium">
        Showing <span className="text-slate-700 font-bold">{start}–{end}</span> of{' '}
        <span className="text-slate-700 font-bold">{totalCount}</span> tasks
      </p>
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-slate-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              disabled={isLoading}
              className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                p === currentPage
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/** Edit task modal */
const EditModal = ({ task, onSave, onClose }) => {
  const [title, setTitle]       = useState(task.title);
  const [desc, setDesc]         = useState(task.description || '');
  const [taskStatus, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate]   = useState(task.due_date || '');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required.'); return; }
    setSaving(true);
    try {
      await onSave(task.id, { title, description: desc, status: taskStatus, priority, due_date: dueDate || null });
      onClose();
    } catch {
      setErr('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Pen className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Edit Task</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Update task details below</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-100 text-red-700 text-xs font-medium px-4 py-2.5 rounded-xl">
              <CircleAlert className="h-4 w-4 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Task Title *</label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a clear task title..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add a short description (optional)..."
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
              <select
                value={taskStatus}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Individual task card */
const TaskCard = ({ task, onEdit, onDelete, onToggleComplete, onSetStatus }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const today       = new Date().setHours(0, 0, 0, 0);
  const isCompleted = task.status === 'Completed';
  const isOverdue   = !isCompleted && task.due_date && parseLocalDate(task.due_date) < today;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(task.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-5 border shadow-sm transition-all duration-200 flex items-start space-x-4 group hover:shadow-md ${
        isCompleted ? 'border-emerald-100' : isOverdue ? 'border-red-100' : 'border-slate-100'
      }`}
    >
      {/* Toggle complete button */}
      <button
        type="button"
        onClick={() => onToggleComplete(task)}
        title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
        className="mt-0.5 transition-colors focus:outline-none cursor-pointer flex-shrink-0"
      >
        {isCompleted ? (
          <CircleCheck className="h-6 w-6 text-emerald-500 fill-emerald-50" />
        ) : task.status === 'In Progress' ? (
          <CirclePlay className="h-6 w-6 text-amber-500 fill-amber-50 animate-pulse" />
        ) : (
          <Circle className="h-6 w-6 text-slate-300 hover:text-indigo-500" />
        )}
      </button>

      {/* Content */}
      <div className="flex-grow min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className={`font-bold text-sm sm:text-base leading-snug ${
            isCompleted ? 'line-through text-slate-400 font-medium' : 'text-slate-900'
          }`}>
            {task.title}
          </h3>

          {/* Action buttons */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            {confirmDelete ? (
              <div className="flex items-center space-x-1 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                <span className="text-[10px] text-red-700 font-semibold">Delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] font-bold text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  title="Edit task"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-all cursor-pointer"
                >
                  <Pen className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  title="Delete task"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className={`text-xs sm:text-sm mt-1.5 mb-3 leading-relaxed line-clamp-2 ${
            isCompleted ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {task.description}
          </p>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {/* Status badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_STYLES[task.status] || ''}`}>
            • {task.status}
          </span>

          {/* Start / Pause quick-action */}
          {!isCompleted && (
            task.status === 'Pending' ? (
              <button
                type="button"
                onClick={() => onSetStatus(task.id, 'In Progress')}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 cursor-pointer transition-colors"
              >
                <CirclePlay className="h-2.5 w-2.5" />
                <span>Start</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSetStatus(task.id, 'Pending')}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold border bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                <Clock className="h-2.5 w-2.5" />
                <span>Pause</span>
              </button>
            )
          )}

          {/* Priority */}
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${PRIORITY_STYLES[task.priority] || ''}`}>
            {task.priority}
          </span>

          {/* Due date */}
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center space-x-1 ${
            isCompleted
              ? 'bg-slate-50 text-slate-400 border-slate-100'
              : isOverdue
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-slate-50 text-slate-500 border-slate-100'
          }`}>
            <Calendar className="h-3 w-3" />
            <span>{fmtDate(task.due_date)}</span>
            {isOverdue && <span className="font-bold uppercase text-[7px] text-red-700 pl-0.5">(Overdue)</span>}
          </span>

          {/* Created at */}
          {task.created_at && (
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-medium border bg-slate-50 text-slate-400 border-slate-100 flex items-center space-x-1">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>Created {fmtDateTime(task.created_at)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Reports Tab ─────────────────────────────────────────────────────────────

const Reports = ({ stats }) => {
  const completionPct = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference * (1 - completionPct / 100);

  const maxBar = Math.max(stats.pending, stats.in_progress, stats.completed, 1);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reports & Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Real-time task progress, completion rate, and priority breakdown.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Completion Rate */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-between text-center min-h-[300px]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Completion Rate</h3>
          <div className="relative h-36 w-36 flex items-center justify-center">
            <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#grad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="relative text-center">
              <p className="text-3xl font-extrabold text-indigo-600">{completionPct}%</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Done</p>
            </div>
          </div>
          <div className="w-full space-y-1.5 mt-4">
            {[
              { label: 'Completed', val: stats.completed, color: 'bg-emerald-500' },
              { label: 'In Progress', val: stats.in_progress, color: 'bg-amber-400' },
              { label: 'Pending', val: stats.pending, color: 'bg-blue-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-slate-500">{label}</span>
                </div>
                <span className="font-bold text-slate-800">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
          <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Status Breakdown</h3>
          </div>
          <div className="flex-grow flex flex-col justify-end space-y-3">
            {[
              { label: 'Completed', val: stats.completed, color: 'bg-emerald-500', ring: 'ring-emerald-100' },
              { label: 'In Progress', val: stats.in_progress, color: 'bg-amber-400', ring: 'ring-amber-100' },
              { label: 'Pending', val: stats.pending, color: 'bg-blue-400', ring: 'ring-blue-100' },
              { label: 'Overdue', val: stats.overdue, color: 'bg-red-500', ring: 'ring-red-100' },
            ].map(({ label, val, color, ring }) => {
              const pct = stats.total > 0 ? (val / stats.total) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                    <span className="text-xs font-bold text-slate-800">{val}</span>
                  </div>
                  <div className={`w-full h-2 bg-slate-100 rounded-full ring-1 ${ring} overflow-hidden`}>
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[300px]">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Summary</h3>
          </div>
          <div className="space-y-3 flex-grow">
            {[
              { label: 'Total Tasks', val: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Completed', val: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'In Progress', val: stats.in_progress, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Pending', val: stats.pending, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Overdue', val: stats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${bg}`}>
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <span className={`text-lg font-extrabold ${color}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, logout } = useAuth();

  // ── UI state
  const [currentTab, setCurrentTab]           = useState('tasks');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu]        = useState(false);

  // ── Task list state
  const [tasks, setTasks]         = useState(() => {
    const cached = localStorage.getItem('taskflow_cached_tasks');
    return cached ? JSON.parse(cached) : [];
  });
  const [totalCount, setTotal]    = useState(() => {
    return Number(localStorage.getItem('taskflow_cached_total') || 0);
  });
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setPage]    = useState(1);
  const [isLoading, setLoading]   = useState(() => {
    const cached = localStorage.getItem('taskflow_cached_tasks');
    return !cached; // only show loader if no cache exists
  });
  const [listError, setListError] = useState('');

  // ── Global stats (always all tasks, no filter)
  const [stats, setStats] = useState(() => {
    const cached = localStorage.getItem('taskflow_cached_stats');
    return cached ? JSON.parse(cached) : { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  });

  // ── Filters
  const [searchQuery, setSearch]   = useState('');
  const [filterStatus, setFilter]  = useState('All');
  const [ordering, setOrdering]    = useState('-created_at');

  // ── Create form
  const [newTitle, setNewTitle]       = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newStatus, setNewStatus]     = useState('Pending');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newDue, setNewDue]           = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ── Edit modal
  const [editTask, setEditTask] = useState(null);

  // ── Notifications (derived from stats)
  const notifications = [];
  if (stats.overdue > 0)
    notifications.push({ id: 'overdue', type: 'danger', message: `${stats.overdue} overdue task(s)`, sub: 'Please review their due dates.' });
  if (stats.in_progress > 0)
    notifications.push({ id: 'progress', type: 'warning', message: `${stats.in_progress} task(s) in progress`, sub: 'Keep up the great work!' });
  notifications.push({ id: 'welcome', type: 'info', message: `Welcome, ${user?.username}!`, sub: 'Track your tasks and stay productive.' });

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await taskService.getStats();
      setStats(res.data);
      localStorage.setItem('taskflow_cached_stats', JSON.stringify(res.data));
    } catch {
      // Non-blocking — stats are cosmetic
    }
  }, []);

  const fetchTasks = useCallback(async (page = 1, quiet = false) => {
    if (!quiet) setLoading(true);
    setListError('');
    try {
      const res = await taskService.getTasks({
        search: searchQuery,
        status: filterStatus,
        ordering,
        page,
      });
      const data = res.data;
      const resultList = data.results ?? data;
      setTasks(resultList);
      const totalNum = data.count ?? (data.results ? data.count : data.length);
      setTotal(totalNum);
      setTotalPages(data.total_pages ?? 1);
      setPage(data.current_page ?? page);

      // Cache the base unfiltered view for instant loads
      if (page === 1 && !searchQuery && filterStatus === 'All') {
        localStorage.setItem('taskflow_cached_tasks', JSON.stringify(resultList));
        localStorage.setItem('taskflow_cached_total', String(totalNum));
      }
    } catch {
      setListError('Failed to load tasks. Please refresh.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [searchQuery, filterStatus, ordering]);

  // Debounced fetch on filter/search changes — reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTasks(1);
      fetchStats();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchTasks, fetchStats]);

  // Page change (no debounce needed)
  const handlePageChange = (newPage) => {
    fetchTasks(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const refreshAll = useCallback((quiet = false) => {
    fetchTasks(currentPage, quiet);
    fetchStats();
  }, [fetchTasks, fetchStats, currentPage]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) { setCreateError('Title is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await taskService.createTask({
        title: newTitle, description: newDesc, status: newStatus,
        priority: newPriority, due_date: newDue || null,
      });
      setNewTitle(''); setNewDesc(''); setNewStatus('Pending');
      setNewPriority('Medium'); setNewDue('');
      setShowCreateForm(false);
      fetchTasks(1);
      fetchStats();
    } catch (err) {
      const detail = err.response?.data;
      setCreateError(typeof detail === 'object' ? JSON.stringify(detail) : 'Failed to create task.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditSave = async (id, data) => {
    const originalTasks = [...tasks];
    // Optimistically update the list
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    try {
      await taskService.updateTask(id, data);
      refreshAll(true);
    } catch (err) {
      setTasks(originalTasks);
      throw err;
    }
  };

  const handleDelete = async (id) => {
    const originalTasks = [...tasks];
    const originalStats = { ...stats };
    const originalTotal = totalCount;

    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    // Optimistically update list and total count
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    setTotal(prev => Math.max(0, prev - 1));

    // Optimistically update stats
    setStats(prev => {
      const next = { ...prev };
      next.total = Math.max(0, next.total - 1);
      const statusKey = taskToDelete.status === 'In Progress' ? 'in_progress' : taskToDelete.status.toLowerCase();
      if (statusKey in next) {
        next[statusKey] = Math.max(0, next[statusKey] - 1);
      }
      // Overdue check
      const today = new Date().setHours(0, 0, 0, 0);
      const isOverdue = taskToDelete.status !== 'Completed' && taskToDelete.due_date && parseLocalDate(taskToDelete.due_date) < today;
      if (isOverdue) {
        next.overdue = Math.max(0, next.overdue - 1);
      }
      return next;
    });

    try {
      await taskService.deleteTask(id);
      const newPage = updatedTasks.length === 0 && currentPage > 1 ? currentPage - 1 : currentPage;
      fetchTasks(newPage, true);
      fetchStats();
    } catch (err) {
      // Rollback
      setTasks(originalTasks);
      setStats(originalStats);
      setTotal(originalTotal);
    }
  };

  const handleToggleComplete = async (task) => {
    const originalTasks = [...tasks];
    const originalStats = { ...stats };

    const oldStatus = task.status;
    const newStatus = oldStatus === 'Completed' ? 'Pending' : 'Completed';

    // Optimistically update task status in the list
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    // Optimistically update stats
    setStats(prev => {
      const next = { ...prev };
      const oldKey = oldStatus === 'In Progress' ? 'in_progress' : oldStatus.toLowerCase();
      const newKey = newStatus === 'In Progress' ? 'in_progress' : newStatus.toLowerCase();

      if (oldKey in next) next[oldKey] = Math.max(0, next[oldKey] - 1);
      if (newKey in next) next[newKey] = next[newKey] + 1;

      // Overdue check
      const today = new Date().setHours(0, 0, 0, 0);
      const isOverdue = task.due_date && parseLocalDate(task.due_date) < today;
      if (isOverdue) {
        if (oldStatus !== 'Completed' && newStatus === 'Completed') {
          next.overdue = Math.max(0, next.overdue - 1);
        } else if (oldStatus === 'Completed' && newStatus !== 'Completed') {
          next.overdue = next.overdue + 1;
        }
      }
      return next;
    });

    try {
      await taskService.updateTask(task.id, { status: newStatus });
      refreshAll(true);
    } catch (err) {
      setTasks(originalTasks);
      setStats(originalStats);
    }
  };

  const handleSetStatus = async (id, newStatus) => {
    const originalTasks = [...tasks];
    const originalStats = { ...stats };

    const taskToUpdate = tasks.find(t => t.id === id);
    if (!taskToUpdate) return;
    const oldStatus = taskToUpdate.status;

    // Optimistically update task status in the list
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

    // Optimistically update stats
    setStats(prev => {
      const next = { ...prev };
      const oldKey = oldStatus === 'In Progress' ? 'in_progress' : oldStatus.toLowerCase();
      const newKey = newStatus === 'In Progress' ? 'in_progress' : newStatus.toLowerCase();

      if (oldKey in next) next[oldKey] = Math.max(0, next[oldKey] - 1);
      if (newKey in next) next[newKey] = next[newKey] + 1;

      // Overdue check
      const today = new Date().setHours(0, 0, 0, 0);
      const isOverdue = taskToUpdate.due_date && parseLocalDate(taskToUpdate.due_date) < today;
      if (isOverdue) {
        if (oldStatus !== 'Completed' && newStatus === 'Completed') {
          next.overdue = Math.max(0, next.overdue - 1);
        } else if (oldStatus === 'Completed' && newStatus !== 'Completed') {
          next.overdue = next.overdue + 1;
        }
      }
      return next;
    });

    try {
      await taskService.updateTask(id, { status: newStatus });
      refreshAll(true);
    } catch (err) {
      setTasks(originalTasks);
      setStats(originalStats);
    }
  };


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = () => { setShowNotifications(false); setShowUserMenu(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const filterTabs = [
    { label: 'All',         count: stats.total },
    { label: 'Pending',     count: stats.pending },
    { label: 'In Progress', count: stats.in_progress },
    { label: 'Completed',   count: stats.completed },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24 font-sans text-slate-800">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm/5 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          onClick={() => setCurrentTab('tasks')}
          className="flex items-center space-x-2 cursor-pointer flex-shrink-0"
        >
          <div className="h-9 w-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <SquareCheckBig className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">TaskFlow</span>
        </button>

        {/* Nav tabs (desktop) */}
        <nav className="hidden md:flex items-center space-x-1 text-sm font-semibold text-slate-500">
          {[['tasks', 'My Tasks'], ['reports', 'Reports']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentTab === tab ? 'text-indigo-600 bg-indigo-50 font-bold' : 'hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center space-x-3 flex-1 max-w-xs justify-end">
          {/* Search (tasks tab only) */}
          {currentTab === 'tasks' && (
            <div className="relative hidden sm:block w-44">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all text-slate-800"
              />
            </div>
          )}

          {/* Notifications */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
              className="relative p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-0.5 right-0.5 h-3.5 w-3.5 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">
                  {notifications.length}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-xl py-3 z-50">
                <div className="px-4 pb-2 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-2.5 hover:bg-slate-50 flex items-start space-x-2.5 border-b border-slate-50 last:border-0">
                      {n.type === 'danger' && <CircleAlert className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />}
                      {n.type === 'warning' && <Clock className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                      {n.type === 'info' && <Sparkles className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />}
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
              className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center border border-indigo-200 cursor-pointer shadow-inner text-sm hover:bg-indigo-200 transition-all"
            >
              {user?.username?.substring(0, 2).toUpperCase() || 'ME'}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1 z-50">
                <div className="px-4 py-2 border-b border-slate-50">
                  <p className="text-[10px] text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{user?.username}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile nav ── */}
      <div className="flex md:hidden items-center justify-center space-x-2 bg-white px-4 py-2 border-b border-slate-100">
        {[['tasks', 'My Tasks'], ['reports', 'Reports']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setCurrentTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              currentTab === tab ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-5xl mx-auto px-4 lg:px-8 pt-8">

        {/* ════════════════════════ TASKS TAB ════════════════════════ */}
        {currentTab === 'tasks' && (
          <div>
            {/* Page title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Tasks</h1>
                <p className="text-slate-500 text-sm mt-1">Track, manage, and deliver your work on time.</p>
              </div>
              <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm text-xs font-semibold text-slate-600 w-fit">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={LayoutGrid}  label="Total Tasks"  value={stats.total}       accent="bg-indigo-50 text-indigo-600" />
              <StatCard icon={CirclePlay}  label="In Progress"  value={stats.in_progress} accent="bg-amber-50 text-amber-600" />
              <StatCard icon={CircleCheck} label="Completed"    value={stats.completed}   accent="bg-emerald-50 text-emerald-600" />
              <StatCard icon={Clock}       label="Overdue"      value={stats.overdue}     accent={stats.overdue > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'} />
            </div>

            {/* ── Create Task ── */}
            <div className="mb-8">
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl text-sm font-semibold text-indigo-500 hover:text-indigo-700 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add New Task</span>
                </button>
              ) : (
                <div className="bg-white rounded-2xl border border-indigo-300 shadow-lg shadow-indigo-50/50 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="border-l-4 border-indigo-600 pl-3">
                      <h2 className="text-sm font-bold text-slate-900">Create New Task</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                      className="h-7 w-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {createError && (
                    <div className="flex items-center space-x-2 bg-red-50 border border-red-100 text-red-700 text-xs font-medium px-4 py-2.5 rounded-xl mb-4">
                      <CircleAlert className="h-4 w-4 flex-shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Task Title *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Enter a clear task title…"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                      <textarea
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Add a short description (optional)…"
                        rows={2}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Priority</label>
                        <select
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Due Date</label>
                        <input
                          type="date"
                          value={newDue}
                          onChange={(e) => setNewDue(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                        className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{creating ? 'Creating…' : 'Create Task'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* ── Filter + Sort bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              {/* Mobile search */}
              <div className="sm:hidden relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
                {filterTabs.map(({ label, count }) => (
                  <button
                    key={label}
                    onClick={() => { setFilter(label); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                      filterStatus === label
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      filterStatus === label ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400 font-medium">Sort:</span>
                <select
                  value={ordering}
                  onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs"
                >
                  <option value="-created_at">Newest First</option>
                  <option value="due_date">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Title (A–Z)</option>
                </select>
              </div>
            </div>

            {/* ── Task List ── */}
            {listError && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center space-x-2">
                <CircleAlert className="h-4 w-4 flex-shrink-0" />
                <span>{listError}</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <svg className="animate-spin h-8 w-8 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs font-semibold text-slate-400">Loading tasks…</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-16 text-center shadow-sm">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100">
                  <SquareCheckBig className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">No Tasks Found</h3>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  {searchQuery
                    ? `No tasks match "${searchQuery}". Try a different search.`
                    : filterStatus !== 'All'
                    ? `No ${filterStatus} tasks. Switch filters or create a new task.`
                    : "You're all clear! Click 'Add New Task' to get started."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={setEditTask}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                      onSetStatus={handleSetStatus}
                    />
                  ))}
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={PAGE_SIZE}
                  onPageChange={handlePageChange}
                  isLoading={isLoading}
                />
              </>
            )}
          </div>
        )}

        {/* ════════════════════════ REPORTS TAB ════════════════════════ */}
        {currentTab === 'reports' && <Reports stats={stats} />}
      </main>

      {/* ── Edit Modal ── */}
      {editTask && (
        <EditModal
          task={editTask}
          onSave={handleEditSave}
          onClose={() => setEditTask(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
