import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  FileQuestion,
  GraduationCap,
  ListFilter,
  Mail,
  Plus,
  Search,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { db as supabase } from "@/lib/backend";
import { useAuth } from "@/hooks/use-auth";
import { useBatch } from "@/hooks/use-batch";
import { useMe } from "@/hooks/use-me";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoardHeader } from "@/components/board/BoardHeader";
import { Landing } from "@/components/landing/Landing";
import { DeadlineRow } from "@/components/board/DeadlineRow";
import { ExamMarks } from "@/components/board/ExamMarks";
import { DeadlineDialog } from "@/components/board/DeadlineDialog";
import { EventDrawer } from "@/components/board/EventDrawer";
import { ApprovalsPanel } from "@/components/board/ApprovalsPanel";
import { AnnouncementsPanel } from "@/components/board/AnnouncementsPanel";
import { DayPulsePanel } from "@/components/board/DayPulsePanel";
import { ActivityPanel } from "@/components/board/ActivityPanel";
import { CalendarPanel } from "@/components/calendar/CalendarPanel";
import { TimetablePanel } from "@/components/timetable/TimetablePanel";
import { AttendancePanel } from "@/components/attendance/AttendancePanel";
import { EmailInboxPanel } from "@/components/board/EmailInboxPanel";
import { MembersPanel } from "@/components/board/MembersPanel";
import { FeedbackPanel } from "@/components/board/FeedbackPanel";
import { coursesQuery, sessionsQuery } from "@/lib/batches";
import {
  FILTERS,
  deadlinesQueryFor,
  eventMeta,
  filterByKey,
  phaseOf,
  type Deadline,
  type DeadlineType,
  type FilterKey,
} from "@/lib/deadlines";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zenith — Deadlines, Timetable & Attendance for TAPMI Manipal" },
      {
        name: "description",
        content:
          "Zenith is the student board for TAPMI Manipal: quizzes, assignments and exams sorted by time left, a live timetable, and your attendance percentage in one place.",
      },
      { property: "og:title", content: "Zenith — the TAPMI Manipal student board" },
      {
        property: "og:description",
        content:
          "Every deadline, class and attendance mark for your batch, kept accurate by your class reps.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tapmi-zenith.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://tapmi-zenith.lovable.app/" }],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ground font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
        Loading…
      </div>
    );
  }

  if (!user) return <Landing />;
  return <Board />;
}

type TabKey = "feed" | "calendar" | "timetable" | "quizzes" | "exams" | "projects" | "attendance";

const QUIZ_TYPES = ["quiz"] as const;
const EXAM_TYPES = ["midterm", "endterm"] as const;
const WORK_TYPES = ["assignment", "presentation"] as const;

/** Secondary sections — opened as overlays from the account menu, not tabs. */
type PanelKey = "members" | "feedback" | "approvals" | "inbox";

const PANEL_TITLES: Record<PanelKey, string> = {
  members: "Batch members",
  feedback: "Feedback",
  approvals: "Pending approvals",
  inbox: "Email inbox",
};


