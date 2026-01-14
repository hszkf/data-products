import { createFileRoute } from '@tanstack/react-router';
import * as React from 'react';
import {
  Play,
  Database,
  ChevronRight,
  ChevronDown,
  Table2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Columns,
  MessageSquare,
  LayoutGrid,
  Folder,
  FolderOpen,
  Server,
  Cloud,
  RefreshCw,
  Clock,
  Rows3,
  Zap,
  Plus,
  X,
  TableProperties,
} from 'lucide-react';
import { cn } from '~/lib/utils';
import { AppHeader } from '~/components/app-header';
import {
  executeUnifiedQuery,
  getUnifiedHealth,
  getUnifiedSchemas,
  type UnifiedQueryResult,
  type UnifiedHealthStatus,
  type UnifiedSchemaResult,
} from '~/lib/api';

export const Route = createFileRoute('/sqlv2')({
  component: SQLv2Page,
});

const ROWS_PER_PAGE = 100;
const SCHEMA_CACHE_KEY = 'sql-schema-cache';
const SCHEMA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const TABS_STORAGE_KEY = 'sqlv2-tabs';
const HEALTH_CACHE_KEY = 'sqlv2-health-cache';
const HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface HealthCache {
  data: UnifiedHealthStatus;
  timestamp: number;
}

function getHealthFromCache(): UnifiedHealthStatus | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(HEALTH_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: HealthCache = JSON.parse(cached);
    if (Date.now() - timestamp < HEALTH_CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveHealthToCache(data: UnifiedHealthStatus): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

interface SchemaCache {
  data: UnifiedSchemaResult;
  timestamp: number;
}

interface QueryTab {
  id: string;
  name: string;
  query: string;
  result: UnifiedQueryResult | null;
}

function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function loadTabsFromStorage(): QueryTab[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(TABS_STORAGE_KEY);
    if (saved) {
      const tabs = JSON.parse(saved) as QueryTab[];
      return tabs.map(tab => ({ ...tab, result: null }));
    }
  } catch (e) {
    console.error('[Tabs] Error loading tabs:', e);
  }
  return [];
}

function saveTabsToStorage(tabs: QueryTab[]): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave = tabs.map(({ id, name, query }) => ({ id, name, query, result: null }));
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('[Tabs] Error saving tabs:', e);
  }
}

function getSchemaFromCache(): UnifiedSchemaResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: SchemaCache = JSON.parse(cached);
    if (Date.now() - timestamp < SCHEMA_CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveSchemaToCache(data: UnifiedSchemaResult): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function clearSchemaCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SCHEMA_CACHE_KEY);
}

const defaultQuery = `SELECT *
FROM rs.redshift_customers.public_customers rs
LEFT JOIN ss.[dbo].RBS_rbsdw98d_trx_ISS_SORT ss
  ON rs.bank_cic = ss.Customer_Internal_Code
WHERE ss.Customer_Internal_Code = '0000000000562810'`;

