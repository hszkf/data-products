/**
 * SQL Server Agent Job - Create/Edit Page
 *
 * Compact industrial terminal aesthetic with schedule configuration.
 * SQL editor with tab support and formatting helpers.
 */

import { createFileRoute, Link, useNavigate, useSearch, useBlocker } from '@tanstack/react-router';
import { useState, useRef, KeyboardEvent, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeProvider } from '~/lib/theme-context';
import { ToastProvider, useToast } from '~/components/ui/toast-provider';
import { TooltipProvider } from '~/components/ui/tooltip';
import { AppHeader } from '~/components/app-header';
import {
  createAgentJob,
  updateAgentJob,
  getAgentJobDetails,
  sendTestEmail,
  CreateAgentJobInput,
  UpdateAgentJobInput,
} from '~/lib/jobs-api';
import {
  Database,
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Terminal,
  FileText,
  Power,
  Clock,
  Calendar,
  Sparkles,
  AlignLeft,
  ChevronDown,
  Mail,
  Paperclip,
  CheckCircle2,
  XCircle,
  Eye,
  Send,
  X,
  MoreVertical,
} from 'lucide-react';

export const Route = createFileRoute('/jobs/agent/new')({
  component: AgentJobFormPage,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search.edit as string | undefined,
  }),
});

// Schedule presets
const SCHEDULE_PRESETS = [
  { label: 'Every minute', cron: '* * * * *', desc: 'Runs every minute' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *', desc: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *', desc: 'Runs every 15 minutes' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *', desc: 'Runs every 30 minutes' },
  { label: 'Hourly', cron: '0 * * * *', desc: 'Runs at the start of every hour' },
  { label: 'Daily at midnight', cron: '0 0 * * *', desc: 'Runs daily at 12:00 AM' },
  { label: 'Daily at 6 AM', cron: '0 6 * * *', desc: 'Runs daily at 6:00 AM' },
  { label: 'Daily at 8 AM', cron: '0 8 * * *', desc: 'Runs daily at 8:00 AM' },
  { label: 'Daily at 6 PM', cron: '0 18 * * *', desc: 'Runs daily at 6:00 PM' },
  { label: 'Weekly (Sunday)', cron: '0 0 * * 0', desc: 'Runs every Sunday at midnight' },
  { label: 'Weekly (Monday)', cron: '0 0 * * 1', desc: 'Runs every Monday at midnight' },
  { label: 'Monthly (1st)', cron: '0 0 1 * *', desc: 'Runs on the 1st of every month' },
  { label: 'Custom', cron: '', desc: 'Enter custom cron expression' },
];

// Email from options
const EMAIL_FROM_OPTIONS = [
  { value: 'arbmdata@alrajhibank.com.my', label: 'arbmdata@alrajhibank.com.my' },
  { value: 'BI-Alert@alrajhibank.com.my', label: 'BI-Alert@alrajhibank.com.my' },
];

// Validation constants
const JOB_NAME_INVALID_CHARS = /[\\/:*?"<>|]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation helper functions
function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function validateEmails(emails: string): { valid: boolean; invalidEmails: string[] } {
  if (!emails.trim()) return { valid: true, invalidEmails: [] };

  const emailList = emails.split(';').map(e => e.trim()).filter(e => e);
  const invalidEmails = emailList.filter(e => !validateEmail(e));

  return {
    valid: invalidEmails.length === 0,
    invalidEmails,
  };
}

function validateJobName(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Job name is required' };
  }
  if (name.length > 128) {
    return { valid: false, error: 'Job name must be 128 characters or less' };
  }
  if (JOB_NAME_INVALID_CHARS.test(name)) {
    return { valid: false, error: 'Job name cannot contain: \\ / : * ? " < > |' };
  }
  if (name.startsWith(' ') || name.endsWith(' ')) {
    return { valid: false, error: 'Job name cannot start or end with spaces' };
  }
  return { valid: true };
}

function validateCronExpression(cron: string): { valid: boolean; error?: string; description?: string } {
  if (!cron.trim()) {
    return { valid: false, error: 'Cron expression is required' };
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: 'Cron must have 5 parts: minute hour day month dayofweek' };
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Validate minute (0-59 or */n)
  if (!isValidCronPart(minute, 0, 59)) {
    return { valid: false, error: 'Invalid minute (0-59, *, or */n)' };
  }

  // Validate hour (0-23 or */n)
  if (!isValidCronPart(hour, 0, 23)) {
    return { valid: false, error: 'Invalid hour (0-23, *, or */n)' };
  }

  // Validate day (1-31 or *)
  if (!isValidCronPart(day, 1, 31)) {
    return { valid: false, error: 'Invalid day (1-31, *, or */n)' };
  }

  // Validate month (1-12 or *)
  if (!isValidCronPart(month, 1, 12)) {
    return { valid: false, error: 'Invalid month (1-12, *, or */n)' };
  }

  // Validate day of week (0-6 or *)
  if (!isValidCronPart(dayOfWeek, 0, 6)) {
    return { valid: false, error: 'Invalid day of week (0-6 where 0=Sunday, *, or */n)' };
  }

  // Generate human-readable description
  const description = generateCronDescription(parts);

  return { valid: true, description };
}

function isValidCronPart(part: string, min: number, max: number): boolean {
  if (part === '*') return true;

  // Check for */n pattern
  if (part.startsWith('*/')) {
    const interval = parseInt(part.slice(2));
    return !isNaN(interval) && interval > 0 && interval <= max;
  }

  // Check for single number
  const num = parseInt(part);
  return !isNaN(num) && num >= min && num <= max;
}

function generateCronDescription(parts: string[]): string {
  const [minute, hour, day, month, dayOfWeek] = parts;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  // Every N minutes
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2));
    return `Every ${interval} minute${interval > 1 ? 's' : ''}`;
  }

  // Every N hours
  if (hour.startsWith('*/')) {
    const interval = parseInt(hour.slice(2));
    return `Every ${interval} hour${interval > 1 ? 's' : ''}`;
  }

  // Build time string
  const hourNum = hour === '*' ? 0 : parseInt(hour);
  const minuteNum = minute === '*' ? 0 : parseInt(minute);
  const timeStr = `${hourNum.toString().padStart(2, '0')}:${minuteNum.toString().padStart(2, '0')}`;
  const period = hourNum >= 12 ? 'PM' : 'AM';
  const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
  const friendlyTime = `${hour12}:${minuteNum.toString().padStart(2, '0')} ${period}`;

  // Specific day of week
  if (dayOfWeek !== '*') {
    const dow = parseInt(dayOfWeek);
    return `Every ${dayNames[dow]} at ${friendlyTime}`;
  }

  // Specific day of month
  if (day !== '*' && dayOfWeek === '*') {
    const dayNum = parseInt(day);
    const suffix = dayNum === 1 ? 'st' : dayNum === 2 ? 'nd' : dayNum === 3 ? 'rd' : 'th';
    if (month !== '*') {
      const monthNum = parseInt(month);
      return `Every ${monthNames[monthNum]} ${dayNum}${suffix} at ${friendlyTime}`;
    }
    return `Every ${dayNum}${suffix} of the month at ${friendlyTime}`;
  }

  // Daily
  if (day === '*' && month === '*' && dayOfWeek === '*') {
    if (minute === '*' && hour === '*') {
      return 'Every minute';
    }
    return `Daily at ${friendlyTime}`;
  }

  return `At ${timeStr}`;
}

