import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Users, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Profile } from "@/types";
import { Department } from "@/data/departments";

/* ── Constants ─────────────────────────────────────── */
const NW = 200;
const NH = 72;
const HGAP = 24;
const VGAP = 72;

const AVATAR_PALETTE: [string, string][] = [
  ["#dbeafe", "#1d4ed8"], ["#ede9fe", "#6d28d9"], ["#fce7f3", "#be185d"],
  ["#dcfce7", "#15803d"], ["#ffedd5", "#c2410c"], ["#cffafe", "#0e7490"],
  ["#fef9c3", "#a16207"], ["#f1f5f9", "#475569"], ["#fee2e2", "#b91c1c"],
  ["#d1fae5", "#065f46"],
];

const avatarColors = (name: string): [string, string] =>
  AVATAR_PALETTE[Math.abs((name.charCodeAt(0) ?? 0) + (name.charCodeAt(1) ?? 0)) % AVATAR_PALETTE.length];

const initials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ── Types ─────────────────────────────────────────── */
interface TreeNode {
  profile: Profile;
  children: TreeNode[];
  collapsed: boolean;
  x: number;
  y: number;
  subtreeW: number;
}

/* ── Build tree from flat profiles list ────────────── */
function buildTree(profiles: Profile[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  profiles.forEach(p => {
    nodeMap.set(p.user_id, { profile: p, children: [], collapsed: false, x: 0, y: 0, subtreeW: NW });
  });
  const roots: TreeNode[] = [];
  profiles.forEach(p => {
    const node = nodeMap.get(p.user_id)!;
    if (p.hierarchy_user_id && nodeMap.has(p.hierarchy_user_id)) {
      nodeMap.get(p.hierarchy_user_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function computeSubtreeWidth(node: TreeNode): number {
  if (node.collapsed || node.children.length === 0) { node.subtreeW = NW; return NW; }
  const childrenTotalW = node.children.reduce((sum, c) => sum + computeSubtreeWidth(c), 0) + HGAP * (node.children.length - 1);
  node.subtreeW = Math.max(NW, childrenTotalW);
  return node.subtreeW;
}

function assignPositions(node: TreeNode, cx: number, cy: number): void {
  node.x = cx - NW / 2;
  node.y = cy;
  if (node.collapsed || node.children.length === 0) return;
  const totalW = node.children.reduce((sum, c) => sum + c.subtreeW, 0) + HGAP * (node.children.length - 1);
  let childCx = cx - totalW / 2;
  node.children.forEach(c => {
    assignPositions(c, childCx + c.subtreeW / 2, cy + NH + VGAP);
    childCx += c.subtreeW + HGAP;
  });
}

function layoutForest(roots: TreeNode[]): { canvasW: number; canvasH: number } {
  roots.forEach(r => computeSubtreeWidth(r));
  const totalW = roots.reduce((sum, r) => sum + r.subtreeW, 0) + HGAP * (roots.length - 1);
  const canvasW = Math.max(totalW + 120, 800);
  let rootCx = (canvasW - totalW) / 2;
  roots.forEach(r => { assignPositions(r, rootCx + r.subtreeW / 2, 48); rootCx += r.subtreeW + HGAP; });
  let maxY = 0;
  const walk = (n: TreeNode) => { maxY = Math.max(maxY, n.y + NH); if (!n.collapsed) n.children.forEach(walk); };
  roots.forEach(walk);
  return { canvasW, canvasH: maxY + 80 };
}

function collectNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (n: TreeNode) => { result.push(n); if (!n.collapsed) n.children.forEach(walk); };
  roots.forEach(walk);
  return result;
}

function collectEdges(roots: TreeNode[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const walk = (n: TreeNode) => {
    if (n.collapsed) return;
    n.children.forEach(c => { edges.push({ x1: n.x + NW / 2, y1: n.y + NH, x2: c.x + NW / 2, y2: c.y }); walk(c); });
  };
  roots.forEach(walk);
  return edges;
}

/* ── NodeCard ────────────────────────────────────────── */
const NodeCard = ({
  node, dept, onToggle, onClick, isSelected, isDimmed, isSearchMatch, searchActive,
}: {
  node: TreeNode;
  dept: Department | undefined;
  onToggle: () => void;
  onClick: () => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  isSearchMatch?: boolean;
  searchActive?: boolean;
}) => {
  const p = node.profile;
  const [bg, fg] = avatarColors(p.full_name);
  const hasChildren = node.children.length > 0;
  const deptColor = dept?.color || "#001b61";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDimmed ? 0.2 : 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "absolute", left: node.x, top: node.y, width: NW, height: NH }}
      data-no-pan
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div
        className={cn(
          "w-full h-full rounded-xl bg-white border transition-all duration-200 overflow-hidden cursor-pointer",
          isSelected
            ? "ring-2 ring-primary shadow-[0_0_0_4px_rgba(255,174,3,0.25)] shadow-xl"
            : searchActive && isSearchMatch
            ? "ring-2 ring-secondary/50 shadow-md"
            : [
                "shadow-[0_1px_4px_rgba(0,27,97,0.10),0_0_0_1px_rgba(0,27,97,0.07)]",
                "hover:shadow-[0_4px_16px_rgba(0,27,97,0.14),0_0_0_1.5px_rgba(0,27,97,0.12)]",
                p.is_manager ? "ring-1 ring-primary/30" : "",
              ].join(" ")
        )}
      >
        {/* Department color stripe */}
        <div className="h-[3px] w-full" style={{ backgroundColor: deptColor }} />
        {isSelected && <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-primary m-1 animate-pulse" />}

        <div className="px-3 py-2 flex items-center gap-2.5 h-[calc(100%-3px)]">
          <div
            className="rounded-full shrink-0 flex items-center justify-center font-bold text-[13px]"
            style={{ width: 36, height: 36, backgroundColor: bg, color: fg }}
          >
            {initials(p.full_name)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-[11.5px] text-secondary leading-tight truncate">
              {p.full_name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {p.poste || (p.is_manager ? "Manager" : "Collaborateur")}
            </p>
            {dept && (
              <span
                className="inline-flex items-center text-[8.5px] font-semibold rounded-full px-1.5 py-0.5 mt-1 leading-none"
                style={{ backgroundColor: deptColor + "18", color: deptColor }}
              >
                {dept.icon} {dept.name.replace(/^Département\s+/, "").slice(0, 18)}
              </span>
            )}
          </div>

          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="shrink-0 w-5 h-5 rounded-full bg-secondary/8 hover:bg-secondary/15 flex items-center justify-center transition-colors"
              title={node.collapsed ? "Développer" : "Réduire"}
            >
              {node.collapsed
                ? <ChevronRight className="w-3 h-3 text-secondary/60" />
                : <ChevronDown className="w-3 h-3 text-secondary/60" />}
            </button>
          )}
        </div>
      </div>

      {hasChildren && (
        <div
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold border"
          style={{
            backgroundColor: node.collapsed ? deptColor : "#fff",
            color: node.collapsed ? "#fff" : deptColor,
            borderColor: deptColor + "40",
          }}
        >
          <Users className="w-2.5 h-2.5" />
          {node.children.length}
        </div>
      )}
    </motion.div>
  );
};

/* ── ProfileDrawer ───────────────────────────────────── */
const ProfileDrawer = ({
  profile, dept, profiles, onClose,
}: {
  profile: Profile;
  dept: Department | undefined;
  profiles: Profile[];
  onClose: () => void;
}) => {
  const [bg, fg] = avatarColors(profile.full_name);
  const headerColor = dept?.color || "#001b61";

  const parent = profile.hierarchy_user_id
    ? profiles.find(p => p.user_id === profile.hierarchy_user_id) ?? null
    : null;

  const directReports = profiles.filter(p => p.hierarchy_user_id === profile.user_id);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Drawer */}
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 h-full w-[360px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        data-no-pan
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3.5 shrink-0"
          style={{ background: `linear-gradient(135deg, ${headerColor}, ${headerColor}cc)` }}
        >
          <div
            className="rounded-full shrink-0 flex items-center justify-center font-bold text-[16px] ring-2 ring-white/30"
            style={{ width: 48, height: 48, backgroundColor: bg, color: fg }}
          >
            {initials(profile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-display font-bold text-[16px] leading-tight truncate">
              {profile.full_name}
            </p>
            <p className="text-white/70 text-[11px] mt-0.5 truncate">
              {profile.poste || (profile.is_manager ? "Manager" : "Collaborateur")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Informations */}
          <section className="px-5 py-4 border-b border-border/40 space-y-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
              Informations
            </p>
            {profile.is_manager && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[11px] font-semibold text-primary">Manager</span>
              </div>
            )}
            {dept && (
              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-[22px] leading-none">{dept.icon}</span>
                <div>
                  <p className="text-[10.5px] text-muted-foreground">Département</p>
                  <p className="text-[12px] font-semibold text-secondary">{dept.name}</p>
                </div>
              </div>
            )}
            {profile.service && (
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[13px] shrink-0">⚙️</div>
                <div>
                  <p className="text-[10.5px] text-muted-foreground">Service</p>
                  <p className="text-[12px] font-semibold text-secondary">{profile.service}</p>
                </div>
              </div>
            )}
            {profile.category && (
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[13px] shrink-0">🏷️</div>
                <div>
                  <p className="text-[10.5px] text-muted-foreground">Catégorie</p>
                  <p className="text-[12px] font-semibold text-secondary">{profile.category}</p>
                </div>
              </div>
            )}
          </section>

          {/* Responsable direct */}
          {parent && (
            <section className="px-5 py-4 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Responsable direct
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                  style={{ width: 40, height: 40, backgroundColor: avatarColors(parent.full_name)[0], color: avatarColors(parent.full_name)[1] }}
                >
                  {initials(parent.full_name)}
                </div>
                <div>
                  <p className="font-semibold text-[12.5px] text-secondary">{parent.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {parent.poste || (parent.is_manager ? "Manager" : "Collaborateur")}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Équipe directe */}
          {directReports.length > 0 && (
            <section className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Équipe directe ({directReports.length})
              </p>
              <div className="space-y-2.5">
                {directReports.map(r => (
                  <div key={r.user_id} className="flex items-center gap-2.5">
                    <div
                      className="rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
                      style={{ width: 32, height: 32, backgroundColor: avatarColors(r.full_name)[0], color: avatarColors(r.full_name)[1] }}
                    >
                      {initials(r.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{r.full_name}</p>
                      {(r.poste || r.is_manager) && (
                        <p className="text-[10.5px] text-muted-foreground truncate">
                          {r.poste || "Manager"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </>
  );
};

/* ── Main component ─────────────────────────────────── */
interface OrgChartAutoViewProps {
  profiles: Profile[];
  departments: Department[];
  searchQuery?: string;
}

const OrgChartAutoView = ({ profiles, departments, searchQuery = "" }: OrgChartAutoViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const hasDragged   = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });

  const [scale, setScale]               = useState(0.85);
  const [pan, setPan]                   = useState({ x: 0, y: 0 });
  const [, forceUpdate]                 = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const roots = useMemo(() => buildTree(profiles), [profiles]);

  const deptMap = useMemo(() => {
    const m = new Map<string, Department>();
    departments.forEach(d => m.set(d.id, d));
    return m;
  }, [departments]);

  const { nodes, edges, canvasW, canvasH } = useMemo(() => {
    const { canvasW, canvasH } = layoutForest(roots);
    return {
      nodes: collectNodes(roots),
      edges: collectEdges(roots),
      canvasW,
      canvasH,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, JSON.stringify(roots.map(r => r.collapsed))]);

  // Search: set of matching user_ids
  const matchIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(
      profiles
        .filter(p =>
          p.full_name.toLowerCase().includes(q) ||
          (p.poste || "").toLowerCase().includes(q) ||
          (p.service || "").toLowerCase().includes(q)
        )
        .map(p => p.user_id)
    );
  }, [searchQuery, profiles]);

  // Initial fit
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const fitScale = clamp(Math.min((width - 40) / canvasW, (height - 40) / canvasH), 0.25, 1);
    setScale(fitScale);
    setPan({ x: (width - canvasW * fitScale) / 2, y: 24 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setScale(prev => {
        const next = clamp(prev * factor, 0.18, 2.5);
        const ratio = next / prev;
        setPan(p => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pan drag
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    isDragging.current = true;
    hasDragged.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onMouseUp = () => { isDragging.current = false; };

  const handleCanvasClick = () => {
    if (hasDragged.current) { hasDragged.current = false; return; }
    setSelectedProfile(null);
  };

  const handleReset = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const fitScale = clamp(Math.min((width - 40) / canvasW, (height - 40) / canvasH), 0.25, 1);
    setScale(fitScale);
    setPan({ x: (width - canvasW * fitScale) / 2, y: 24 });
  }, [canvasW, canvasH]);

  const toggleNode = useCallback((node: TreeNode) => {
    node.collapsed = !node.collapsed;
    forceUpdate(v => v + 1);
  }, []);

  const totalPeople = profiles.length;
  const managers = profiles.filter(p => p.is_manager).length;
  const orphans = profiles.filter(p =>
    !p.hierarchy_user_id || !profiles.some(o => o.user_id === p.hierarchy_user_id)
  ).length;

  const searchActive = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-white/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span><strong className="text-secondary">{totalPeople}</strong> collaborateurs</span>
          </div>
          <div className="w-px h-3.5 bg-border" />
          <span className="text-[11px] text-muted-foreground">
            <strong className="text-primary">{managers}</strong> manager{managers !== 1 ? "s" : ""}
          </span>
          {orphans > 0 && (
            <>
              <div className="w-px h-3.5 bg-border" />
              <span className="text-[11px] text-orange-600">
                <strong>{orphans}</strong> sans hiérarchie définie
              </span>
            </>
          )}
          {searchActive && matchIds && (
            <>
              <div className="w-px h-3.5 bg-border" />
              <span className="text-[11px] text-secondary font-medium">
                {matchIds.size} résultat{matchIds.size !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => clamp(s * 1.15, 0.18, 2.5))} title="Zoom +">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => clamp(s * 0.87, 0.18, 2.5))} title="Zoom -">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Réinitialiser">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing bg-[radial-gradient(circle,_#e8ecf4_1px,_transparent_1px)] bg-[size:20px_20px]"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={handleCanvasClick}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width: canvasW,
            height: canvasH,
            position: "relative",
          }}
        >
          {/* SVG edges */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH, pointerEvents: "none" }}>
            {edges.map((e, i) => {
              const midY = (e.y1 + e.y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke="rgba(0,27,97,0.18)"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>

          {/* Node cards */}
          <AnimatePresence>
            {nodes.map(node => {
              const isSelected = selectedProfile?.user_id === node.profile.user_id;
              const isSearchMatch = matchIds ? matchIds.has(node.profile.user_id) : undefined;
              const isDimmed = searchActive && matchIds ? !matchIds.has(node.profile.user_id) : false;
              return (
                <NodeCard
                  key={node.profile.user_id}
                  node={node}
                  dept={node.profile.department_id ? deptMap.get(node.profile.department_id) : undefined}
                  onToggle={() => toggleNode(node)}
                  onClick={() => setSelectedProfile(node.profile)}
                  isSelected={isSelected}
                  isDimmed={isDimmed}
                  isSearchMatch={isSearchMatch}
                  searchActive={searchActive}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-border/30 bg-white/50 shrink-0 flex items-center gap-4 flex-wrap">
        <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Légende :</span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-3 h-3 rounded-full border border-primary/50 ring-1 ring-primary/20 inline-block" />
          Manager
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-8 h-px bg-secondary/30 inline-block" style={{ borderTop: "1.5px solid rgba(0,27,97,0.18)" }} />
          Lien hiérarchique
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Users className="w-3 h-3" />
          Nombre de subordonnés directs
        </span>
      </div>

      {/* Profile Drawer */}
      <AnimatePresence>
        {selectedProfile && (
          <ProfileDrawer
            profile={selectedProfile}
            dept={selectedProfile.department_id ? deptMap.get(selectedProfile.department_id) : undefined}
            profiles={profiles}
            onClose={() => setSelectedProfile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrgChartAutoView;
