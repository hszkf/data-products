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
} from 'lucide-react';
import { cn } from '~/lib/utils';
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
const SCHEMA_CACHE_KEY = 'sqlv2-schema-cache';
const SCHEMA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TABS_STORAGE_KEY = 'sqlv2-tabs';

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
      // Clear results on load (don't persist results)
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
    // Don't persist results, only id, name, query
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
    const age = Date.now() - timestamp;

    if (age < SCHEMA_CACHE_TTL) {
      console.log(`[Schema Cache] Using cached schema (age: ${Math.round(age / 1000 / 60)} minutes)`);
      return data;
    }

    console.log('[Schema Cache] Cache expired, will fetch fresh data');
    return null;
  } catch (e) {
    console.error('[Schema Cache] Error reading cache:', e);
    return null;
  }
}

function saveSchemaToCache(data: UnifiedSchemaResult): void {
  if (typeof window === 'undefined') return;

  try {
    const cache: SchemaCache = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(cache));
    console.log('[Schema Cache] Schema cached successfully');
  } catch (e) {
    console.error('[Schema Cache] Error saving cache:', e);
  }
}

function clearSchemaCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SCHEMA_CACHE_KEY);
  console.log('[Schema Cache] Cache cleared');
}

const defaultQuery = `SELECT *
FROM rs.redshift_customers.public_customers rs
LEFT JOIN ss.[dbo].RBS_rbsdw98d_trx_ISS_SORT ss
  ON rs.bank_cic = ss.Customer_Internal_Code
WHERE ss.Customer_Internal_Code = '0000000000562810'`;