// Parse sp_send_dbmail command to extract original query and email config
function parseEmailCommand(command: string): {
  hasEmail: boolean;
  query: string;
  emailConfig?: {
    from_email: string;
    to_email: string;
    cc_email: string;
    bcc_email: string;
    subject: string;
    body: string;
    attachment_filename: string;
  };
} {
  // Check if command contains sp_send_dbmail
  if (!command.includes('sp_send_dbmail')) {
    return { hasEmail: false, query: command };
  }

  // Extract parameters from sp_send_dbmail
  const fromMatch = command.match(/@from_address\s*=\s*'([^']+)'/i);
  const toMatch = command.match(/@recipients\s*=\s*'([^']+)'/i);
  const ccMatch = command.match(/@copy_recipients\s*=\s*'([^']+)'/i);
  const bccMatch = command.match(/@blind_copy_recipients\s*=\s*'([^']+)'/i);
  const subjectMatch = command.match(/@subject\s*=\s*N?'([^']+)'/i);
  const bodyMatch = command.match(/@body\s*=\s*N?'([^']+)'/i);
  const queryMatch = command.match(/@query\s*=\s*N?'([^']+)'/i);
  const filenameMatch = command.match(/@query_attachment_filename\s*=\s*'([^']+)'/i);

  return {
    hasEmail: true,
    query: queryMatch ? queryMatch[1].replace(/''/g, "'") : '',
    emailConfig: {
      from_email: fromMatch ? fromMatch[1] : 'arbmdata@alrajhibank.com.my',
      to_email: toMatch ? toMatch[1] : '',
      cc_email: ccMatch ? ccMatch[1] : '',
      bcc_email: bccMatch ? bccMatch[1] : '',
      subject: subjectMatch ? subjectMatch[1] : '',
      body: bodyMatch ? bodyMatch[1].replace(/''/g, "'") : '',
      attachment_filename: filenameMatch ? filenameMatch[1] : 'QueryResults.csv',
    },
  };
}

// Convert SQL Server schedule to cron expression
function scheduleToCron(schedule: any): string {
  // freq_type: 4=Daily, 8=Weekly, 16=Monthly
  const freqType = schedule.freq_type;
  const freqInterval = schedule.freq_interval;
  const subdayType = schedule.freq_subday_type;
  const subdayInterval = schedule.freq_subday_interval;
  const startTime = schedule.active_start_time;

  // Parse time (HHMMSS format)
  const timeStr = startTime.toString().padStart(6, '0');
  const hour = parseInt(timeStr.slice(0, 2));
  const minute = parseInt(timeStr.slice(2, 4));

  // Handle subday intervals
  if (subdayType === 'Minutes' || subdayType === 4) {
    return `*/${subdayInterval} * * * *`;
  }
  if (subdayType === 'Hours' || subdayType === 8) {
    return `0 */${subdayInterval} * * *`;
  }

  // Weekly
  if (freqType === 'Weekly' || freqType === 8) {
    // Convert SQL Server bitmask to cron day of week
    const dowMap: Record<number, number> = {
      1: 0,  // Sunday
      2: 1,  // Monday
      4: 2,  // Tuesday
      8: 3,  // Wednesday
      16: 4, // Thursday
      32: 5, // Friday
      64: 6, // Saturday
    };
    const dow = dowMap[freqInterval] ?? 0;
    return `${minute} ${hour} * * ${dow}`;
  }

  // Monthly
  if (freqType === 'Monthly' || freqType === 16) {
    return `${minute} ${hour} ${freqInterval} * *`;
  }

  // Daily (default)
  return `${minute} ${hour} * * *`;
}

