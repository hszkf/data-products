import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Database,
  LayoutDashboard,
  Bot,
  ScrollText,
  Calendar,
  HardDrive,
  Terminal,
  ChevronRight,
  Sparkles,
  BarChart3,
  Cpu,
  Shield,
  Clock,
  Users,
  Layers,
  Play,
  Code2,
  Braces,
  ArrowRight,
  Zap,
  GitBranch,
  Server,
  Lock,
} from "lucide-react";

export const Route = createFileRoute('/')({
  component: LandingPage,
});

// Typing animation hook
function useTypingEffect(text: string, speed: number = 50, startDelay: number = 0) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText("");
    setIsComplete(false);

    const startTimeout = setTimeout(() => {
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(timer);
        }
      }, speed);

      return () => clearInterval(timer);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay]);

  return { displayText, isComplete };
}

// Code block with syntax highlighting
function CodeBlock({
  code,
  language = "sql",
  animate = false,
  delay = 0,
  showLineNumbers = true
}: {
  code: string;
  language?: string;
  animate?: boolean;
  delay?: number;
  showLineNumbers?: boolean;
}) {
  const { displayText, isComplete } = useTypingEffect(
    animate ? code : "",
    25,
    delay
  );

  const displayCode = animate ? displayText : code;
  const lines = displayCode.split('\n');

  // Enhanced syntax highlighting
  const highlightSQL = (text: string) => {
    let result = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Comments - muted
    result = result.replace(/(--.*$)/gm, '<span class="text-neutral-600 italic">$1</span>');

    // Strings - warm amber
    result = result.replace(/('.*?')/g, '<span class="text-amber-400">$1</span>');

    // Keywords - bright cyan
    const keywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP|BY|ORDER|HAVING|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|DISTINCT|LIMIT|OFFSET|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|INDEX|TABLE|INTO|VALUES|SET|UNION|ALL|TOP|WITH|OVER|PARTITION|ASC|DESC)\b/gi;
    result = result.replace(keywords, '<span class="text-cyan-400 font-medium">$1</span>');

    // Functions - pink/magenta
    const functions = /\b(COUNT|SUM|AVG|MAX|MIN|ROW_NUMBER|RANK|DENSE_RANK|DATE_TRUNC|DATEADD|DATEDIFF|CURRENT_DATE|CURRENT_TIMESTAMP|COALESCE|NULLIF|CAST|CONVERT|CONCAT|SUBSTRING|TRIM|UPPER|LOWER|LENGTH|ROUND|FLOOR|CEIL|ABS)\b/gi;
    result = result.replace(functions, '<span class="text-pink-400">$1</span>');

    // Numbers - violet
    result = result.replace(/\b(\d+)\b(?![^<]*>)/g, '<span class="text-violet-400">$1</span>');

    // Identifiers after AS - green
    result = result.replace(/\bAS\b\s+(<span[^>]*>)?(\w+)/gi, 'AS $1<span class="text-emerald-400">$2</span>');

    return result;
  };

  return (
    <div className="relative group">
      {/* Animated border gradient */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/50 via-violet-500/50 to-pink-500/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative bg-[#0a0a0c] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/30" />
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30" />
              <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/30" />
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-500" />
              <span className="text-[11px] text-cyan-500/80 font-mono font-medium uppercase tracking-widest">{language}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-600 font-mono">query.sql</span>
          </div>
        </div>

        {/* Code content with line numbers */}
        <div className="relative overflow-x-auto">
          <div className="p-4 font-mono text-[13px] leading-[1.8]">
            {showLineNumbers ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="text-right pr-4 select-none text-neutral-700 w-8 align-top text-[11px]">
                        {i + 1}
                      </td>
                      <td className="pl-4 border-l border-neutral-800/50">
                        <code
                          dangerouslySetInnerHTML={{ __html: highlightSQL(line) || '&nbsp;' }}
                          className="text-neutral-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre>
                <code
                  dangerouslySetInnerHTML={{ __html: highlightSQL(displayCode) }}
                  className="text-neutral-300"
                />
              </pre>
            )}
            {animate && !isComplete && (
              <span className="inline-block w-2 h-5 bg-cyan-400 ml-1 animate-pulse shadow-lg shadow-cyan-400/50" />
            )}
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-t border-neutral-800/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500/80 font-mono uppercase tracking-wider">Ready</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-neutral-600 font-mono">
            <span>{lines.length} lines</span>
            <span>•</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Terminal output component
function TerminalOutput({ lines, delay = 0 }: { lines: string[]; delay?: number }) {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    setVisibleLines(0);
    const startTimeout = setTimeout(() => {
      const timer = setInterval(() => {
        setVisibleLines(prev => {
          if (prev < lines.length) return prev + 1;
          clearInterval(timer);
          return prev;
        });
      }, 200);
      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [lines.length, delay]);

  const getLineIcon = (line: string) => {
    if (line.includes('✓') || line.includes('completed') || line.includes('returned')) {
      return <span className="text-emerald-400">✓</span>;
    }
    if (line.includes('Connecting') || line.includes('Connected')) {
      return <span className="text-cyan-400">◆</span>;
    }
    if (line.includes('Processing') || line.includes('Executing') || line.includes('Fetching') || line.includes('Aggregating') || line.includes('Joining') || line.includes('Querying')) {
      return <span className="text-amber-400 animate-pulse">●</span>;
    }
    return <span className="text-neutral-600">›</span>;
  };

  const getLineColor = (line: string) => {
    if (line.includes('✓') || line.includes('completed') || line.includes('returned')) {
      return 'text-emerald-400';
    }
    if (line.includes('Connecting') || line.includes('Connected')) {
      return 'text-cyan-400';
    }
    return 'text-neutral-400';
  };

  return (
    <div className="relative group h-full">
      {/* Glow effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/30 via-cyan-500/30 to-emerald-500/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />

      <div className="relative h-full bg-[#0a0a0c] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/30" />
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/30" />
              <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/30" />
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[11px] text-emerald-500/80 font-mono font-medium uppercase tracking-widest">Terminal</span>
            </div>
          </div>
          <span className="text-[10px] text-neutral-600 font-mono">output</span>
        </div>

        {/* Output content */}
        <div className="flex-1 p-4 font-mono text-[13px]">
          <div className="space-y-2">
            {lines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="mt-0.5 w-4 text-center">{getLineIcon(line)}</span>
                <span className={`${getLineColor(line)} leading-relaxed`}>{line}</span>
              </div>
            ))}
            {visibleLines < lines.length && (
              <div className="flex items-center gap-3">
                <span className="w-4" />
                <span className="inline-block w-2 h-5 bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-t border-neutral-800/50">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${visibleLines === lines.length ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${visibleLines === lines.length ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
              {visibleLines === lines.length ? 'Complete' : 'Running'}
            </span>
          </div>
          <span className="text-[10px] text-neutral-600 font-mono">
            {visibleLines}/{lines.length} tasks
          </span>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [activeDemo, setActiveDemo] = useState(0);

  // Mouse tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal-on-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "-50px" }
    );

    reveals.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Demo code examples
  const demoExamples = [
    {
      title: "Customer Analytics",
      code: `SELECT
    c.customer_name,
    COUNT(o.order_id) AS total_orders,
    SUM(o.amount) AS lifetime_value,
    AVG(o.amount) AS avg_order_value
FROM customers c
LEFT JOIN orders o
    ON c.id = o.customer_id
WHERE o.created_at >= '2024-01-01'
GROUP BY c.customer_name
ORDER BY lifetime_value DESC
LIMIT 10;`,
      output: ["Fetching data from Redshift...", "Processing 1.2M rows...", "Query completed in 0.847s", "10 rows returned"]
    },
    {
      title: "Revenue Trends",
      code: `SELECT
    DATE_TRUNC('month', order_date) AS month,
    product_category,
    SUM(revenue) AS total_revenue,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM sales_data
WHERE order_date >= DATEADD(month, -12, CURRENT_DATE)
GROUP BY month, product_category
ORDER BY month DESC, total_revenue DESC;`,
      output: ["Connecting to SQL Server...", "Aggregating monthly data...", "Query completed in 1.203s", "144 rows returned"]
    },
    {
      title: "User Engagement",
      code: `SELECT
    u.user_segment,
    COUNT(*) AS user_count,
    AVG(session_duration) AS avg_session,
    SUM(page_views) AS total_views
FROM users u
INNER JOIN sessions s
    ON u.id = s.user_id
WHERE s.session_date = CURRENT_DATE - 1
GROUP BY u.user_segment
HAVING COUNT(*) > 100;`,
      output: ["Querying user database...", "Joining session data...", "Query completed in 0.562s", "8 rows returned"]
    }
  ];

  return (
    <div className="bg-[#08080a] text-neutral-100 min-h-screen overflow-x-hidden selection:bg-cyan-500/30">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Scan lines effect */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.015]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.03) 2px, rgba(0,255,255,0.03) 4px)",
        }}
      />

      {/* Mouse spotlight */}
      <div
        className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(6,182,212,0.04), transparent 40%)`,
        }}
      />

      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            top: "-10%",
            right: "-10%",
            transform: `translateY(${scrollY * 0.05}px)`,
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
            bottom: "20%",
            left: "-10%",
            transform: `translateY(${scrollY * -0.03}px)`,
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[80px] opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(251,191,36,0.1) 0%, transparent 70%)",
            top: "50%",
            left: "40%",
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#08080a]/80 backdrop-blur-2xl border-b border-cyan-500/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-cyan-500/20">
                  <Terminal className="w-5 h-5 text-black" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-lg font-bold tracking-tight text-cyan-400">
                  Damya
                </span>
                <span className="font-mono text-[10px] text-neutral-600 tracking-widest uppercase">
                  Analytics Platform
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#demo">Live Demo</NavLink>
              <NavLink href="#team">Team</NavLink>
              <Link
                href="/sql"
                className="group relative px-6 py-2.5 bg-cyan-500 text-black font-mono font-bold text-sm rounded-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Launch
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
                <span className="font-mono text-xs text-cyan-400 tracking-wider uppercase">
                  Data Science Team
                </span>
              </div>

              {/* Headline */}
              <div>
                <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight">
                  <span className="block text-neutral-100">Query.</span>
                  <span className="block text-neutral-100">Analyse.</span>
                  <span className="block bg-gradient-to-r from-cyan-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                    Discover.
                  </span>
                </h1>
              </div>

              {/* Description */}
              <p className="text-lg text-neutral-400 max-w-lg leading-relaxed">
                A unified data platform for the modern analyst. Execute SQL across multiple databases,
                automate workflows, and leverage AI — all in one secure environment.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 pt-4">
                <Link
                  href="/sql"
                  className="group relative px-8 py-4 bg-cyan-500 text-black font-bold rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_50px_rgba(6,182,212,0.3)]"
                >
                  <span className="relative z-10 flex items-center gap-2 font-mono">
                    <Play className="w-5 h-5" />
                    Open Platform
                  </span>
                </Link>
                <a
                  href="#demo"
                  className="px-8 py-4 border border-neutral-700 text-neutral-300 font-mono font-medium rounded-xl hover:border-cyan-500/50 hover:text-cyan-400 transition-all duration-300"
                >
                  View Demo
                </a>
              </div>

              {/* Stats */}
              <div className="flex gap-12 pt-8 border-t border-neutral-800/50">
                <div>
                  <div className="font-mono text-3xl font-bold text-cyan-400">10K+</div>
                  <div className="font-mono text-xs text-neutral-500 uppercase tracking-wider">Daily Queries</div>
                </div>
                <div>
                  <div className="font-mono text-3xl font-bold text-violet-400">50+</div>
                  <div className="font-mono text-xs text-neutral-500 uppercase tracking-wider">Data Sources</div>
                </div>
                <div>
                  <div className="font-mono text-3xl font-bold text-amber-400">24/7</div>
                  <div className="font-mono text-xs text-neutral-500 uppercase tracking-wider">Available</div>
                </div>
              </div>
            </div>

            {/* Right - Code Demo */}
            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />

              <div className="relative space-y-4">
                <CodeBlock
                  code={`SELECT
    customer_name,
    SUM(order_total) AS revenue,
    COUNT(*) AS orders
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE order_date >= '2024-01-01'
GROUP BY customer_name
ORDER BY revenue DESC
LIMIT 5;`}
                  language="sql"
                  animate={true}
                  delay={500}
                />
                <TerminalOutput
                  lines={[
                    "Connected to Redshift cluster...",
                    "Executing query...",
                    "✓ 5 rows returned in 0.234s"
                  ]}
                  delay={3500}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-20 reveal-on-scroll">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/20 rounded-full mb-6">
              <Braces className="w-4 h-4 text-violet-400" />
              <span className="font-mono text-xs text-violet-400 tracking-wider uppercase">
                Platform Features
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-6">
              <span className="text-neutral-100">Everything You Need</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                In One Place
              </span>
            </h2>
          </div>

          {/* Products Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProductCard
              icon={<Database className="w-6 h-6" />}
              title="SQL Studio"
              description="Professional SQL editor with multi-database support, intelligent auto-completion, and query history."
              href="/sql"
              accent="cyan"
            />
            <ProductCard
              icon={<Bot className="w-6 h-6" />}
              title="AI Assistant"
              description="Natural language to SQL conversion, query optimisation, and intelligent data analysis."
              href="/ai"
              accent="violet"
            />
            <ProductCard
              icon={<LayoutDashboard className="w-6 h-6" />}
              title="Dashboard"
              description="Drag-and-drop analytics with 9+ chart types and real-time data aggregation."
              href="/dashboard"
              accent="amber"
            />
            <ProductCard
              icon={<Calendar className="w-6 h-6" />}
              title="Job Scheduler"
              description="Automate workflows with cron scheduling and multi-database query chains."
              href="/jobs"
              accent="emerald"
            />
            <ProductCard
              icon={<ScrollText className="w-6 h-6" />}
              title="Activity Logs"
              description="Comprehensive audit trail for all queries, jobs, and user actions."
              href="/logs"
              accent="rose"
            />
            <ProductCard
              icon={<HardDrive className="w-6 h-6" />}
              title="S3 Storage"
              description="Browse S3 buckets, view job outputs, and manage stored data assets."
              href="/storage"
              accent="orange"
            />
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section id="demo" className="relative py-32 border-y border-neutral-800/50">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-violet-500/5" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className="text-center mb-16 reveal-on-scroll">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-6">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs text-cyan-400 tracking-wider uppercase">
                Interactive Demo
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              <span className="text-neutral-100">See It In</span>{" "}
              <span className="text-cyan-400">Action</span>
            </h2>
            <p className="text-neutral-500 max-w-xl mx-auto">
              Real SQL queries executing against production-like databases
            </p>
          </div>

          {/* Demo Tabs */}
          <div className="flex justify-center gap-3 mb-10">
            {demoExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => setActiveDemo(index)}
                className={`px-5 py-2.5 rounded-lg font-mono text-sm transition-all duration-300 ${
                  activeDemo === index
                    ? "bg-cyan-500 text-black font-bold"
                    : "bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                }`}
              >
                {example.title}
              </button>
            ))}
          </div>

          {/* Demo Content */}
          <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <CodeBlock
              code={demoExamples[activeDemo].code}
              language="sql"
            />
            <TerminalOutput
              lines={demoExamples[activeDemo].output}
              delay={0}
              key={activeDemo}
            />
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link
              href="/sql"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-mono font-bold rounded-xl hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all duration-300"
            >
              <Terminal className="w-5 h-5" />
              Try It Yourself
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <CapabilityCard
              icon={<Server className="w-5 h-5" />}
              title="Multi-Database"
              description="Redshift, SQL Server, PostgreSQL, and more"
              accent="cyan"
            />
            <CapabilityCard
              icon={<GitBranch className="w-5 h-5" />}
              title="Workflows"
              description="Chain queries across multiple databases"
              accent="violet"
            />
            <CapabilityCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Analytics"
              description="Real-time dashboards and visualisations"
              accent="amber"
            />
            <CapabilityCard
              icon={<Lock className="w-5 h-5" />}
              title="Secure"
              description="Enterprise-grade security and audit logs"
              accent="emerald"
            />
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="relative py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-20 reveal-on-scroll">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-6">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs text-emerald-400 tracking-wider uppercase">
                The Team
              </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="text-neutral-100">Built By</span>{" "}
              <span className="text-emerald-400">Experts</span>
            </h2>
          </div>

          {/* Data Engineering */}
          <div className="mb-16 reveal-on-scroll">
            <div className="flex items-center gap-6 mb-8">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
              <h3 className="font-mono text-sm text-cyan-400 tracking-widest uppercase">
                Data Engineering
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TeamCard name="Hasif" role="Data Engineer" accent="cyan" />
              <TeamCard name="Nazierul" role="Data Engineer" accent="emerald" />
              <TeamCard name="Izhar" role="Data Scientist" accent="violet" />
              <TeamCard name="Asyraff" role="Data Scientist" accent="rose" />
            </div>
          </div>

          {/* Business Intelligence */}
          <div className="reveal-on-scroll">
            <div className="flex items-center gap-6 mb-8">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              <h3 className="font-mono text-sm text-amber-400 tracking-widest uppercase">
                Business Intelligence
              </h3>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <TeamCard name="Bob" role="Head of BI" accent="amber" />
              <TeamCard name="Yee Ming" role="BI Analyst" accent="cyan" />
              <TeamCard name="Ernie" role="BI Analyst" accent="violet" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="relative reveal-on-scroll">
            {/* Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-cyan-500/20 rounded-3xl blur-3xl opacity-50" />

            {/* Card */}
            <div className="relative bg-[#0c0c0f] border border-neutral-800 rounded-2xl p-12 lg:p-16 text-center overflow-hidden">
              {/* Corner lines */}
              <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-cyan-500/30" />
              <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-cyan-500/30" />

              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-cyan-500/30">
                <Zap className="w-8 h-8 text-black" />
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="text-neutral-100">Ready to</span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  Get Started?
                </span>
              </h2>
              <p className="text-neutral-400 max-w-md mx-auto mb-10">
                Access the full suite of data tools built by your Data Science team
              </p>
              <Link
                href="/sql"
                className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-mono font-bold rounded-xl hover:shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                Launch Platform
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-neutral-800/50 py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center">
                <Terminal className="w-5 h-5 text-black" />
              </div>
              <span className="font-mono text-lg font-bold text-cyan-400">
                Damya
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8">
              <Link to="/sql" className="font-mono text-sm text-neutral-500 hover:text-cyan-400 transition-colors">
                SQL Studio
              </Link>
              <Link to="/ai" className="font-mono text-sm text-neutral-500 hover:text-cyan-400 transition-colors">
                AI Assistant
              </Link>
              <Link to="/dashboard" className="font-mono text-sm text-neutral-500 hover:text-cyan-400 transition-colors">
                Dashboard
              </Link>
            </div>

            {/* Copyright */}
            <div className="flex items-center gap-2 font-mono text-xs text-neutral-600">
              <Clock className="w-3 h-3" />
              <span>© 2025 Data Science Team</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Navigation Link
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-mono text-sm text-neutral-500 hover:text-cyan-400 transition-colors tracking-wide"
    >
      {children}
    </a>
  );
}

