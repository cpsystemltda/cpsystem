export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-24 rounded bg-slate-200" />

      {/* Título */}
      <div className="mt-6 h-8 w-64 rounded-lg bg-slate-200" />
      <div className="mt-2 h-4 w-96 rounded bg-slate-100" />

      {/* Cards de stats */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Bloco de conteúdo principal */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        {/* Tabs skeleton */}
        <div className="flex gap-1 border-b border-slate-100 pb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 rounded-md bg-slate-100" />
          ))}
        </div>
        {/* Rows skeleton */}
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
              <div className="h-6 w-20 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