function SQLv2Page() {
  // Tab management
  const [tabs, setTabs] = React.useState<QueryTab[]>(() => {
    const saved = loadTabsFromStorage();
    if (saved.length > 0) return saved;
    // Create default tab
    return [{
      id: generateTabId(),
      name: 'Query 1',
      query: defaultQuery,
      result: null,
    }];
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
        const updatedQuery = typeof newQuery === 'function' ? newQuery(tab.query) : newQuery;
        return { ...tab, query: updatedQuery };
      }
      return tab;
    }));
  }, [activeTabId]);

  const setResult = React.useCallback((newResult: UnifiedQueryResult | null) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, result: newResult };
      }
      return tab;
    }));
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
      return saved ? parseInt(saved, 10) : 224;
    }
    return 224;
  });
  const [isResizing, setIsResizing] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLPreElement>(null);
  const sidebarRef = React.useRef<HTMLElement>(null);

  // Save tabs to localStorage
  React.useEffect(() => {
    saveTabsToStorage(tabs);
  }, [tabs]);

  // Tab actions
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
    if (tabs.length <= 1) return; // Keep at least one tab

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If closing active tab, switch to adjacent tab
    if (tabId === activeTabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  }, [tabs, activeTabId]);

  const renameTab = React.useCallback((tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
  }, []);

  // Load health status
  React.useEffect(() => {
    getUnifiedHealth().then(setHealth);
  }, []);

  // Load schemas (with 7-day cache)
  React.useEffect(() => {
    const cachedSchema = getSchemaFromCache();

    if (cachedSchema) {
      setSchemas(cachedSchema);
      setIsLoadingSchema(false);
    } else {
      setIsLoadingSchema(true);
      getUnifiedSchemas()
        .then((data) => {
          setSchemas(data);
          saveSchemaToCache(data);
        })
        .finally(() => setIsLoadingSchema(false));
    }
  }, []);

  // Save sidebar width to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sqlv2-sidebar-width', String(sidebarWidth));
    }
  }, [sidebarWidth]);

  // Handle sidebar resize
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, 150), 500);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleExecute = React.useCallback(async () => {
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);
    setCurrentPage(1);

    try {
      const res = await executeUnifiedQuery(query);
      setResult(res);
      if (res.status === 'error') {
        setActiveResultTab('messages');
      } else {
        setActiveResultTab('results');
      }
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

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleExecute();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = query.substring(0, start) + '  ' + query.substring(end);
        setQuery(newValue);
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    },
    [query, handleExecute]
  );

  const handleEditorScroll = React.useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
  }, []);

  const toggleSchema = (key: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const insertTableRef = (source: 'rs' | 'ss', schema: string, table: string) => {
    const ref = `${source}.${schema}.${table}`;
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newQuery = query.substring(0, start) + ref + query.substring(end);
      setQuery(newQuery);
      textareaRef.current.focus();
    }
  };

  const refreshSchemas = () => {
    clearSchemaCache();
    setIsLoadingSchema(true);
    getUnifiedSchemas()
      .then((data) => {
        setSchemas(data);
        saveSchemaToCache(data);
      })
      .finally(() => setIsLoadingSchema(false));
  };

  // Pagination
  const totalRows = result?.rows?.length || 0;
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  const paginatedRows = result?.rows?.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  ) || [];

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Consolas, monospace" }}>
      {/* Header Bar */}
      <header className="flex-shrink-0 h-10 bg-[#323233] border-b border-[#3c3c3c] flex items-center justify-between px-3">
        <div className="flex items-center gap-4">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-xs font-semibold text-white leading-none">SQL Studio</h1>
              <p className="text-[9px] text-[#808080]">Unified Query Engine</p>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-[#3c3c3c]">
            <StatusIndicator
              label="Redshift"
              connected={health?.redshift?.connected || false}
              icon={<Cloud className="w-3.5 h-3.5" />}
              color="orange"
            />
            <StatusIndicator
              label="SQL Server"
              connected={health?.sqlserver?.connected || false}
              icon={<Server className="w-3.5 h-3.5" />}
              color="cyan"
            />
          </div>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={isLoading || !query.trim()}
          className={cn(
            'flex items-center gap-1.5 px-3 h-7 rounded text-[11px] font-medium transition-all',
            'bg-[#0e639c] hover:bg-[#1177bb] text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-sm'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Run
          <kbd className="ml-1.5 px-1 py-0.5 rounded bg-[#ffffff20] text-[9px]">
            ⌘↵
          </kbd>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Schema Browser Sidebar */}
        <aside
          ref={sidebarRef}
          className="flex-shrink-0 bg-[#252526] flex flex-col relative"
          style={{ width: sidebarWidth }}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#3c3c3c]">
            <span className="text-[10px] font-semibold text-[#cccccc] uppercase tracking-wide">
              Explorer
            </span>
            <button
              onClick={refreshSchemas}
              disabled={isLoadingSchema}
              className="p-0.5 rounded hover:bg-[#3c3c3c] text-[#808080] hover:text-[#cccccc] transition-colors"
            >
              <RefreshCw className={cn('w-3 h-3', isLoadingSchema && 'animate-spin')} />
            </button>
          </div>

          {/* Redshift Section */}
          <div className="flex-1 flex flex-col min-h-0 border-b border-[#3c3c3c]">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#2d2d2d]">
              <Cloud className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] font-semibold text-orange-400">REDSHIFT</span>
              <span className="text-[9px] text-orange-400/60 ml-0.5">rs.</span>
              <div className={cn(
                'w-1.5 h-1.5 rounded-full ml-auto',
                health?.redshift?.connected ? 'bg-green-500' : 'bg-red-500'
              )} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSchema ? (
                <LoadingState color="orange" />
              ) : (
                <SchemaTree
                  source="rs"
                  color="orange"
                  schemas={schemas?.schemas?.redshift || {}}
                  expandedSchemas={expandedSchemas}
                  onToggle={toggleSchema}
                  onTableClick={insertTableRef}
                />
              )}
            </div>
            <div className="px-2 py-1 text-[9px] text-[#808080] bg-[#2d2d2d] border-t border-[#3c3c3c]">
              {schemas?.summary?.redshift.schemas || 0} schemas • {schemas?.summary?.redshift.tables || 0} tables
            </div>
          </div>

          {/* SQL Server Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#2d2d2d]">
              <Server className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-semibold text-cyan-400">SQL SERVER</span>
              <span className="text-[9px] text-cyan-400/60 ml-0.5">ss.</span>
              <div className={cn(
                'w-1.5 h-1.5 rounded-full ml-auto',
                health?.sqlserver?.connected ? 'bg-green-500' : 'bg-red-500'
              )} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSchema ? (
                <LoadingState color="cyan" />
              ) : (
                <SchemaTree
                  source="ss"
                  color="cyan"
                  schemas={schemas?.schemas?.sqlserver || {}}
                  expandedSchemas={expandedSchemas}
                  onToggle={toggleSchema}
                  onTableClick={insertTableRef}
                />
              )}
            </div>
            <div className="px-2 py-1 text-[9px] text-[#808080] bg-[#2d2d2d] border-t border-[#3c3c3c]">
              {schemas?.summary?.sqlserver.schemas || 0} schemas • {schemas?.summary?.sqlserver.tables || 0} tables
            </div>
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'absolute top-0 right-0 w-1 h-full cursor-col-resize group',
              'hover:bg-[#0e639c] transition-colors',
              isResizing && 'bg-[#0e639c]'
            )}
          >
            <div className={cn(
              'absolute top-1/2 right-0 -translate-y-1/2 w-1 h-8 rounded-full',
              'bg-[#555] group-hover:bg-[#0e639c]',
              isResizing && 'bg-[#0e639c]'
            )} />
          </div>
        </aside>

        {/* Editor + Results */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Query Tabs Bar */}
          <div className="flex-shrink-0 h-8 bg-[#252526] border-b border-[#3c3c3c] flex items-center">
            <div className="flex-1 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-8 cursor-pointer border-r border-[#3c3c3c] group',
                    'text-[10px] transition-colors min-w-0',
                    tab.id === activeTabId
                      ? 'bg-[#1e1e1e] text-white'
                      : 'bg-[#2d2d2d] text-[#808080] hover:text-[#cccccc]'
                  )}
                >
                  <span className="truncate max-w-[100px]">{tab.name}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => closeTab(tab.id, e)}
                      className={cn(
                        'p-0.5 rounded hover:bg-[#3c3c3c] opacity-0 group-hover:opacity-100 transition-opacity',
                        tab.id === activeTabId && 'opacity-50'
                      )}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTab}
              className="flex-shrink-0 p-2 hover:bg-[#3c3c3c] text-[#808080] hover:text-[#cccccc] transition-colors"
              title="New Query Tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Code Editor */}
          <div className="h-64 flex-shrink-0 border-b border-[#3c3c3c] flex bg-[#1e1e1e]">
            {/* Line Numbers */}
            <div
              ref={lineNumbersRef}
              className="w-12 flex-shrink-0 bg-[#1e1e1e] border-r border-[#3c3c3c] overflow-hidden select-none"
            >
              <div className="py-2 pr-3 text-right text-[11px] leading-[1.6] text-[#858585]">
                {query.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative overflow-hidden">
              {/* Syntax Highlight Layer */}
              <pre
                ref={highlightRef}
                className="absolute inset-0 py-2 px-3 m-0 text-[11px] leading-[1.6] pointer-events-none overflow-hidden whitespace-pre-wrap break-words bg-transparent"
                style={{ tabSize: 2 }}
                aria-hidden="true"
              >
                <code dangerouslySetInnerHTML={{ __html: highlightSQL(query) + '\n' }} />
              </pre>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleEditorScroll}
                spellCheck={false}
                className={cn(
                  'absolute inset-0 w-full h-full py-2 px-3 resize-none',
                  'bg-transparent text-transparent caret-white',
                  'text-[11px] leading-[1.6]',
                  'focus:outline-none',
                  'placeholder:text-[#6a6a6a]'
                )}
                style={{ tabSize: 2 }}
                placeholder="Enter your SQL query..."
              />
            </div>
          </div>

          {/* Results Panel */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between h-7 px-1.5 bg-[#252526] border-b border-[#3c3c3c]">
              <div className="flex items-center gap-0.5">
                <TabButton
                  active={activeResultTab === 'results'}
                  onClick={() => setActiveResultTab('results')}
                  icon={<LayoutGrid className="w-3 h-3" />}
                >
                  Results
                </TabButton>
                <TabButton
                  active={activeResultTab === 'columns'}
                  onClick={() => setActiveResultTab('columns')}
                  icon={<Columns className="w-3 h-3" />}
                >
                  Columns
                </TabButton>
                <TabButton
                  active={activeResultTab === 'messages'}
                  onClick={() => setActiveResultTab('messages')}
                  icon={<MessageSquare className="w-3 h-3" />}
                  badge={result?.error ? true : false}
                >
                  Messages
                </TabButton>
              </div>

              {/* Result Stats */}
              {result?.status === 'success' && (
                <div className="flex items-center gap-3 text-[9px] text-[#808080]">
                  <div className="flex items-center gap-1">
                    <Rows3 className="w-3 h-3" />
                    <span className="text-[#cccccc]">{result.row_count}</span> rows
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="text-[#cccccc]">{result.execution_time}</span> ms
                  </div>
                  {result.source && (
                    <div className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase',
                      result.source === 'redshift' && 'bg-orange-500/20 text-orange-400',
                      result.source === 'sqlserver' && 'bg-cyan-500/20 text-cyan-400',
                      result.source === 'cross' && 'bg-purple-500/20 text-purple-400'
                    )}>
                      {result.source}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
              {activeResultTab === 'results' && (
                <ResultsTable
                  columns={result?.columns || []}
                  rows={paginatedRows}
                  isLoading={isLoading}
                />
              )}
              {activeResultTab === 'columns' && (
                <ColumnsTable columns={result?.columns || []} />
              )}
              {activeResultTab === 'messages' && (
                <MessagesPanel
                  error={result?.error}
                  message={result?.message}
                  source={result?.source}
                />
              )}
            </div>

            {/* Pagination */}
            {activeResultTab === 'results' && totalPages > 1 && (
              <div className="flex items-center justify-between px-3 h-7 bg-[#252526] border-t border-[#3c3c3c]">
                <span className="text-[9px] text-[#808080]">
                  Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}-{Math.min(currentPage * ROWS_PER_PAGE, totalRows)} of {totalRows}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-0.5 text-[9px] rounded bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-[9px] text-[#808080]">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-0.5 text-[9px] rounded bg-[#3c3c3c] hover:bg-[#4c4c4c] text-[#cccccc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Components ============

function StatusIndicator({
  label,
  connected,
  icon,
  color,
}: {
  label: string;
  connected: boolean;
  icon: React.ReactNode;
  color: 'orange' | 'cyan';
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        'flex items-center justify-center',
        color === 'orange' ? 'text-orange-400' : 'text-cyan-400'
      )}>
        {icon}
      </div>
      <span className="text-[10px] text-[#cccccc]">{label}</span>
      <div className={cn(
        'w-1.5 h-1.5 rounded-full',
        connected ? 'bg-green-500' : 'bg-red-500'
      )} />
    </div>
  );
}

function LoadingState({ color }: { color: 'orange' | 'cyan' }) {
  return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className={cn(
        'w-4 h-4 animate-spin',
        color === 'orange' ? 'text-orange-400/50' : 'text-cyan-400/50'
      )} />
    </div>
  );
}

function SchemaTree({
  source,
  color,
  schemas,
  expandedSchemas,
  onToggle,
  onTableClick,
}: {
  source: 'rs' | 'ss';
  color: 'orange' | 'cyan';
  schemas: Record<string, string[]>;
  expandedSchemas: Set<string>;
  onToggle: (key: string) => void;
  onTableClick: (source: 'rs' | 'ss', schema: string, table: string) => void;
}) {
  const schemaEntries = Object.entries(schemas);

  if (schemaEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[#6a6a6a]">
        <Database className="w-6 h-6 mb-1.5 opacity-50" />
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
            {/* Schema Row */}
            <button
              onClick={() => onToggle(key)}
              className="w-full flex items-center gap-1 px-2 py-0.5 text-left hover:bg-[#2a2d2e] transition-colors group"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-[#808080] flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#808080] flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className={cn(
                  'w-3 h-3 flex-shrink-0',
                  color === 'orange' ? 'text-orange-400' : 'text-cyan-400'
                )} />
              ) : (
                <Folder className={cn(
                  'w-3 h-3 flex-shrink-0',
                  color === 'orange' ? 'text-orange-400/70' : 'text-cyan-400/70'
                )} />
              )}
              <span className="text-[10px] text-[#cccccc] group-hover:text-white truncate flex-1">
                {schemaName}
              </span>
              <span className={cn(
                'text-[9px] px-1 py-0.5 rounded flex-shrink-0',
                color === 'orange' ? 'bg-orange-500/10 text-orange-400/80' : 'bg-cyan-500/10 text-cyan-400/80'
              )}>
                {tables.length}
              </span>
            </button>

            {/* Tables */}
            {isExpanded && (
              <div className="ml-3 border-l border-[#3c3c3c]">
                {tables.map((table) => (
                  <button
                    key={table}
                    onClick={() => onTableClick(source, schemaName, table)}
                    className="w-full flex items-center gap-1 pl-3 pr-2 py-0.5 text-left hover:bg-[#2a2d2e] transition-colors group"
                  >
                    <Table2 className={cn(
                      'w-3 h-3 flex-shrink-0',
                      color === 'orange'
                        ? 'text-orange-400/40 group-hover:text-orange-400/70'
                        : 'text-cyan-400/40 group-hover:text-cyan-400/70'
                    )} />
                    <span className="text-[10px] text-[#9a9a9a] group-hover:text-[#cccccc] truncate">
                      {table}
                    </span>
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

function TabButton({
  active,
  onClick,
  icon,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors rounded-sm',
        active
          ? 'bg-[#1e1e1e] text-white'
          : 'text-[#808080] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
      )}
    >
      {icon}
      {children}
      {badge && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
    </button>
  );
}

function ResultsTable({
  columns,
  rows,
  isLoading,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#0e639c]" />
          <span className="text-[10px] text-[#808080]">Executing query...</span>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6a6a6a]">
        <LayoutGrid className="w-8 h-8 mb-2 opacity-30" />
        <span className="text-[10px]">Run a query to see results</span>
        <span className="text-[9px] mt-0.5">Press ⌘+Enter to execute</span>
      </div>
    );
  }

  return (
    <table className="w-full text-[10px]">
      <thead className="sticky top-0 bg-[#252526]">
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              className="px-3 py-1.5 text-left font-semibold text-[#cccccc] border-b border-[#3c3c3c] whitespace-nowrap bg-[#252526]"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-b border-[#2d2d2d] hover:bg-[#2a2d2e] transition-colors"
          >
            {columns.map((col) => (
              <td
                key={col}
                className="px-3 py-1 text-[10px] text-[#d4d4d4] whitespace-nowrap"
              >
                {formatValue(row[col])}
              </td>
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
      <div className="flex flex-col items-center justify-center h-full text-[#6a6a6a]">
        <Columns className="w-8 h-8 mb-2 opacity-30" />
        <span className="text-[10px]">Run a query to see columns</span>
      </div>
    );
  }

  return (
    <table className="w-full text-[10px]">
      <thead className="sticky top-0 bg-[#252526]">
        <tr>
          <th className="px-3 py-1.5 text-left font-semibold text-[#cccccc] border-b border-[#3c3c3c] w-16">
            #
          </th>
          <th className="px-3 py-1.5 text-left font-semibold text-[#cccccc] border-b border-[#3c3c3c]">
            Column Name
          </th>
        </tr>
      </thead>
      <tbody>
        {columns.map((col, i) => (
          <tr
            key={col}
            className="border-b border-[#2d2d2d] hover:bg-[#2a2d2e] transition-colors"
          >
            <td className="px-3 py-1 text-[#808080]">{i + 1}</td>
            <td className="px-3 py-1 text-[10px] text-[#d4d4d4]">{col}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MessagesPanel({
  error,
  message,
  source,
}: {
  error?: string;
  message?: string;
  source?: string;
}) {
  if (!error && !message) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#6a6a6a]">
        <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
        <span className="text-[10px]">No messages</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-semibold text-red-400 mb-1">Error</h4>
            <pre className="text-[10px] text-red-300 whitespace-pre-wrap break-words">
              {error}
            </pre>
          </div>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-semibold text-green-400 mb-1">Success</h4>
            <p className="text-[10px] text-green-300">{message}</p>
            {source && (
              <p className="text-[9px] text-[#808080] mt-1">Source: {source}</p>
            )}
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

/**
 * SQL Syntax Highlighter - VS Code Dark+ Theme Colors
 */
function highlightSQL(sql: string): string {
  let html = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Keywords - Blue (#569cd6)
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

  // Functions - Yellow (#dcdcaa)
  const functions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
    'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'LENGTH', 'LEN', 'SUBSTRING',
    'CONCAT', 'REPLACE', 'CHARINDEX', 'PATINDEX', 'REVERSE',
    'NOW', 'GETDATE', 'DATEADD', 'DATEDIFF', 'DATEPART', 'YEAR', 'MONTH', 'DAY',
    'HOUR', 'MINUTE', 'SECOND', 'ISNULL', 'NVL', 'IFNULL', 'ROW_NUMBER', 'RANK',
    'DENSE_RANK', 'NTILE', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'OVER',
    'PARTITION', 'LISTAGG', 'STRING_AGG', 'JSON_VALUE', 'JSON_QUERY',
  ];

  // Strings - Orange (#ce9178)
  html = html.replace(/'([^']*?)'/g, '<span style="color:#ce9178">\'$1\'</span>');

  // Comments - Green (#6a9955)
  html = html.replace(/(--.*?)$/gm, '<span style="color:#6a9955">$1</span>');
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6a9955">$1</span>');

  // Numbers - Light Green (#b5cea8)
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>');

  // Keywords - Blue
  for (const kw of keywords) {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    html = html.replace(regex, '<span style="color:#569cd6">$1</span>');
  }

  // Functions - Yellow
  for (const fn of functions) {
    const regex = new RegExp(`\\b(${fn})\\s*(?=\\()`, 'gi');
    html = html.replace(regex, '<span style="color:#dcdcaa">$1</span>');
  }

  // Table prefixes - Orange for rs, Cyan for ss
  html = html.replace(/\b(rs)\./gi, '<span style="color:#f97316;font-weight:600">$1</span>.');
  html = html.replace(/\b(ss)\./gi, '<span style="color:#22d3ee;font-weight:600">$1</span>.');

  return html;
}