// Product Card
function ProductCard({
  icon,
  title,
  description,
  href,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  accent: "cyan" | "violet" | "amber" | "emerald" | "rose" | "orange";
}) {
  const accentColors = {
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", hover: "hover:border-cyan-500/40" },
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", hover: "hover:border-violet-500/40" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", hover: "hover:border-amber-500/40" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", hover: "hover:border-emerald-500/40" },
    rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", hover: "hover:border-rose-500/40" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", hover: "hover:border-orange-500/40" },
  };

  const colors = accentColors[accent];

  return (
    <Link to={href} className="block reveal-on-scroll">
      <div className={`group h-full bg-[#0c0c0f] border border-neutral-800/80 rounded-xl p-6 transition-all duration-500 ${colors.hover} hover:-translate-y-1`}>
        <div className={`w-12 h-12 ${colors.bg} border ${colors.border} rounded-xl flex items-center justify-center ${colors.text} mb-5 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h3 className="font-bold text-lg text-neutral-100 mb-2">{title}</h3>
        <p className="text-sm text-neutral-500 leading-relaxed mb-4">{description}</p>
        <div className={`flex items-center gap-2 ${colors.text} text-sm font-medium`}>
          <span>Open</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

// Capability Card
function CapabilityCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "cyan" | "violet" | "amber" | "emerald";
}) {
  const accentColors = {
    cyan: "text-cyan-400 border-cyan-500/20",
    violet: "text-violet-400 border-violet-500/20",
    amber: "text-amber-400 border-amber-500/20",
    emerald: "text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="text-center p-6 rounded-xl bg-neutral-900/50 border border-neutral-800/50 reveal-on-scroll">
      <div className={`w-10 h-10 mx-auto mb-4 rounded-lg border ${accentColors[accent]} flex items-center justify-center`}>
        <span className={accentColors[accent].split(" ")[0]}>{icon}</span>
      </div>
      <h4 className="font-bold text-neutral-100 mb-1">{title}</h4>
      <p className="text-xs text-neutral-500">{description}</p>
    </div>
  );
}

// Team Card
function TeamCard({
  name,
  role,
  accent,
}: {
  name: string;
  role: string;
  accent: "cyan" | "emerald" | "violet" | "rose" | "amber";
}) {
  const accentColors = {
    cyan: "from-cyan-500 to-cyan-600",
    emerald: "from-emerald-500 to-emerald-600",
    violet: "from-violet-500 to-violet-600",
    rose: "from-rose-500 to-rose-600",
    amber: "from-amber-500 to-amber-600",
  };

  return (
    <div className="group bg-[#0c0c0f] border border-neutral-800/80 rounded-xl p-5 text-center hover:border-neutral-700 transition-all duration-300">
      <div className={`w-14 h-14 mx-auto bg-gradient-to-br ${accentColors[accent]} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
        <span className="text-2xl font-bold text-black">{name[0]}</span>
      </div>
      <h4 className="font-bold text-neutral-100 mb-0.5">{name}</h4>
      <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider">{role}</p>
    </div>
  );
}