// Format SQL helper
function formatSQL(sql: string): string {
  let formatted = sql;

  // Add newlines before major keywords
  const newlineKeywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'UNION'];
  newlineKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword.toUpperCase()}`);
  });

  // Indent after SELECT, add comma formatting
  formatted = formatted.replace(/,\s*/g, ',\n    ');

  // Clean up multiple newlines
  formatted = formatted.replace(/\n\s*\n/g, '\n');

  // Trim and clean
  formatted = formatted.trim();

  return formatted;
}

// Field error types
interface FieldErrors {
  jobName?: string;
  command?: string;
  emailTo?: string;
  emailFrom?: string;
  emailCc?: string;
  emailBcc?: string;
  cron?: string;
}

// Confirmation dialog component
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'primary',
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'warning' | 'danger';
}) {
  if (!isOpen) return null;

  const variantStyles = {
    primary: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400',
    warning: 'from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400',
    danger: 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl"
      >
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-zinc-400 mb-5">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-zinc-400 hover:text-white text-xs font-medium rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-1.5 bg-gradient-to-r ${variantStyles[variant]} text-white font-medium text-xs rounded-lg shadow-lg transition-all`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EmailPreviewModal({
  isOpen,
  onClose,
  onSendTestEmail,
  onSendTestEmailWithAttachment,
  isSending,
  isSendingWithAttachment,
  emailFrom,
  emailTo,
  emailCc,
  emailBcc,
  emailSubject,
  emailBody,
  attachmentFilename,
  hasQuery,
  showSendMenu,
  setShowSendMenu,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSendTestEmail: () => void;
  onSendTestEmailWithAttachment: () => void;
  isSending: boolean;
  isSendingWithAttachment: boolean;
  emailFrom: string;
  emailTo: string;
  emailCc?: string;
  emailBcc?: string;
  emailSubject: string;
  emailBody: string;
  attachmentFilename: string;
  hasQuery: boolean;
  showSendMenu: boolean;
  setShowSendMenu: (show: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSendMenu(false);
      }
    };

    if (showSendMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSendMenu, setShowSendMenu]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-white">Email Preview</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-3">
          <div className="space-y-2">
            <div className="flex">
              <span className="text-[10px] text-zinc-500 w-16 shrink-0">From:</span>
              <span className="text-xs text-white font-mono">{emailFrom}</span>
            </div>
            <div className="flex">
              <span className="text-[10px] text-zinc-500 w-16 shrink-0">To:</span>
              <span className="text-xs text-white font-mono">{emailTo || '(Not specified)'}</span>
            </div>
            {emailCc && (
              <div className="flex">
                <span className="text-[10px] text-zinc-500 w-16 shrink-0">Cc:</span>
                <span className="text-xs text-white font-mono">{emailCc}</span>
              </div>
            )}
            {emailBcc && (
              <div className="flex">
                <span className="text-[10px] text-zinc-500 w-16 shrink-0">Bcc:</span>
                <span className="text-xs text-white font-mono">{emailBcc}</span>
              </div>
            )}
            <div className="flex">
              <span className="text-[10px] text-zinc-500 w-16 shrink-0">Subject:</span>
              <span className="text-xs text-white font-medium">{emailSubject || '(No subject)'}</span>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-zinc-500">Message Body:</span>
              <span className="text-[9px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded">
                HTML Supported
              </span>
            </div>
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-auto">
              <div
                className="text-xs text-zinc-300 leading-relaxed prose prose-invert prose-pink"
                dangerouslySetInnerHTML={{ __html: emailBody }}
              />
            </div>
          </div>

          {hasQuery && (
            <div className="border-t border-zinc-800 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] text-zinc-500">Attachment:</span>
              </div>
              <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2">
                <span className="text-xs text-pink-300 font-mono">{attachmentFilename}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-900/60">
          <span className="text-[10px] text-zinc-500 max-w-xs">
            {hasQuery
              ? 'Query results will be exported as CSV and attached to email'
              : 'T-SQL query must be filled to send email with attachment'}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-zinc-400 hover:text-white text-xs font-medium rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              Close
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowSendMenu(!showSendMenu);
                }}
                disabled={isSending || isSendingWithAttachment}
                className="group relative inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-600 to-pink-500 text-white font-medium text-xs rounded-lg hover:from-pink-500 hover:to-pink-400 disabled:opacity-50 shadow-lg shadow-pink-500/20 transition-all"
              >
                {isSending || isSendingWithAttachment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSendMenu ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {showSendMenu && (
                <div
                  ref={menuRef}
                  className="absolute right-0 mt-2 z-50 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl min-w-[200px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSendMenu(false);
                      onSendTestEmail();
                    }}
                    disabled={isSending}
                    className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Send Email Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSendMenu(false);
                      onSendTestEmailWithAttachment();
                    }}
                    disabled={isSendingWithAttachment || !hasQuery}
                    className={`w-full px-4 py-2 text-left text-xs flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      hasQuery
                        ? 'text-pink-300 hover:bg-zinc-800 hover:text-pink-200'
                        : 'text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <div className="flex-1">
                      <div>Send with Attachment</div>
                      {!hasQuery && (
                        <div className="text-[9px] text-zinc-600">Requires T-SQL query</div>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AgentJobFormContent() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { edit: editJobName } = useSearch({ from: '/jobs/agent/new' });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditMode = Boolean(editJobName);

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [jobName, setJobName] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Schedule state (enabled by default)
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(SCHEDULE_PRESETS[5]); // Daily at midnight
  const [customCron, setCustomCron] = useState('0 0 * * *');
  const [showPresets, setShowPresets] = useState(false);

  // Email notification state (always enabled)
  const [emailFrom, setEmailFrom] = useState('arbmdata@alrajhibank.com.my');
  const [showEmailFromDropdown, setShowEmailFromDropdown] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('<p>Hi,</p><p>Please find attached the query results.</p><p>Regards,<br/>BI Team</p>');
  const [attachmentFilename, setAttachmentFilename] = useState('QueryResults.csv');

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<React.FormEvent | null>(null);

  // Email preview modal state
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSendingTestEmailWithAttachment, setIsSendingTestEmailWithAttachment] = useState(false);

  // Track form dirty state for navigation warning using ref
  const initialFormStateRef = useRef<string>('');

  // Fixed values
  const databaseName = 'Staging';

  // Compute current form state for dirty check
  const currentFormState = useMemo(() => {
    return JSON.stringify({
      jobName, description, command, enabled,
      scheduleEnabled, customCron, emailFrom,
      emailTo, emailCc, emailBcc, emailSubject, emailBody, attachmentFilename,
    });
  }, [jobName, description, command, enabled, scheduleEnabled, customCron,
      emailFrom, emailTo, emailCc, emailBcc, emailSubject, emailBody, attachmentFilename]);

  // Derive dirty state from current vs initial form state (no useEffect needed)
  const isFormDirty = useMemo(() => {
    return Boolean(initialFormStateRef.current && currentFormState !== initialFormStateRef.current);
  }, [currentFormState]);

  // Block navigation when form is dirty
  const blocker = useBlocker({
    condition: isFormDirty && !isSaving,
  });

  // Cron validation and description
  const cronValidation = useMemo(() => {
    const effectiveCron = selectedPreset.cron || customCron;
    if (!scheduleEnabled) return { valid: true };
    return validateCronExpression(effectiveCron);
  }, [scheduleEnabled, selectedPreset.cron, customCron]);

  // Load job data function (defined first for ref pattern below)
  const loadJobData = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAgentJobDetails(name);
      if (result.success && result.job) {
        const job = result.job;
        setJobName(job.job_name);
        setDescription(job.description || '');
        setEnabled(job.enabled);

        // Parse step command and email config (declare outside if block for scope)
        const stepCommand = job.steps?.[0]?.command || '';
        const parsed = parseEmailCommand(stepCommand);

        // Load step command
        if (job.steps && job.steps.length > 0) {
          setCommand(parsed.query);

          if (parsed.hasEmail && parsed.emailConfig) {
            setEmailFrom(parsed.emailConfig.from_email);
            setEmailTo(parsed.emailConfig.to_email);
            setEmailCc(parsed.emailConfig.cc_email);
            setEmailBcc(parsed.emailConfig.bcc_email);
            setEmailSubject(parsed.emailConfig.subject);
            setEmailBody(parsed.emailConfig.body);
            setAttachmentFilename(parsed.emailConfig.attachment_filename);
          }
        }

        // Load schedule if exists
        if (job.schedules && job.schedules.length > 0) {
          setScheduleEnabled(true);
          const schedule = job.schedules[0];
          const cronExpr = scheduleToCron(schedule);
          setCustomCron(cronExpr);

          // Find matching preset or set to Custom
          const matchingPreset = SCHEDULE_PRESETS.find(p => p.cron === cronExpr);
          if (matchingPreset) {
            setSelectedPreset(matchingPreset);
          } else {
            setSelectedPreset(SCHEDULE_PRESETS.find(p => p.label === 'Custom')!);
          }
        }

        // Set initial form state after loading (using ref, no setTimeout needed)
        initialFormStateRef.current = JSON.stringify({
          jobName: job.job_name,
          description: job.description || '',
          command: parsed.query || stepCommand,
          enabled: job.enabled,
          scheduleEnabled: job.schedules && job.schedules.length > 0,
          customCron: job.schedules?.[0] ? scheduleToCron(job.schedules[0]) : '0 0 * * *',
          emailFrom: parsed.emailConfig?.from_email || 'arbmdata@alrajhibank.com.my',
          emailTo: parsed.emailConfig?.to_email || '',
          emailCc: parsed.emailConfig?.cc_email || '',
          emailBcc: parsed.emailConfig?.bcc_email || '',
          emailSubject: parsed.emailConfig?.subject || '',
          emailBody: parsed.emailConfig?.body || '<p>Hi,</p><p>Please find attached the query results.</p><p>Regards,<br/>BI Team</p>',
          attachmentFilename: parsed.emailConfig?.attachment_filename || 'QueryResults.csv',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load - use ref pattern instead of useEffect
  const hasInitiallyLoaded = useRef(false);
  const previousEditJobName = useRef(editJobName);

  if (!hasInitiallyLoaded.current || previousEditJobName.current !== editJobName) {
    hasInitiallyLoaded.current = true;
    previousEditJobName.current = editJobName;

    if (editJobName) {
      // Queue the async load operation
      loadJobData(editJobName);
    } else {
      // Set initial form state for new job
      initialFormStateRef.current = JSON.stringify({
        jobName: '', description: '', command: '', enabled: true,
        scheduleEnabled: true, customCron: '0 0 * * *', emailFrom: 'arbmdata@alrajhibank.com.my',
        emailTo: '', emailCc: '', emailBcc: '', emailSubject: '',
        emailBody: '<p>Hi,</p><p>Please find attached the query results.</p><p>Regards,<br/>BI Team</p>',
        attachmentFilename: 'QueryResults.csv',
      });
    }
  }

  // Handle tab key in textarea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Insert tab (4 spaces)
      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      setCommand(newValue);

      // Move cursor after tab
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }
  };

  const handleFormat = () => {
    setCommand(formatSQL(command));
  };

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    const errors: FieldErrors = {};
    let isValid = true;

    // Validate job name
    const jobNameValidation = validateJobName(jobName);
    if (!jobNameValidation.valid) {
      errors.jobName = jobNameValidation.error;
      isValid = false;
    }

    // Validate command
    if (!command.trim()) {
      errors.command = 'T-SQL command is required';
      isValid = false;
    }

    // Validate cron if schedule enabled
    if (scheduleEnabled) {
      const effectiveCron = selectedPreset.cron || customCron;
      const cronValidation = validateCronExpression(effectiveCron);
      if (!cronValidation.valid) {
        errors.cron = cronValidation.error;
        isValid = false;
      }
    }

    // Validate email fields (always required)
    // Validate To emails (required)
    if (!emailTo.trim()) {
      errors.emailTo = 'At least one recipient is required';
      isValid = false;
    } else {
      const toValidation = validateEmails(emailTo);
      if (!toValidation.valid) {
        errors.emailTo = `Invalid email(s): ${toValidation.invalidEmails.join(', ')}`;
        isValid = false;
      }
    }

    // Validate CC emails (optional)
    if (emailCc.trim()) {
      const ccValidation = validateEmails(emailCc);
      if (!ccValidation.valid) {
        errors.emailCc = `Invalid email(s): ${ccValidation.invalidEmails.join(', ')}`;
        isValid = false;
      }
    }

    // Validate BCC emails (optional)
    if (emailBcc.trim()) {
      const bccValidation = validateEmails(emailBcc);
      if (!bccValidation.valid) {
        errors.emailBcc = `Invalid email(s): ${bccValidation.invalidEmails.join(', ')}`;
        isValid = false;
      }
    }

    console.log('[Form] validateForm called', { isValid, errors });
    setFieldErrors(errors);
    return isValid;
  }, [jobName, command, scheduleEnabled, selectedPreset.cron, customCron, emailTo, emailCc, emailBcc]);

  // Handle send test email (without attachment)
  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setError(null);

    try {
      await sendTestEmail({
        from_email: emailFrom,
        to_email: emailTo,
        cc_email: emailCc || undefined,
        bcc_email: emailBcc || undefined,
        subject: emailSubject || `${jobName || 'Test'} - Query Results`,
        body: emailBody,
        query: undefined,
        attach_results: false,
        attachment_filename: attachmentFilename,
      });

      showToast('Test email sent successfully!', 'success');
      setShowEmailPreview(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send test email';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Handle send test email with attachment
  const handleSendTestEmailWithAttachment = async () => {
    setIsSendingTestEmailWithAttachment(true);
    setError(null);

    try {
      await sendTestEmail({
        from_email: emailFrom,
        to_email: emailTo,
        cc_email: emailCc || undefined,
        bcc_email: emailBcc || undefined,
        subject: emailSubject || `${jobName || 'Test'} - Query Results`,
        body: emailBody,
        query: command.trim(),
        attach_results: true,
        attachment_filename: attachmentFilename,
      });

      showToast('Test email with attachment sent successfully!', 'success');
      setShowEmailPreview(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send test email with attachment';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsSendingTestEmailWithAttachment(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Form] handleSubmit called', { jobName, hasQuery: !!command.trim(), emailTo });

    // Validate form
    if (!validateForm()) {
      setError('Please fix the validation errors below');
      return;
    }

    // Show confirmation dialog
    setPendingSubmit(e);
    setShowConfirmDialog(true);
  };

  // Perform actual submission after confirmation
  const performSubmit = async () => {
    setShowConfirmDialog(false);
    setPendingSubmit(null);
    setIsSaving(true);
    setError(null);

    try {
      const cronExpression = selectedPreset.cron || customCron;

      if (isEditMode && editJobName) {
        const input: UpdateAgentJobInput = {
          description,
          enabled,
          step_command: command,
          step_name: 'Execute Query',
          database_name: databaseName,
        };

        if (jobName !== editJobName) {
          input.new_name = jobName;
        }

        await updateAgentJob(editJobName, input);
        showToast(`Job "${jobName}" updated successfully`, 'success');
      } else {
        const input: CreateAgentJobInput = {
          job_name: jobName,
          description,
          step_name: 'Execute Query',
          step_command: command,
          database_name: databaseName,
          enabled,
          category: '[Uncategorized (Local)]',
          schedule_cron: cronExpression,
          email_notification: {
            enabled: true,
            from_email: emailFrom,
            to_email: emailTo,
            cc_email: emailCc || undefined,
            bcc_email: emailBcc || undefined,
            subject: emailSubject || `${jobName} - Query Results`,
            body: emailBody,
            attach_results: true,
            attachment_filename: attachmentFilename,
          },
        };

        await createAgentJob(input);
        showToast(`Job "${jobName}" created successfully`, 'success');
      }

      // Clear dirty state before navigation by syncing the ref with current state
      initialFormStateRef.current = currentFormState;
      navigate({ to: '/jobs', search: { created: undefined } });
    } catch (err: any) {
      setError(err.message || 'Failed to save job');
      showToast(err.message || 'Failed to save job', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  };

  const effectiveCron = selectedPreset.cron || customCron;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 60% at 50% -10%, rgba(59, 130, 246, 0.06), transparent 60%),
            radial-gradient(ellipse 60% 40% at 0% 80%, rgba(16, 185, 129, 0.02), transparent)
          `,
        }}
      />

      {/* Header */}
      <div className="sticky top-0 z-20">
        <AppHeader
          title="SQL Server Agent"
          icon={Database}
          iconClassName="bg-gradient-to-br from-blue-500 to-blue-700"
        />
      </div>

      <main className="flex-1 overflow-auto relative z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 mb-4"
          >
            <Link to="/jobs" search={{ created: undefined }}>
              <button className="group p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all duration-200">
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              </button>
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                {isEditMode ? (
                  <>
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Edit Job
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Create New Job
                  </>
                )}
                {isFormDirty && (
                  <span className="ml-2 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Unsaved changes
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono">
                {isEditMode ? editJobName : 'SQL Server Agent job configuration'}
              </p>
            </div>
          </motion.div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-xs text-zinc-500 mt-3 font-mono">Loading...</span>
            </div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-red-300">{error}</span>
                </motion.div>
              )}

              {/* Job Name */}
              <motion.div variants={itemVariants}>
                <div className={`bg-zinc-900/50 border rounded-lg p-3 transition-colors ${
                  fieldErrors.jobName ? 'border-red-500/50' : 'border-zinc-800/60 focus-within:border-blue-500/40'
                }`}>
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    <FileText className="w-3 h-3 text-blue-400" />
                    Job Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => {
                      setJobName(e.target.value);
                      if (fieldErrors.jobName) {
                        const validation = validateJobName(e.target.value);
                        setFieldErrors(prev => ({ ...prev, jobName: validation.error }));
                      }
                    }}
                    onBlur={() => {
                      const validation = validateJobName(jobName);
                      if (!validation.valid) {
                        setFieldErrors(prev => ({ ...prev, jobName: validation.error }));
                      }
                    }}
                    placeholder="Daily_Sales_Report"
                    className="w-full px-2.5 py-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded text-white placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
                    required
                    aria-invalid={!!fieldErrors.jobName}
                    aria-describedby={fieldErrors.jobName ? 'jobName-error' : undefined}
                  />
                  {fieldErrors.jobName && (
                    <p id="jobName-error" className="mt-1 text-[9px] text-red-400 flex items-center gap-1">
                      <XCircle className="w-2.5 h-2.5" />
                      {fieldErrors.jobName}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Description */}
              <motion.div variants={itemVariants}>
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-3 focus-within:border-zinc-600/60 transition-colors">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                    <AlignLeft className="w-3 h-3 text-zinc-500" />
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of what this job does..."
                    className="w-full px-2.5 py-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-zinc-600/50 transition-colors"
                  />
                </div>
              </motion.div>

              {/* Schedule (Always Required) */}
              <motion.div variants={itemVariants}>
                <div className={`bg-zinc-900/50 border rounded-lg transition-colors ${
                  fieldErrors.cron ? 'border-red-500/30' : 'border-amber-500/30'
                }`}>
                  {/* Schedule Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/40">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Schedule <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[9px] text-amber-400/70 font-medium">Required</span>
                  </div>

                  {/* Schedule Content */}
                  <div className="p-3 space-y-2">
                      {/* Preset Selector */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowPresets(!showPresets)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded text-xs text-white hover:border-amber-500/30 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            {selectedPreset.label}
                          </span>
                          <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Presets Dropdown */}
                        {showPresets && (
                          <div className="absolute z-[100] left-0 right-0 mt-1 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-48 overflow-auto">
                            {SCHEDULE_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setSelectedPreset(preset);
                                  if (preset.cron) setCustomCron(preset.cron);
                                  setShowPresets(false);
                                  setFieldErrors(prev => ({ ...prev, cron: undefined }));
                                }}
                                className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-zinc-800 transition-colors ${
                                  selectedPreset.label === preset.label ? 'bg-amber-500/10 text-amber-300' : 'text-zinc-300'
                                }`}
                              >
                                <div className="font-medium">{preset.label}</div>
                                {preset.cron && (
                                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{preset.cron}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cron Expression */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedPreset.label === 'Custom' ? customCron : selectedPreset.cron}
                          onChange={(e) => {
                            setCustomCron(e.target.value);
                            if (selectedPreset.label !== 'Custom') {
                              setSelectedPreset(SCHEDULE_PRESETS.find(p => p.label === 'Custom')!);
                            }
                            // Clear error on change
                            if (fieldErrors.cron) {
                              const validation = validateCronExpression(e.target.value);
                              setFieldErrors(prev => ({ ...prev, cron: validation.error }));
                            }
                          }}
                          placeholder="* * * * *"
                          className={`flex-1 px-2.5 py-1.5 bg-zinc-950/50 border rounded text-amber-300 placeholder-zinc-600 text-xs font-mono focus:outline-none transition-colors ${
                            fieldErrors.cron ? 'border-red-500/50' : 'border-zinc-800/50 focus:border-amber-500/50'
                          }`}
                          aria-invalid={!!fieldErrors.cron}
                        />
                        <div className="text-[9px] text-zinc-600 font-mono whitespace-nowrap">
                          min hr day mon dow
                        </div>
                      </div>

                      {/* Validation feedback */}
                      {fieldErrors.cron ? (
                        <div className="text-[10px] text-red-400 px-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {fieldErrors.cron}
                        </div>
                      ) : cronValidation.valid && cronValidation.description ? (
                        <div className="text-[10px] text-emerald-400 px-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {cronValidation.description}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-500 px-1">
                          {selectedPreset.desc || 'Custom cron schedule'}
                        </div>
                      )}
                  </div>
                </div>
              </motion.div>

              {/* T-SQL Editor */}
              <motion.div variants={itemVariants}>
                <div className={`bg-zinc-900/50 border rounded-lg transition-colors ${
                  fieldErrors.command ? 'border-red-500/40' : 'border-zinc-800/60 focus-within:border-cyan-500/40'
                }`}>
                  {/* Editor Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/60">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <Terminal className="w-3 h-3 text-cyan-400" />
                      T-SQL Command <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {databaseName}
                      </span>
                      <button
                        type="button"
                        onClick={handleFormat}
                        className="px-2 py-0.5 text-[9px] font-medium text-cyan-400 bg-cyan-500/10 rounded hover:bg-cyan-500/20 transition-colors"
                      >
                        Format
                      </button>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="relative">
                    {/* Line Numbers */}
                    <div className="absolute left-0 top-0 bottom-0 w-8 bg-zinc-950/60 border-r border-zinc-800/40 pointer-events-none select-none">
                      <div className="pt-2 pr-2 text-right text-[9px] font-mono text-zinc-700 leading-[18px]">
                        {command.split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                        {command.split('\n').length === 0 && <div>1</div>}
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={command}
                      onChange={(e) => {
                        setCommand(e.target.value);
                        if (fieldErrors.command && e.target.value.trim()) {
                          setFieldErrors(prev => ({ ...prev, command: undefined }));
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`-- Enter your T-SQL query
SELECT
    column1,
    column2
FROM your_table
WHERE condition = 'value'`}
                      rows={10}
                      className="w-full pl-10 pr-3 py-2 bg-zinc-950/70 text-cyan-100 placeholder-zinc-700 text-xs font-mono leading-[18px] focus:outline-none resize-y min-h-[180px] transition-colors"
                      spellCheck={false}
                      aria-invalid={!!fieldErrors.command}
                    />
                  </div>

                  {/* Editor Footer */}
                  <div className="px-3 py-1.5 bg-zinc-900/60 border-t border-zinc-800/40 flex items-center justify-between">
                    {fieldErrors.command ? (
                      <span className="text-[9px] text-red-400 flex items-center gap-1">
                        <XCircle className="w-2.5 h-2.5" />
                        {fieldErrors.command}
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {command.length} chars · {command.split('\n').length} lines · Tab = 4 spaces
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-600 font-mono">
                      Target: <span className="text-emerald-500">{databaseName}</span>
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Email Notification (Always Required) */}
              <motion.div variants={itemVariants}>
                <div className={`bg-zinc-900/50 border rounded-lg transition-colors ${
                  (fieldErrors.emailTo || fieldErrors.emailCc || fieldErrors.emailBcc)
                    ? 'border-red-500/30'
                    : 'border-pink-500/30'
                }`}>
                  {/* Email Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border-b border-zinc-800/40">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      <Mail className="w-3 h-3 text-pink-400" />
                      Email Results <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-pink-400/70 font-medium">Required</span>
                      <button
                        type="button"
                        onClick={() => setShowEmailPreview(true)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium text-pink-400 bg-pink-500/10 rounded hover:bg-pink-500/20 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {/* Email Content */}
                  <div className="p-3 space-y-2">
                    {/* From - Custom Dropdown matching input style */}
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] text-zinc-500 w-12 shrink-0 pt-2">From:</span>
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => setShowEmailFromDropdown(!showEmailFromDropdown)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded text-white text-xs font-mono hover:border-pink-500/50 focus:border-pink-500/50 focus:outline-none transition-colors"
                        >
                          <span>{emailFrom}</span>
                          <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showEmailFromDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showEmailFromDropdown && (
                          <div className="absolute z-50 left-0 right-0 mt-1 py-1 bg-zinc-900 border border-zinc-800 rounded shadow-xl">
                            {EMAIL_FROM_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setEmailFrom(option.value);
                                  setShowEmailFromDropdown(false);
                                }}
                                className={`w-full px-2.5 py-1.5 text-left text-xs font-mono transition-colors ${
                                  emailFrom === option.value
                                    ? 'bg-pink-500/20 text-pink-300'
                                    : 'text-zinc-300 hover:bg-zinc-800'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                      {/* To */}
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] text-zinc-500 w-12 shrink-0 pt-2">To: <span className="text-red-400">*</span></span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={emailTo}
                            onChange={(e) => {
                              setEmailTo(e.target.value);
                              if (fieldErrors.emailTo) {
                                setFieldErrors(prev => ({ ...prev, emailTo: undefined }));
                              }
                            }}
                            onBlur={() => {
                              if (!emailTo.trim()) {
                                setFieldErrors(prev => ({ ...prev, emailTo: 'At least one recipient is required' }));
                              } else {
                                const validation = validateEmails(emailTo);
                                if (!validation.valid) {
                                  setFieldErrors(prev => ({ ...prev, emailTo: `Invalid: ${validation.invalidEmails.join(', ')}` }));
                                }
                              }
                            }}
                            placeholder="user1@email.com; user2@email.com"
                            className={`w-full px-2.5 py-1.5 bg-zinc-950/50 border rounded text-white placeholder-zinc-600 text-xs font-mono focus:outline-none transition-colors ${
                              fieldErrors.emailTo ? 'border-red-500/50' : 'border-zinc-800/50 focus:border-pink-500/50'
                            }`}
                            aria-invalid={!!fieldErrors.emailTo}
                          />
                          {fieldErrors.emailTo && (
                            <p className="mt-0.5 text-[9px] text-red-400 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" />
                              {fieldErrors.emailTo}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* CC */}
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] text-zinc-500 w-12 shrink-0 pt-2">Cc:</span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={emailCc}
                            onChange={(e) => {
                              setEmailCc(e.target.value);
                              if (fieldErrors.emailCc) {
                                setFieldErrors(prev => ({ ...prev, emailCc: undefined }));
                              }
                            }}
                            onBlur={() => {
                              if (emailCc.trim()) {
                                const validation = validateEmails(emailCc);
                                if (!validation.valid) {
                                  setFieldErrors(prev => ({ ...prev, emailCc: `Invalid: ${validation.invalidEmails.join(', ')}` }));
                                }
                              }
                            }}
                            placeholder="cc1@email.com; cc2@email.com"
                            className={`w-full px-2.5 py-1.5 bg-zinc-950/50 border rounded text-white placeholder-zinc-600 text-xs font-mono focus:outline-none transition-colors ${
                              fieldErrors.emailCc ? 'border-red-500/50' : 'border-zinc-800/50 focus:border-pink-500/50'
                            }`}
                            aria-invalid={!!fieldErrors.emailCc}
                          />
                          {fieldErrors.emailCc && (
                            <p className="mt-0.5 text-[9px] text-red-400 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" />
                              {fieldErrors.emailCc}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* BCC */}
                      <div className="flex items-start gap-2">
                        <span className="text-[9px] text-zinc-500 w-12 shrink-0 pt-2">Bcc:</span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={emailBcc}
                            onChange={(e) => {
                              setEmailBcc(e.target.value);
                              if (fieldErrors.emailBcc) {
                                setFieldErrors(prev => ({ ...prev, emailBcc: undefined }));
                              }
                            }}
                            onBlur={() => {
                              if (emailBcc.trim()) {
                                const validation = validateEmails(emailBcc);
                                if (!validation.valid) {
                                  setFieldErrors(prev => ({ ...prev, emailBcc: `Invalid: ${validation.invalidEmails.join(', ')}` }));
                                }
                              }
                            }}
                            placeholder="bcc1@email.com; bcc2@email.com"
                            className={`w-full px-2.5 py-1.5 bg-zinc-950/50 border rounded text-white placeholder-zinc-600 text-xs font-mono focus:outline-none transition-colors ${
                              fieldErrors.emailBcc ? 'border-red-500/50' : 'border-zinc-800/50 focus:border-pink-500/50'
                            }`}
                            aria-invalid={!!fieldErrors.emailBcc}
                          />
                          {fieldErrors.emailBcc && (
                            <p className="mt-0.5 text-[9px] text-red-400 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" />
                              {fieldErrors.emailBcc}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/40">
                        <span className="text-[9px] text-zinc-500 w-12 shrink-0">Subject:</span>
                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder={`${jobName || 'Job'} - Query Results`}
                          className="flex-1 px-2.5 py-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-pink-500/50 transition-colors"
                        />
                      </div>

                      {/* Body */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-zinc-500">Message (HTML supported):</span>
                          <span className="text-[9px] text-pink-400/70">
                            Preview HTML formatting
                          </span>
                        </div>
                        <textarea
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          rows={10}
                          placeholder="<p>Hi,</p><p>Please find attached the query results.</p><p>Regards,<br/>BI Team</p>"
                          className="w-full px-2.5 py-2 bg-zinc-950/50 border border-zinc-800/50 rounded text-white placeholder-zinc-600 text-xs resize-y min-h-[200px] focus:outline-none focus:border-pink-500/50 transition-colors"
                        />
                      </div>

                      {/* Attachment */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/40">
                        <Paperclip className="w-3 h-3 text-pink-400" />
                        <span className="text-[9px] text-zinc-500">Attachment:</span>
                        <input
                          type="text"
                          value={attachmentFilename}
                          onChange={(e) => setAttachmentFilename(e.target.value)}
                          placeholder="QueryResults.csv"
                          className="flex-1 px-2 py-1 bg-zinc-950/50 border border-zinc-800/50 rounded text-pink-300 placeholder-zinc-600 text-[10px] font-mono focus:outline-none focus:border-pink-500/50 transition-colors"
                        />
                      </div>

                    <div className="text-[9px] text-zinc-600 px-1">
                      Separate multiple recipients with semicolon (;). Query results exported as CSV.
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Enabled Toggle */}
              <motion.div variants={itemVariants}>
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Power className={`w-3.5 h-3.5 ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <div>
                        <span className="text-xs font-medium text-white">Job Enabled</span>
                        <p className="text-[9px] text-zinc-500">
                          {enabled ? 'Will execute on schedule' : 'Disabled'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnabled(!enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                      aria-label={enabled ? 'Disable job' : 'Enable job'}
                      aria-pressed={enabled}
                    >
                      <motion.span
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                        style={{ left: enabled ? '18px' : '2px' }}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between pt-2 relative z-10"
              >
                <Link to="/jobs" search={{ created: undefined }}>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs font-medium rounded hover:bg-zinc-800/50 transition-colors"
                  >
                    Cancel
                  </button>
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="group relative inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-xs rounded-lg hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 shadow-lg shadow-blue-500/20 transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEditMode ? 'Update Job' : 'Create Job'}</span>
                    </>
                  )}
                </button>
              </motion.div>
            </motion.form>
          )}
        </div>
      </main>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title={isEditMode ? 'Update Job' : 'Create Job'}
          message={isEditMode
            ? `Are you sure you want to update "${jobName}"? This will modify the existing job configuration.`
            : `Are you sure you want to create the job "${jobName}"?${scheduleEnabled ? ' It will be scheduled to run automatically.' : ''}`
          }
          confirmLabel={isEditMode ? 'Update' : 'Create'}
          cancelLabel="Cancel"
          onConfirm={performSubmit}
          onCancel={() => {
            setShowConfirmDialog(false);
            setPendingSubmit(null);
          }}
          variant="primary"
        />
      </AnimatePresence>

      {/* Navigation Blocker Dialog */}
      <AnimatePresence>
        {blocker.status === 'blocked' && (
          <ConfirmDialog
            isOpen={true}
            title="Unsaved Changes"
            message="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
            confirmLabel="Leave"
            cancelLabel="Stay"
            onConfirm={() => blocker.proceed?.()}
            onCancel={() => blocker.reset?.()}
            variant="warning"
          />
        )}
      </AnimatePresence>

      {/* Email Preview Modal */}
      <AnimatePresence>
        {showEmailPreview && (
          <EmailPreviewModal
            isOpen={showEmailPreview}
            onClose={() => {
              setShowEmailPreview(false);
              setShowSendMenu(false);
            }}
            onSendTestEmail={handleSendTestEmail}
            onSendTestEmailWithAttachment={handleSendTestEmailWithAttachment}
            isSending={isSendingTestEmail}
            isSendingWithAttachment={isSendingTestEmailWithAttachment}
            emailFrom={emailFrom}
            emailTo={emailTo}
            emailCc={emailCc}
            emailBcc={emailBcc}
            emailSubject={emailSubject || `${jobName || 'Job'} - Query Results`}
            emailBody={emailBody}
            attachmentFilename={attachmentFilename}
            hasQuery={!!command.trim()}
            showSendMenu={showSendMenu}
            setShowSendMenu={setShowSendMenu}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AgentJobFormPage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={300}>
          <AgentJobFormContent />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
