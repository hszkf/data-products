/**
 * Root Index Route - Landing Page
 * Main entry point for the Damya Data Analytics Platform
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Terminal, Database, Calendar, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            top: "-10%",
            right: "-10%",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-15"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)",
            bottom: "20%",
            left: "-10%",
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/20">
              <Terminal className="h-12 w-12 text-black" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-100 mb-3">
            <span className="font-mono text-cyan-400">Damya</span>
          </h1>
          <p className="text-neutral-500 font-mono text-sm uppercase tracking-widest">
            Data Analytics Platform
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full mb-12">
          <Link to="/sql" className="group">
            <div className="p-6 rounded-xl bg-[#0c0c0f] border border-neutral-800 hover:border-cyan-500/50 transition-all duration-300">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-lg bg-cyan-500/10">
                  <Database className="h-6 w-6 text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  SQL Studio
                </h2>
              </div>
              <p className="text-neutral-500 text-sm mb-4">
                Query your data with a powerful SQL editor. Explore tables, run
                queries, and export results.
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-medium group-hover:gap-2 transition-all">
                Open SQL Studio
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          <Link to="/jobs" className="group">
            <div className="p-6 rounded-xl bg-[#0c0c0f] border border-neutral-800 hover:border-violet-500/50 transition-all duration-300">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-lg bg-violet-500/10">
                  <Calendar className="h-6 w-6 text-violet-400" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  Job Scheduler
                </h2>
              </div>
              <p className="text-neutral-500 text-sm mb-4">
                Create and manage scheduled jobs. Run workflows, monitor
                executions, and automate tasks.
              </p>
              <div className="flex items-center text-violet-400 text-sm font-medium group-hover:gap-2 transition-all">
                Manage Jobs
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-neutral-600 text-sm font-mono">
          Damya Data Products Platform
        </p>
      </footer>
    </div>
  );
}