function SQLv2Page() {
  const [tabs, setTabs] = React.useState<QueryTab[]>(() => {
    const saved = loadTabsFromStorage();
    if (saved.length > 0) return saved;
    return [{ id: generateTabId(), name: 'Query 1', query: defaultQuery, result: null }];
  });
  const [activeTabId, setActiveTabId] = React.useState<string>(() => {
    const saved = loadTabsFromStorage();
    return saved.length > 0 ? saved[0].id : tabs[0]?.id || '';
  });

  const activeQueryTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const query = activeQueryTab?.query || '';
  const result = activeQueryTab?.result || null;

  const setQuery = React.useCallback((newQuery: string | ((prev: string) => string)) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, query: typeof newQuery === 'function' ? newQuery(tab.query) : newQuery };
      }
      return tab;
    }));
  }, [activeTabId]);

  const setResult = React.useCallback((newResult: UnifiedQueryResult | null) => {
    setTabs(prev => prev.map(tab => tab.id === activeTabId ? { ...tab, result: newResult } : tab));
  }, [activeTabId]);

  const [health, setHealth] = React.useState<UnifiedHealthStatus | null>(null);
  const [schemas, setSchemas] = React.useState<UnifiedSchemaResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = React.useState(false);
  const [activeResultTab, setActiveResultTab] = React.useState<'results' | 'columns' | 'messages'>('results');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [expandedSchemas, setExpandedSchemas] = React.useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sqlv2-sidebar-width');
      return saved ? parseInt(saved, 10) : 240;
    }
    return 240;
  });
  const [editorHeight, setEditorHeight] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sqlv2-editor-height');
      return saved ? parseInt(saved, 10) : 224;
    }
    return 224;
  });
  const [resizeType, setResizeType] = React.useState<'sidebar' | 'editor' | null>(null);
  const [cursorPosition, setCursorPosition] = React.useState({ line: 1, column: 1 });
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => { saveTabsToStorage(tabs); }, [tabs]);

  const addTab = React.useCallback(() => {
    const newTab: QueryTab = {
      id: generateTabId(),
      name: `Query ${tabs.length + 1}`,
      query: '-- New query\nSELECT 1',
      result: null,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  const closeTab = React.useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (tabId === activeTabId) {
      setActiveTabId(newTabs[Math.min(tabIndex, newTabs.length - 1)].id);
    }
  }, [tabs, activeTabId]);

  React.useEffect(() => {
    // Check cache first for instant UI
    const cachedHealth = getHealthFromCache();
    if (cachedHealth) {
      setHealth(cachedHealth);
    }

    const fetchHealth = async () => {
      const data = await getUnifiedHealth();
      setHealth(data);
      saveHealthToCache(data);
    };

    // Only fetch immediately if no cache
    if (!cachedHealth) {
      fetchHealth();
    } else {
      // Refresh in background after 2 seconds
      const timer = setTimeout(fetchHealth, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    const cached = getSchemaFromCache();
    if (cached) {
      setSchemas(cached);
    } else {
      setIsLoadingSchema(true);
      getUnifiedSchemas()
        .then((data) => { setSchemas(data); saveSchemaToCache(data); })
        .finally(() => setIsLoadingSchema(false));
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sqlv2-sidebar-width', String(sidebarWidth));
    }
  }, [sidebarWidth]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sqlv2-editor-height', String(editorHeight));
    }
  }, [editorHeight]);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeType) return;

      if (resizeType === 'sidebar') {
        setSidebarWidth(Math.min(Math.max(e.clientX, 180), 400));
      } else if (resizeType === 'editor' && editorContainerRef.current) {
        const containerRect = editorContainerRef.current.getBoundingClientRect();
        const newHeight = e.clientY - containerRect.top;
        setEditorHeight(Math.min(Math.max(newHeight, 100), window.innerHeight - 200));
      }
    };
    const handleMouseUp = () => setResizeType(null);

    if (resizeType) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = resizeType === 'sidebar' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizeType]);

  const handleExecute = React.useCallback(async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setResult(null);
    setCurrentPage(1);

    try {
      const res = await executeUnifiedQuery(query);
      setResult(res);
      setActiveResultTab(res.status === 'error' ? 'messages' : 'results');
    } catch (error: any) {
      setResult({
        status: 'error',
        columns: [],
        rows: [],
        row_count: 0,
        execution_time: 0,
        error: error.message,
      });
      setActiveResultTab('messages');
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleExecute();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      setQuery(query.substring(0, start) + '  ' + query.substring(end));
      setTimeout(() => { target.selectionStart = target.selectionEnd = start + 2; }, 0);
    }
  }, [query, handleExecute]);

  const handleEditorScroll = React.useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = target.scrollTop;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  }, []);

  const handleCursorChange = React.useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const pos = target.selectionStart;
    const lines = target.value.substring(0, pos).split('\n');
    setCursorPosition({ line: lines.length, column: lines[lines.length - 1].length + 1 });
  }, []);

  const toggleSchema = (key: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const insertTableRef = (source: 'rs' | 'ss', schema: string, table: string) => {
    const ref = `${source}.${schema}.${table}`;
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      setQuery(query.substring(0, start) + ref + query.substring(end));
      textareaRef.current.focus();
    }
  };

  const refreshSchemas = () => {
    clearSchemaCache();
    setIsLoadingSchema(true);
    getUnifiedSchemas()
      .then((data) => { setSchemas(data); saveSchemaToCache(data); })
      .finally(() => setIsLoadingSchema(false));
  };

  const totalRows = result?.rows?.length || 0;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  const paginatedRows = result?.rows?.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE) || [];

  return (
    <div className="h-screen flex flex-col bg-surface text-on-surface overflow-hidden">
      <AppHeader title="SQL Studio" icon={Zap} iconClassName="bg-gradient-to-br from-redshift to-sqlserver" />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Schema Browser Sidebar */}
        <aside className="relative flex-shrink-0 bg-surface-container flex flex-col border-r border-outline-variant/50" style={{ width: sidebarWidth }}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/30 bg-gradient-to-r from-surface-container-high/50 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br from-redshift/20 to-sqlserver/20">
                <Database className="w-3.5 h-3.5 text-on-surface-variant" />
              </div>
              <span className="text-[11px] font-semibold text-on-surface uppercase tracking-wide">Explorer</span>
            </div>
            <button
              onClick={refreshSchemas}
              disabled={isLoadingSchema}
              className="p-1.5 rounded-md hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoadingSchema && 'animate-spin')} />
            </button>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-outline-variant/30 bg-surface-container-high/30">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3 h-3 text-redshift" />
              <span className="text-[10px] text-on-surface-variant">Redshift</span>
              <div className={cn('w-1.5 h-1.5 rounded-full', health?.redshift?.connected ? 'bg-green-500' : 'bg-red-500')} />
            </div>
            <div className="w-px h-3 bg-outline-variant/50" />
            <div className="flex items-center gap-1.5">
              <Server className="w-3 h-3 text-sqlserver" />
              <span className="text-[10px] text-on-surface-variant">SQL Server</span>
              <div className={cn('w-1.5 h-1.5 rounded-full', health?.sqlserver?.connected ? 'bg-green-500' : 'bg-red-500')} />
            </div>
          </div>

          {/* Redshift Section */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-outline-variant/30">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-redshift/5 border-b border-outline-variant/20">
              <Cloud className="w-3 h-3 text-redshift" />
              <span className="text-[10px] font-semibold text-redshift">REDSHIFT</span>
              <span className="text-[9px] text-redshift/50 ml-0.5">rs.</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSchema ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-redshift/50" />
                </div>
              ) : (
                <SchemaTree
                  source="rs"
                  color="redshift"
                  schemas={schemas?.schemas?.redshift || {}}
                  expandedSchemas={expandedSchemas}
                  onToggle={toggleSchema}
                  onTableClick={insertTableRef}
                />
              )}
            </div>
            <div className="px-3 py-1.5 text-[9px] text-on-surface-variant bg-surface-container-high/30 border-t border-outline-variant/20">
              {schemas?.summary?.redshift.schemas || 0} schemas · {schemas?.summary?.redshift.tables || 0} tables
            </div>
          </div>

          {/* SQL Server Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sqlserver/5 border-b border-outline-variant/20">
              <Server className="w-3 h-3 text-sqlserver" />
              <span className="text-[10px] font-semibold text-sqlserver">SQL SERVER</span>
              <span className="text-[9px] text-sqlserver/50 ml-0.5">ss.</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSchema ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-sqlserver/50" />
                </div>
              ) : (
                <SchemaTree
                  source="ss"
                  color="sqlserver"
                  schemas={schemas?.schemas?.sqlserver || {}}
                  expandedSchemas={expandedSchemas}
                  onToggle={toggleSchema}
                  onTableClick={insertTableRef}
                />
              )}
            </div>
            <div className="px-3 py-1.5 text-[9px] text-on-surface-variant bg-surface-container-high/30 border-t border-outline-variant/20">
              {schemas?.summary?.sqlserver.schemas || 0} schemas · {schemas?.summary?.sqlserver.tables || 0} tables
            </div>
          </div>

          {/* Sidebar Resize Handle */}
          <div
            onMouseDown={(e) => { e.preventDefault(); setResizeType('sidebar'); }}
            className={cn(
              'absolute top-0 -right-1 w-2 h-full cursor-col-resize z-10',
              'hover:bg-primary/30 transition-colors',
              resizeType === 'sidebar' && 'bg-primary/50'
            )}
          />
        </aside>

        {/* Editor + Results */}
        <div ref={editorContainerRef} className="flex-1 flex flex-col min-w-0">
          {/* Query Tabs + Run Button */}
          <div className="flex-shrink-0 h-9 bg-surface-container border-b border-outline-variant/50 flex items-center justify-between">
            <div className="flex-1 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-9 cursor-pointer border-r border-outline-variant/30 group',
                    'text-[11px] transition-colors min-w-0',
                    tab.id === activeTabId
                      ? 'bg-surface text-on-surface border-b-2 border-b-primary'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                  )}
                >
                  <span className="truncate max-w-[120px]">{tab.name}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      className={cn(
                        'p-0.5 rounded hover:bg-surface-container-highest opacity-0 group-hover:opacity-100 transition-opacity',
                        tab.id === activeTabId && 'opacity-40'
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTab}
                className="flex-shrink-0 p-2 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                title="New Query Tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Run Button */}
            <div className="flex-shrink-0 px-2">
              <button
                onClick={handleExecute}
                disabled={isLoading || !query.trim()}
                className={cn(
                  'flex items-center gap-1.5 px-3 h-7 rounded-md text-[11px] font-medium transition-all',
                  'bg-gradient-to-r from-redshift to-sqlserver text-white',
                  'hover:opacity-90 shadow-sm',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run
                <kbd className="ml-1.5 px-1 py-0.5 rounded bg-white/20 text-[9px]">⌘↵</kbd>
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="relative flex-shrink-0 flex bg-surface" style={{ height: editorHeight }}>
            {/* Line Numbers */}
            <div ref={lineNumbersRef} className="line-numbers">
              {query.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative overflow-hidden">
              <pre
                ref={highlightRef}
                className="code-highlight"
                style={{ tabSize: 2 }}
                aria-hidden="true"
              >
                <code dangerouslySetInnerHTML={{ __html: highlightSQL(query) + '\n' }} />
              </pre>
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleEditorScroll}
                onClick={handleCursorChange}
                onKeyUp={handleCursorChange}
                spellCheck={false}
                className="code-editor"
                style={{ tabSize: 2 }}
                placeholder="-- Enter your cross-database SQL query here..."
              />
            </div>

            {/* Editor Resize Handle */}
            <div
              onMouseDown={(e) => { e.preventDefault(); setResizeType('editor'); }}
              className={cn(
                'absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize z-10',
                'hover:bg-primary/30 transition-colors',
                resizeType === 'editor' && 'bg-primary/50'
              )}
            />
          </div>

          {/* Results Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Results Tabs */}
            <div className="flex items-center justify-between h-8 px-2 bg-surface-container border-b border-outline-variant/50">
              <div className="flex items-center gap-1">
                {(['results', 'columns', 'messages'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveResultTab(tab)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors',
                      activeResultTab === tab
                        ? 'bg-surface text-on-surface'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'
                    )}
                  >
                    {tab === 'results' && <LayoutGrid className="w-3 h-3" />}
                    {tab === 'columns' && <Columns className="w-3 h-3" />}
                    {tab === 'messages' && <MessageSquare className="w-3 h-3" />}
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'messages' && result?.error && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </button>
                ))}
              </div>

              {result?.status === 'success' && (
                <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
                  <div className="flex items-center gap-1">
                    <Rows3 className="w-3 h-3" />
                    <span className="text-on-surface font-medium">{result.row_count}</span> rows
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-on-surface font-medium">{result.execution_time}</span> ms
                  </div>
                  {result.source && (
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase',
                      result.source === 'redshift' && 'bg-redshift/10 text-redshift',
                      result.source === 'sqlserver' && 'bg-sqlserver/10 text-sqlserver',
                      result.source === 'cross' && 'bg-purple-500/10 text-purple-500'
                    )}>
                      {result.source}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
              {activeResultTab === 'results' && <ResultsTable columns={result?.columns || []} rows={paginatedRows} isLoading={isLoading} />}
              {activeResultTab === 'columns' && <ColumnsTable columns={result?.columns || []} />}
              {activeResultTab === 'messages' && <MessagesPanel error={result?.error} message={result?.message} source={result?.source} />}
            </div>

            {/* Pagination */}
            {activeResultTab === 'results' && totalPages > 1 && (
              <div className="flex items-center justify-between px-3 h-7 bg-surface-container border-t border-outline-variant/50">
                <span className="text-[10px] text-on-surface-variant">
                  Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-{Math.min(currentPage * ROWS_PER_PAGE, totalRows)} of {totalRows}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-0.5 text-[10px] rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-[10px] text-on-surface-variant">{currentPage}/{totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-0.5 text-[10px] rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-surface-container border-t border-outline-variant text-[10px] text-on-surface-variant">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Unified Query Engine
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            Cross-source
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <TableProperties className="w-3 h-3" />
            rs. / ss.
          </span>
          <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        </div>
      </div>
    </div>
  );
}

// ============ Components ============

function SchemaTree({
  source,
  color,
  schemas,
  expandedSchemas,
  onToggle,
  onTableClick,
}: {
  source: 'rs' | 'ss';
  color: 'redshift' | 'sqlserver';
  schemas: Record<string, string[]>;
  expandedSchemas: Set<string>;
  onToggle: (key: string) => void;
  onTableClick: (source: 'rs' | 'ss', schema: string, table: string) => void;
}) {
  const schemaEntries = Object.entries(schemas);

  if (schemaEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
        <Database className="w-5 h-5 mb-2 opacity-30" />
        <span className="text-[10px]">No schemas found</span>
      </div>
    );
  }

  return (
    <div className="py-1">
      {schemaEntries.map(([schemaName, tables]) => {
        const key = `${source}.${schemaName}`;
        const isExpanded = expandedSchemas.has(key);

        return (
          <div key={key}>
            <button
              onClick={() => onToggle(key)}
              className="w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-surface-container-high/50 transition-colors group"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className={cn('w-3 h-3 flex-shrink-0', color === 'redshift' ? 'text-redshift' : 'text-sqlserver')} />
              ) : (
                <Folder className={cn('w-3 h-3 flex-shrink-0', color === 'redshift' ? 'text-redshift/60' : 'text-sqlserver/60')} />
              )}
              <span className="text-[10px] text-on-surface truncate flex-1">{schemaName}</span>
              <span className={cn(
                'text-[9px] px-1.5 py-0.5 rounded flex-shrink-0',
                color === 'redshift' ? 'bg-redshift/10 text-redshift/70' : 'bg-sqlserver/10 text-sqlserver/70'
              )}>
                {tables.length}
              </span>
            </button>

            {isExpanded && (
              <div className="ml-4 border-l border-outline-variant/30">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => onTableClick(source, schemaName, table)}
                    className="w-full flex items-center gap-1.5 pl-3 pr-3 py-1 text-left hover:bg-surface-container-high/50 transition-colors group"
                  >
                    <Table2 className={cn(
                      'w-3 h-3 flex-shrink-0',
                      color === 'redshift' ? 'text-redshift/40 group-hover:text-redshift/70' : 'text-sqlserver/40 group-hover:text-sqlserver/70'
                    )} />
                    <span className="text-[10px] text-on-surface-variant group-hover:text-on-surface truncate">{table}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultsTable({ columns, rows, isLoading }: { columns: string[]; rows: Record<string, unknown>[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-[10px] text-on-surface-variant">Executing query...</span>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <LayoutGrid className="w-6 h-6 mb-2 opacity-30" />
        <span className="text-[10px]">Run a query to see results</span>
        <span className="text-[9px] mt-1 opacity-60">Press ⌘+Enter to execute</span>
      </div>
    );
  }

  return (
    <table className="w-full text-[10px]">
      <thead className="sticky top-0 bg-surface-container">
        <tr>
          {columns.map((col) => (
            <th key={col} className="px-3 py-2 text-left font-semibold text-on-surface border-b border-outline-variant/50 whitespace-nowrap">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-outline-variant/20 hover:bg-surface-container-high/30 transition-colors">
            {columns.map((col) => (
              <td key={col} className="px-3 py-1.5 text-on-surface whitespace-nowrap">{formatValue(row[col])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ColumnsTable({ columns }: { columns: string[] }) {
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <Columns className="w-6 h-6 mb-2 opacity-30" />
        <span className="text-[10px]">Run a query to see columns</span>
      </div>
    );
  }

  return (
    <table className="w-full text-[10px]">
      <thead className="sticky top-0 bg-surface-container">
        <tr>
          <th className="px-3 py-2 text-left font-semibold text-on-surface border-b border-outline-variant/50 w-16">#</th>
          <th className="px-3 py-2 text-left font-semibold text-on-surface border-b border-outline-variant/50">Column Name</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((col, i) => (
          <tr key={col} className="border-b border-outline-variant/20 hover:bg-surface-container-high/30 transition-colors">
            <td className="px-3 py-1.5 text-on-surface-variant">{i + 1}</td>
            <td className="px-3 py-1.5 text-on-surface">{col}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MessagesPanel({ error, message, source }: { error?: string; message?: string; source?: string }) {
  if (!error && !message) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <MessageSquare className="w-6 h-6 mb-2 opacity-30" />
        <span className="text-[10px]">No messages</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-semibold text-red-700 dark:text-red-500 mb-1">Error</h4>
            <pre className="text-[10px] text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">{error}</pre>
          </div>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-semibold text-green-700 dark:text-green-500 mb-1">Success</h4>
            <p className="text-[10px] text-green-600 dark:text-green-400">{message}</p>
            {source && <p className="text-[9px] text-on-surface-variant mt-1">Source: {source}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toLocaleString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function highlightSQL(sql: string): string {
  let html = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS',
    'NULL', 'AS', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS',
    'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'TOP',
    'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'EXISTS', 'CASE', 'WHEN',
    'THEN', 'ELSE', 'END', 'CAST', 'CONVERT', 'COALESCE', 'NULLIF', 'WITH',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'TRUNCATE', 'CREATE',
    'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'PRIMARY',
    'KEY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'DEFAULT', 'UNIQUE', 'CHECK',
  ];

  const functions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
    'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'LENGTH', 'LEN', 'SUBSTRING',
    'CONCAT', 'REPLACE', 'CHARINDEX', 'PATINDEX', 'REVERSE',
    'NOW', 'GETDATE', 'DATEADD', 'DATEDIFF', 'DATEPART', 'YEAR', 'MONTH', 'DAY',
    'HOUR', 'MINUTE', 'SECOND', 'ISNULL', 'NVL', 'IFNULL', 'ROW_NUMBER', 'RANK',
    'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'OVER',
    'PARTITION', 'LISTAGG', 'STRING_AGG', 'JSON_VALUE', 'JSON_QUERY',
  ];

  html = html.replace(/'([^']*?)'/g, '<span class="sql-string">\'$1\'</span>');
  html = html.replace(/(--.*?)$/gm, '<span class="sql-comment">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sql-comment">$1</span>');
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="sql-number">$1</span>');

  for (const kw of keywords) {
    html = html.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), '<span class="sql-keyword">$1</span>');
  }

  for (const fn of functions) {
    html = html.replace(new RegExp(`\\b(${fn})\\s*(?=\\()`, 'gi'), '<span class="sql-function">$1</span>');
  }

  html = html.replace(/\b(rs)\./gi, '<span class="text-redshift font-semibold">$1</span>.');
  html = html.replace(/\b(ss)\./gi, '<span class="text-sqlserver font-semibold">$1</span>.');

  return html;
}
