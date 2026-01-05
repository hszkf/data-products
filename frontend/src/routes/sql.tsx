import { createFileRoute } from '@tanstack/react-router';
import { TooltipProvider } from "~/components/ui/tooltip";
import { AppHeader } from "~/components/app-header";
import { EditorPanel } from "~/components/editor";
import { MergeProvider } from "~/components/merge";
import { SimpleMergeEditor } from "~/components/merge/simple-merge-editor";

export const Route = createFileRoute('/sql')({
  component: SQLPage,
});

const defaultRedshiftQuery = `
SELECT
    *
FROM
    redshift_customers.public_customers
LIMIT 20`;

const defaultSqlServerQuery = `SELECT * FROM [Staging].[dbo].[Def_CCRIS_Entity_Type_Code]`;

function SQLPage() {
  return (
    <TooltipProvider delayDuration={300}>
      <MergeProvider>
        <div className="flex flex-col h-screen bg-surface overflow-hidden">
          {/* Background gradients */}
          <div
            className="fixed inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 20% 0%, rgba(255, 153, 0, 0.08), transparent),
                radial-gradient(ellipse 80% 50% at 80% 0%, rgba(0, 120, 212, 0.08), transparent)
              `,
            }}
          />

          {/* Main Content - Scrollable */}
          <main className="flex-1 overflow-auto relative">
            <AppHeader />

            {/* Database Editors - Side by Side */}
            <div className="flex flex-col lg:flex-row bg-outline-variant">
              <div className="flex-1 min-h-[650px] lg:min-h-[800px] border-b lg:border-b-0 lg:border-r border-outline-variant">
                <EditorPanel type="redshift" defaultQuery={defaultRedshiftQuery} />
              </div>
              <div className="flex-1 min-h-[650px] lg:min-h-[800px]">
                <EditorPanel type="sqlserver" defaultQuery={defaultSqlServerQuery} />
              </div>
            </div>

            {/* Merge Editor - Full Width Below */}
            <div className="border-t-2 border-outline-variant">
              <SimpleMergeEditor />
            </div>
          </main>
        </div>
      </MergeProvider>
    </TooltipProvider>
  );
}