function Board() {
  const { isModerator } = useAuth();
  const me = useMe();
  const { batchId, batch, canManage } = useBatch();
  const isMod = canManage || isModerator;
  const queryClient = useQueryClient();
  const { data: deadlines = [], isLoading } = useQuery(deadlinesQueryFor(batchId));
  const { data: sessions = [] } = useQuery(sessionsQuery(batchId));
  const { data: courses = [] } = useQuery(coursesQuery(batchId));


  const [tab, setTab] = useState<TabKey>("feed");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | null>(null);
  const [selected, setSelected] = useState<Deadline | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [panel, setPanel] = useState<PanelKey | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time sync with the deadlines table for the selected batch
  useEffect(() => {
    if (!batchId) return;
    const channel = supabase
      .channel(`deadlines-realtime-${batchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deadlines", filter: `batch_id=eq.${batchId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["deadlines", batchId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, batchId]);

  useEffect(() => {
    if (!isMod && (panel === "approvals" || panel === "inbox")) setPanel(null);
  }, [isMod, panel]);

  const remove = useMutation({
    mutationFn: async (deadline: Deadline) => {
      const { error } = await supabase.from("deadlines").delete().eq("id", deadline.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines", batchId] });
      setSelected(null);
      toast.success("Deadline removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approved = useMemo(
    () => deadlines.filter((d) => (d.status ?? "approved") === "approved"),
    [deadlines],
  );
  const pendingCount = useMemo(
    () => deadlines.filter((d) => d.status === "pending").length,
    [deadlines],
  );

  const dueSoonCount = useMemo(
    () =>
      approved.filter((d) => {
        const t = new Date(d.due_at).getTime();
        return t >= now && t - now <= 48 * 3600_000;
      }).length,
    [approved, now],
  );

  const filtered = useMemo(
    () => filterByKey(approved, filter, search),
    [approved, filter, search],
  );

  /** Quizzes, exams and coursework each get their own tab and feed section. */
  const quizzes = useMemo(
    () => approved.filter((d) => (QUIZ_TYPES as readonly string[]).includes(d.type)),
    [approved],
  );
  const exams = useMemo(
    () => approved.filter((d) => (EXAM_TYPES as readonly string[]).includes(d.type)),
    [approved],
  );
  const projects = useMemo(
    () => approved.filter((d) => (WORK_TYPES as readonly string[]).includes(d.type)),
    [approved],
  );
  const upcomingOf = (list: Deadline[]) => list.filter((d) => phaseOf(d, now) !== "completed");
  const nextQuizzes = useMemo(() => upcomingOf(quizzes), [quizzes, now]);
  const nextExams = useMemo(() => upcomingOf(exams), [exams, now]);
  const nextProjects = useMemo(() => upcomingOf(projects), [projects, now]);

  function openEdit(d: Deadline) {
    setSelected(null);
    setEditing(d);
    setDialogOpen(true);
  }

  type TabDef = { key: TabKey; label: string; icon: React.ReactNode };

  const tabs: TabDef[] = [
    { key: "feed", label: "Feed", icon: <ListFilter className="size-4" /> },
    { key: "calendar", label: "Calendar", icon: <CalendarRange className="size-4" /> },
    { key: "timetable", label: "Timetable", icon: <CalendarClock className="size-4" /> },
    { key: "attendance", label: "Attendance", icon: <UserCheck className="size-4" /> },
    { key: "quizzes", label: "Quizzes", icon: <FileQuestion className="size-4" /> },
    { key: "exams", label: "Exams", icon: <GraduationCap className="size-4" /> },
    { key: "projects", label: "Projects", icon: <BookOpen className="size-4" /> },
  ];


  const menuItems = [
    { key: "members", label: "Members", icon: <Users className="size-4" /> },
    { key: "feedback", label: "Feedback", icon: <MessageSquare className="size-4" /> },
    ...(isMod
      ? [
          {
            key: "approvals",
            label: "Approvals",
            icon: <ShieldCheck className="size-4" />,
            badge: pendingCount || undefined,
          },
          { key: "inbox", label: "Inbox", icon: <Mail className="size-4" /> },
        ]
      : []),
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ground font-body text-ink">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-24 -top-32 h-[420px] w-[560px] rounded-full bg-cyan/12 blur-[130px]" />
        <div className="absolute right-[-80px] top-[180px] h-[380px] w-[500px] rounded-full bg-amber/12 blur-[140px]" />
      </div>

      <BoardHeader menuItems={menuItems} onMenuSelect={(k) => setPanel(k as PanelKey)} />

      <main className="relative z-10 mx-auto max-w-[1180px] px-5 pb-24 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-4 pb-4 pt-0"
        >
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-dim">
              {batch?.name ?? "TAPMI Manipal"}
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
              {me.name ? `${me.greeting} — here's what's ahead` : "Your board"}
            </h1>
            {me.name && (
              <p className="font-mono text-xs text-dim">
                {dueSoonCount > 0
                  ? `${dueSoonCount} deadline${dueSoonCount === 1 ? "" : "s"} on ${me.name}'s plate in the next 48 hours.`
                  : "Nothing burning in the next 48 hours — nice work."}
              </p>
            )}
          </div>

        </motion.div>

        <div className="mb-4 flex items-center gap-2">
          <nav
            aria-label="Board sections"
            className="flex flex-1 items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((t) => (
              <motion.button
                key={t.key}
                onClick={() => setTab(t.key)}
                whileTap={{ scale: 0.96 }}
                aria-current={tab === t.key ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors ${
                  tab === t.key ? "text-white" : "text-dim hover:text-ink"
                }`}
              >
                {tab === t.key && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-xl bg-cyan"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {t.icon}
                  <span className="whitespace-nowrap">{t.label}</span>
                </span>
              </motion.button>
            ))}
          </nav>

          {isMod && (
            <motion.button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan px-3.5 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_-10px_var(--cyan)]"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add event</span>
            </motion.button>
          )}
        </div>

        {tab === "calendar" && (
          <div className="sticky top-16 z-20 -mx-5 mb-5 border-b border-border/60 bg-ground/80 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Segmented type filter */}
              <div className="flex shrink-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                      filter === f.key ? "text-cyan" : "text-dim hover:text-ink"
                    }`}
                  >
                    {filter === f.key && (
                      <motion.span
                        layoutId="filter-pill"
                        className="absolute inset-0 rounded-lg bg-cyan/15 ring-1 ring-cyan/30"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative whitespace-nowrap">{f.label}</span>
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:ml-auto sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search course or code…"
                  aria-label="Search deadlines"
                  className="w-full rounded-xl bg-surface2/70 py-2 pl-9 pr-3.5 text-sm text-ink ring-1 ring-border outline-none transition-all placeholder:text-faint focus:ring-2 focus:ring-cyan/40 sm:w-56 sm:focus:w-72"
                />
              </div>
            </div>
          </div>
        )}


        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "feed" && (
              <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0">
                  <div className="mb-8">
                    <DayPulsePanel now={now} compact />
                  </div>

                  {isLoading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface2/40" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <FeedSection
                        title="Quizzes"
                        tone="text-evt-quiz"
                        count={nextQuizzes.length}
                        onSeeAll={() => setTab("quizzes")}
                      >
                        <FeedList
                          items={nextQuizzes.slice(0, 6)}
                          empty="No quizzes scheduled."
                          now={now}
                          isMod={isMod}
                          onEdit={openEdit}
                          onDelete={(x) => remove.mutate(x)}
                          onOpen={setSelected}
                        />
                      </FeedSection>

                      <FeedSection
                        title="Exams"
                        tone="text-evt-exam"
                        count={nextExams.length}
                        onSeeAll={() => setTab("exams")}
                      >
                        <FeedList
                          items={nextExams.slice(0, 6)}
                          empty="No exams scheduled."
                          now={now}
                          isMod={isMod}
                          onEdit={openEdit}
                          onDelete={(x) => remove.mutate(x)}
                          onOpen={setSelected}
                        />
                      </FeedSection>

                      <FeedSection
                        title="Projects & assignments"
                        tone="text-evt-assign"
                        count={nextProjects.length}
                        onSeeAll={() => setTab("projects")}
                      >
                        <FeedList
                          items={nextProjects.slice(0, 6)}
                          empty="Nothing pending."
                          now={now}
                          isMod={isMod}
                          onEdit={openEdit}
                          onDelete={(x) => remove.mutate(x)}
                          onOpen={setSelected}
                        />
                      </FeedSection>

                      <FeedSection
                        title="Attendance"
                        tone="text-cyan"
                        onSeeAll={() => setTab("attendance")}
                      >
                        <AttendancePanel now={now} compact />
                      </FeedSection>
                    </>
                  )}
                </div>

                <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-32">
                  <AnnouncementsPanel compact />
                  <ActivityPanel compact />
                </aside>
              </div>
            )}



            {tab === "calendar" && (
              <CalendarPanel
                canManage={isMod}
                batchId={batchId}

                deadlines={filtered}
                sessions={sessions}
                courses={courses}
                now={now}
                onSelect={setSelected}
              />
            )}

            {tab === "timetable" && <TimetablePanel />}

            {tab === "quizzes" && (
              <DeadlineBoard
                title="Quizzes"
                items={quizzes}
                now={now}
                canManage={isMod}
                showMarks
                onEdit={openEdit}
                onDelete={(x) => remove.mutate(x)}
                onOpen={setSelected}
              />
            )}

            {tab === "exams" && (
              <DeadlineBoard
                title="Midterms & endterms"
                items={exams}
                now={now}
                canManage={isMod}
                typeFilters={EXAM_TYPES}
                showMarks
                onEdit={openEdit}
                onDelete={(x) => remove.mutate(x)}
                onOpen={setSelected}
              />
            )}

            {tab === "projects" && (
              <DeadlineBoard
                title="Projects & assignments"
                items={projects}
                now={now}
                canManage={isMod}
                onEdit={openEdit}
                onDelete={(x) => remove.mutate(x)}
                onOpen={setSelected}
              />
            )}

            {tab === "attendance" && <AttendancePanel now={now} />}

          </motion.div>
        </AnimatePresence>

      </main>

      <EventDrawer
        deadline={selected}
        now={now}
        canManage={isMod}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDelete={(d) => remove.mutate(d)}
      />

      <Dialog open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">
              {panel ? PANEL_TITLES[panel] : ""}
            </DialogTitle>
          </DialogHeader>
          {panel === "members" && <MembersPanel />}
          {panel === "feedback" && <FeedbackPanel />}
          {panel === "approvals" && isMod && (
            <ApprovalsPanel deadlines={deadlines} onSelect={setSelected} />
          )}
          {panel === "inbox" && isMod && <EmailInboxPanel />}
        </DialogContent>
      </Dialog>

      {isMod && (
        <DeadlineDialog open={dialogOpen} onOpenChange={setDialogOpen} deadline={editing} />
      )}
    </div>
  );
}

/** A short list of deadline rows, or a quiet empty line. */
function FeedList({
  items,
  empty,
  now,
  isMod,
  onEdit,
  onDelete,
  onOpen,
}: {
  items: Deadline[];
  empty: string;
  now: number;
  isMod: boolean;
  onEdit: (d: Deadline) => void;
  onDelete: (d: Deadline) => void;
  onOpen: (d: Deadline) => void;
}) {
  if (items.length === 0)
    return <p className="font-mono text-[11px] text-faint">{empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      {items.map((d) => (
        <DeadlineRow
          key={d.id}
          deadline={d}
          now={now}
          canManage={isMod}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

/** Titled block used to break the feed into readable sections. */

function FeedSection({
  title,
  tone,
  count,
  onSeeAll,
  children,
}: {
  title: string;
  tone: string;
  count?: number;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-center gap-3">
        <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${tone}`}>{title}</p>
        <span className="h-px flex-1 bg-border" />
        {typeof count === "number" && (
          <span className="font-mono text-[10px] text-faint">{count}</span>
        )}
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="rounded-lg px-2 py-1 font-mono text-[10px] text-dim ring-1 ring-border transition-colors hover:text-ink"
          >
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Full-tab list of one kind of work, split into what's live, ahead and done. */
function DeadlineBoard({
  title,
  items,
  now,
  canManage,
  typeFilters,
  showMarks = false,
  onEdit,
  onDelete,
  onOpen,
}: {
  title: string;
  items: Deadline[];
  now: number;
  canManage: boolean;
  typeFilters?: readonly DeadlineType[];
  showMarks?: boolean;
  onEdit: (d: Deadline) => void;
  onDelete: (d: Deadline) => void;
  onOpen: (d: Deadline) => void;
}) {
  const [types, setTypes] = useState<DeadlineType[]>([]);

  const shown = useMemo(
    () => (types.length === 0 ? items : items.filter((d) => types.includes(d.type))),
    [items, types],
  );

  const groups: [string, Deadline[], string][] = [
    ["Happening now", shown.filter((d) => phaseOf(d, now) === "ongoing"), "text-cyan"],
    ["Upcoming", shown.filter((d) => phaseOf(d, now) === "upcoming"), "text-amber"],
    [
      "Completed",
      shown
        .filter((d) => phaseOf(d, now) === "completed")
        .sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime()),
      "text-evt-present",
    ],
  ];

  return (
    <section className="mt-2">
      <h2 className="mb-6 font-display text-xl font-semibold tracking-tight">{title}</h2>

      {typeFilters && typeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTypes([])}
            className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] outline-none ring-1 transition-colors focus:outline-none focus-visible:outline-none ${
              types.length === 0
                ? "bg-cyan/15 text-cyan ring-cyan/40"
                : "text-dim ring-border hover:text-ink"
            }`}
          >
            All ({items.length})
          </button>
          {typeFilters.map((t) => {
            const meta = eventMeta(t);
            const n = items.filter((d) => d.type === t).length;
            const on = types.includes(t);
            return (
              <button
                key={t}
                onClick={() =>
                  setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
                }
                className={`rounded-lg px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] outline-none transition-all focus:outline-none focus-visible:outline-none ${meta.chip} ${
                  on ? "ring-2" : ""
                } ${types.length > 0 && !on ? "opacity-50" : ""}`}
              >
                {meta.label} ({n})
              </button>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-surface/50 px-8 py-14 text-center font-mono text-xs text-faint ring-1 ring-border">
          Nothing here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-9">
          {groups.map(([label, list, tone]) =>
            list.length === 0 ? null : (
              <div key={label}>
                <div className="mb-3 flex items-center gap-3">
                  <p className={`font-mono text-[10px] uppercase tracking-[0.2em] ${tone}`}>
                    {label}
                  </p>
                  <span className="h-px flex-1 bg-border" />
                  <p className="font-mono text-[10px] text-faint">{list.length}</p>
                </div>
                <div className={`flex flex-col gap-4 ${label === "Completed" ? "opacity-70" : ""}`}>
                  {list.map((d) => (
                    <div key={d.id}>
                      <DeadlineRow
                        deadline={d}
                        now={now}
                        canManage={canManage}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onOpen={onOpen}
                      />
                      {showMarks && <ExamMarks deadline={d} />}
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
