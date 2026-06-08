import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  Search, X, Users, Layers, Grid3X3, GitBranch,
  Map, Pencil, User, ChevronRight, Calendar, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/contexts/DepartmentsContext";
import { Department } from "@/data/departments";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/hooks/useProfiles";
import EditOrganizationDialog from "@/components/EditOrganizationDialog";
import OrgChartAutoView from "@/components/OrgChartAutoView";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const CW  = 205;   // card width
const CH  = 170;   // card height
const CG  = 20;    // gap between cards
const DGW = 330;   // DG card width
const DGH = 118;   // DG card height
const GY  = 124;   // vertical gap (DG → dept row)
const PX  = 60;    // canvas horizontal padding
const PT  = 48;    // canvas top padding
const PB  = 72;    // canvas bottom padding

const AVATAR_PALETTE: [string, string][] = [
  ["#dbeafe", "#1d4ed8"], ["#ede9fe", "#6d28d9"], ["#fce7f3", "#be185d"],
  ["#dcfce7", "#15803d"], ["#ffedd5", "#c2410c"], ["#cffafe", "#0e7490"],
  ["#fef9c3", "#a16207"], ["#f1f5f9", "#475569"],
];

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const initials = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);

const avatarPalette = (name: string): [string, string] =>
  AVATAR_PALETTE[Math.abs(name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % AVATAR_PALETTE.length];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ─────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────── */
const Avatar = ({ name, size = 30 }: { name: string; size?: number }) => {
  const [bg, fg] = avatarPalette(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
};

interface DGCardProps {
  org: ReturnType<typeof useOrganization>["organization"];
  orgView: "today" | "tomorrow";
  pos: { x: number; y: number };
  isAdmin: boolean;
  onEdit: () => void;
  entered: boolean;
}
const DGCard = ({ org, orgView, pos, isAdmin, onEdit, entered }: DGCardProps) => {
  const title = orgView === "tomorrow" ? (org.titleTomorrow || org.titleToday) : org.titleToday;
  const role  = orgView === "tomorrow" ? (org.leaderRoleTomorrow || org.leaderRoleToday) : org.leaderRoleToday;
  const [bg, fg] = avatarPalette(org.leader || "DG");

  return (
    <motion.div
      data-no-pan
      initial={false}
      animate={entered ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -24, scale: 0.94 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "absolute", left: pos.x, top: pos.y, width: DGW }}
      className="group"
    >
      <div className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-primary/20">
        {/* Gold accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/80 to-amber-300" />
        <div className="bg-secondary px-5 py-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-full ring-2 ring-primary/40 overflow-hidden"
                   style={{ width: 36, height: 36, backgroundColor: bg }}>
                <div className="w-full h-full flex items-center justify-center font-bold text-[13px]"
                     style={{ color: fg }}>
                  {initials(org.leader || org.name)}
                </div>
              </div>
              <div>
                <p className="font-display font-bold text-[13px] text-white leading-tight">
                  {org.leader || org.name}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5">{role}</p>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Org info */}
          <div className="border-t border-white/10 pt-3">
            <p className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mb-0.5">
              {org.name}
            </p>
            <p className="text-white font-semibold text-[12px] leading-snug">
              {title}
            </p>
            {org.leaderDirection && (
              <p className="text-[10px] text-white/50 mt-1">{org.leaderDirection}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface DeptCardProps {
  dept: Department;
  orgView: "today" | "tomorrow";
  pos: { x: number; y: number };
  isSelected: boolean;
  dimmed: boolean;
  searchMatch: boolean | null;
  searchActive: boolean;
  delay: number;
  entered: boolean;
  onClick: () => void;
}
const DeptCard = ({
  dept, orgView, pos, isSelected, dimmed, searchMatch, searchActive, delay, entered, onClick,
}: DeptCardProps) => {
  const name    = orgView === "tomorrow" ? (dept.nameTomorrow || dept.name) : dept.name;
  const members = orgView === "tomorrow" ? dept.compositionTomorrow : dept.compositionToday;
  const doneMS  = [...(dept.milestones2026 ?? []), ...(dept.milestones2027 ?? [])].filter(m => m.status === "done").length;
  const totalMS = (dept.milestones2026?.length ?? 0) + (dept.milestones2027?.length ?? 0);
  const [bg] = avatarPalette(dept.head || name);

  const headerColor = dept.color || "#001b61";

  const opacity = dimmed ? 0.1 : (searchActive && searchMatch === false ? 0.25 : 1);
  const blur    = dimmed ? "blur(1.5px)" : "none";
  const ringClass = isSelected
    ? "ring-2 ring-primary shadow-[0_0_0_4px_rgba(255,174,3,0.25)] shadow-xl"
    : searchActive && searchMatch
    ? "ring-2 ring-secondary/60"
    : "ring-1 ring-border/60 hover:ring-secondary/30 hover:shadow-lg";

  return (
    <motion.div
      data-no-pan
      initial={false}
      animate={entered ? { opacity, y: 0, scale: 1 } : { opacity: 0, y: 32, scale: 0.92 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1], opacity: { duration: 0.3 } }}
      style={{
        position: "absolute", left: pos.x, top: pos.y,
        width: CW, filter: blur, pointerEvents: "auto",
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className={cn(
        "rounded-2xl overflow-hidden bg-white cursor-pointer transition-all duration-300 group",
        ringClass,
      )}>
        {/* Colored header */}
        <div className="h-[52px] px-3.5 flex items-center gap-2.5"
             style={{ background: `linear-gradient(135deg, ${headerColor}f0, ${headerColor}b0)` }}>
          <span className="text-[22px] leading-none">{dept.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-[11.5px] leading-tight truncate">{name}</p>
            <p className="text-white/60 text-[9.5px] mt-0.5">
              {members.length} membre{members.length !== 1 ? "s" : ""}
            </p>
          </div>
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        {/* Body */}
        <div className="px-3.5 py-3 space-y-2.5">
          {/* Head */}
          {dept.head && (
            <div className="flex items-center gap-2">
              <Avatar name={dept.head} size={28} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-secondary truncate">{dept.head}</p>
                <p className="text-[9.5px] text-muted-foreground truncate">{dept.headRoleToday}</p>
              </div>
            </div>
          )}
          {dept.head2 && (
            <div className="flex items-center gap-2">
              <Avatar name={dept.head2} size={28} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-secondary truncate">{dept.head2}</p>
                <p className="text-[9.5px] text-muted-foreground truncate">{dept.headRoleToday2}</p>
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
            {dept.services.length > 0 && (
              <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                <Layers className="w-2.5 h-2.5" />
                {dept.services.length} service{dept.services.length !== 1 ? "s" : ""}
              </span>
            )}
            {totalMS > 0 && (
              <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                <Calendar className="w-2.5 h-2.5" />
                {doneMS}/{totalMS}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────
   DRAWER
───────────────────────────────────────── */
const OrgDrawer = ({
  dept, orgView, profiles, onClose,
}: {
  dept: Department;
  orgView: "today" | "tomorrow";
  profiles: ReturnType<typeof useProfiles>;
  onClose: () => void;
}) => {
  const name     = orgView === "tomorrow" ? (dept.nameTomorrow || dept.name) : dept.name;
  const mission  = orgView === "tomorrow" ? dept.missionTomorrow : dept.missionToday;
  const members  = orgView === "tomorrow" ? dept.compositionTomorrow : dept.compositionToday;
  const allMS    = [...(dept.milestones2026 ?? []), ...(dept.milestones2027 ?? [])];
  const doneMS   = allMS.filter(m => m.status === "done").length;
  const inProgMS = allMS.filter(m => m.status === "in-progress").length;
  const headerColor = dept.color || "#001b61";

  const getPoste = (pname: string) => profiles.find(p => p.full_name === pname)?.poste ?? "";

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
        className="fixed right-0 top-0 h-full w-[390px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-[88px] flex items-center px-5 gap-3.5 shrink-0"
             style={{ background: `linear-gradient(135deg, ${headerColor}, ${headerColor}cc)` }}>
          <span className="text-[32px] leading-none">{dept.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-display font-bold text-[17px] leading-tight truncate">{name}</p>
            <p className="text-white/60 text-[11px] mt-0.5">
              {members.length} membre{members.length !== 1 ? "s" : ""} · {dept.services.length} service{dept.services.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Responsables */}
          {(dept.head || dept.head2) && (
            <section className="px-5 py-4 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Responsable{dept.head2 ? "s" : ""}
              </p>
              <div className="space-y-3">
                {dept.head && (
                  <div className="flex items-center gap-3">
                    <Avatar name={dept.head} size={40} />
                    <div>
                      <p className="font-semibold text-[13px] text-secondary">{dept.head}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {getPoste(dept.head) || dept.headRoleToday || ""}
                      </p>
                    </div>
                  </div>
                )}
                {dept.head2 && (
                  <div className="flex items-center gap-3">
                    <Avatar name={dept.head2} size={40} />
                    <div>
                      <p className="font-semibold text-[13px] text-secondary">{dept.head2}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {getPoste(dept.head2) || dept.headRoleToday2 || ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Mission */}
          {mission && (
            <section className="px-5 py-4 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-2">
                Mission
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{mission}</p>
            </section>
          )}

          {/* Milestones */}
          {allMS.length > 0 && (
            <section className="px-5 py-4 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Jalons ({allMS.length})
              </p>
              <div className="flex gap-2.5">
                <div className="flex-1 rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-[20px] font-bold text-emerald-600">{doneMS}</p>
                  <p className="text-[9.5px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">Complétés</p>
                </div>
                <div className="flex-1 rounded-xl bg-amber-50 p-3 text-center">
                  <p className="text-[20px] font-bold text-amber-500">{inProgMS}</p>
                  <p className="text-[9.5px] text-amber-500 font-semibold uppercase tracking-wider mt-0.5">En cours</p>
                </div>
                <div className="flex-1 rounded-xl bg-muted p-3 text-center">
                  <p className="text-[20px] font-bold text-muted-foreground">{allMS.length - doneMS - inProgMS}</p>
                  <p className="text-[9.5px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Planifiés</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${allMS.length ? (doneMS / allMS.length) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </section>
          )}

          {/* Services */}
          {dept.services.length > 0 && (
            <section className="px-5 py-4 border-b border-border/40">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Services ({dept.services.length})
              </p>
              <div className="space-y-2">
                {dept.services.map((svc, i) => (
                  <div key={i} className="rounded-xl bg-muted/60 p-3">
                    <p className="text-[12px] font-semibold text-secondary">{svc.name}</p>
                    {svc.responsible && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">
                          {svc.responsible}
                          {getPoste(svc.responsible) && ` — ${getPoste(svc.responsible)}`}
                        </p>
                      </div>
                    )}
                    {svc.members && svc.members.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {svc.members.map((m, j) => (
                          <span key={j} className="text-[9.5px] px-2 py-0.5 rounded-full bg-background border border-border/60 text-muted-foreground">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Members */}
          {members.length > 0 && (
            <section className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-muted-foreground mb-3">
                Équipe ({members.length})
              </p>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Avatar name={m.name} size={30} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{m.name}</p>
                      {m.role && <p className="text-[10.5px] text-muted-foreground truncate">{m.role}</p>}
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

/* ─────────────────────────────────────────
   MINIMAP
───────────────────────────────────────── */
const Minimap = ({
  depts, deptPositions, dgPos, canvasW, canvasH,
  pan, scale, containerW, containerH,
}: {
  depts: Department[];
  deptPositions: { x: number; y: number }[];
  dgPos: { x: number; y: number };
  canvasW: number; canvasH: number;
  pan: { x: number; y: number };
  scale: number;
  containerW: number; containerH: number;
}) => {
  const MM_W = 168;
  const MM_H = 100;
  const ms = MM_W / canvasW;

  // Viewport rect in minimap coords
  const vpX  = clamp(-pan.x / scale * ms, 0, MM_W);
  const vpY  = clamp(-pan.y / scale * ms, 0, MM_H);
  const vpW  = clamp((containerW / scale) * ms, 0, MM_W - vpX);
  const vpH  = clamp((containerH / scale) * ms, 0, MM_H - vpY);

  return (
    <div className="absolute bottom-4 left-4 rounded-xl border border-border/50 bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden"
         style={{ width: MM_W, height: MM_H }}>
      {/* DG node */}
      <div className="absolute rounded bg-secondary"
           style={{ left: dgPos.x * ms, top: dgPos.y * ms, width: DGW * ms, height: DGH * ms }} />
      {/* Dept nodes */}
      {depts.map((d, i) => (
        <div key={d.id} className="absolute rounded"
             style={{
               left: deptPositions[i].x * ms, top: deptPositions[i].y * ms,
               width: CW * ms, height: CH * ms,
               backgroundColor: d.color || "#001b61",
             }} />
      ))}
      {/* Viewport indicator */}
      <div className="absolute border-2 border-primary/70 rounded pointer-events-none"
           style={{ left: vpX, top: vpY, width: vpW, height: vpH }} />
      {/* Label */}
      <div className="absolute bottom-0 right-0 px-1.5 py-0.5 bg-secondary/80 rounded-tl-lg">
        <span className="text-[8px] text-white font-bold uppercase tracking-wider">Minimap</span>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   GRID VIEW
───────────────────────────────────────── */
const GridView = ({
  depts, orgView, selectedDept, searchQuery, onSelect,
}: {
  depts: Department[];
  orgView: "today" | "tomorrow";
  selectedDept: Department | null;
  searchQuery: string;
  onSelect: (d: Department) => void;
}) => {
  const filtered = searchQuery
    ? depts.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.nameTomorrow.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.head.toLowerCase().includes(searchQuery.toLowerCase()))
    : depts;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {filtered.map((dept, i) => {
        const name = orgView === "tomorrow" ? (dept.nameTomorrow || dept.name) : dept.name;
        const members = orgView === "tomorrow" ? dept.compositionTomorrow : dept.compositionToday;
        const headerColor = dept.color || "#001b61";
        const isSelected = selectedDept?.id === dept.id;

        return (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onSelect(dept)}
            className={cn(
              "rounded-2xl overflow-hidden bg-white cursor-pointer transition-all duration-300",
              isSelected
                ? "ring-2 ring-primary shadow-[0_0_0_4px_rgba(255,174,3,0.2)] shadow-xl"
                : "ring-1 ring-border/60 hover:ring-secondary/30 hover:shadow-md hover:-translate-y-0.5"
            )}
          >
            <div className="h-14 px-4 flex items-center gap-3"
                 style={{ background: `linear-gradient(135deg, ${headerColor}f0, ${headerColor}b0)` }}>
              <span className="text-[24px]">{dept.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-[12px] truncate">{name}</p>
                <p className="text-white/60 text-[10px]">{members.length} membres</p>
              </div>
            </div>
            <div className="px-4 py-3">
              {dept.head && (
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={dept.head} size={26} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-secondary truncate">{dept.head}</p>
                    <p className="text-[9.5px] text-muted-foreground">{dept.headRoleToday}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 mt-2">
                {dept.services.length > 0 && (
                  <span className="text-[9.5px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                    {dept.services.length} service{dept.services.length !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-[9.5px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground">
                  {members.length} membre{members.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
interface OrgChartProps {
  view?: "today" | "tomorrow";
}

const OrgChart = ({ view: externalView = "today" }: OrgChartProps) => {
  const { departments }                    = useDepartments();
  const { organization, updateOrganization } = useOrganization();
  const { isAdmin }                        = useAuth();
  const profiles                           = useProfiles();

  /* ── State ── */
  const [orgView, setOrgView]             = useState<"today" | "tomorrow">(externalView);
  const [viewMode, setViewMode]           = useState<"tree" | "grid" | "auto">("tree");
  const [scale, setScale]                 = useState(0.78);
  const [pan, setPan]                     = useState({ x: 0, y: 0 });
  const [selectedDept, setSelectedDept]   = useState<Department | null>(null);
  const [spotlightOn, setSpotlightOn]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [showMinimap, setShowMinimap]     = useState(true);
  const [isPresentation, setPresentation] = useState(false);
  const [editingOrg, setEditingOrg]       = useState(false);
  const [entered, setEntered]             = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  /* ── Refs ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging   = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });

  /* ── Derived data ── */
  const dgDept = useMemo(() =>
    departments.find(d =>
      organization.leaderDirection &&
      d.name.toLowerCase() === organization.leaderDirection.toLowerCase()
    ),
  [departments, organization.leaderDirection]);

  const visibleDepts = useMemo(() =>
    departments.filter(d => d.id !== dgDept?.id && d.visibleOnOrgChart !== false),
  [departments, dgDept]);

  /* ── Canvas geometry ── */
  const n          = visibleDepts.length;
  const canvasW    = Math.max(DGW + 2 * PX, n * CW + (n - 1) * CG + 2 * PX);
  const canvasH    = PT + DGH + GY + CH + PB;
  const dgPos      = { x: (canvasW - DGW) / 2, y: PT };
  const deptsRowW  = n * CW + (n - 1) * CG;
  const deptStartX = (canvasW - deptsRowW) / 2;
  const deptY      = PT + DGH + GY;
  const deptPositions = useMemo(() =>
    visibleDepts.map((_, i) => ({ x: deptStartX + i * (CW + CG), y: deptY })),
  [visibleDepts, deptStartX, deptY]);

  /* ── Search matching ── */
  const matchIdx = useMemo(() => {
    if (!searchQuery.trim()) return -1;
    const q = searchQuery.toLowerCase();
    return visibleDepts.findIndex(d =>
      d.name.toLowerCase().includes(q) ||
      d.nameTomorrow.toLowerCase().includes(q) ||
      d.head.toLowerCase().includes(q)
    );
  }, [searchQuery, visibleDepts]);

  /* ── Init: measure container + fit zoom ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setContainerSize({ w: width, h: height });
    const fitScale = clamp(Math.min((width - 40) / canvasW, (height - 40) / canvasH), 0.3, 1);
    const initPanX = (width  - canvasW * fitScale) / 2;
    const initPanY = Math.max(16, (height - canvasH * fitScale) / 2);
    setScale(fitScale);
    setPan({ x: initPanX, y: initPanY });
    setTimeout(() => setEntered(true), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Wheel zoom ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rect   = el.getBoundingClientRect();
      const cx     = e.clientX - rect.left;
      const cy     = e.clientY - rect.top;
      setScale(prev => {
        const next  = clamp(prev * factor, 0.18, 2.8);
        const ratio = next / prev;
        setPan(p => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ── Pan to search match ── */
  useEffect(() => {
    if (matchIdx < 0 || viewMode !== "tree" || !containerRef.current) return;
    const pos = deptPositions[matchIdx];
    if (!pos) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setPan({
      x: width  / 2 - (pos.x + CW / 2) * scale,
      y: height / 2 - (pos.y + CH / 2) * scale,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdx]);

  /* ── Zoom helpers ── */
  const zoomBy = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const cx = width / 2; const cy = height / 2;
    setScale(prev => {
      const next  = clamp(prev * factor, 0.18, 2.8);
      const ratio = next / prev;
      setPan(p => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const fitScale = clamp(Math.min((width - 40) / canvasW, (height - 40) / canvasH), 0.3, 1);
    setScale(fitScale);
    setPan({ x: (width - canvasW * fitScale) / 2, y: Math.max(16, (height - canvasH * fitScale) / 2) });
  }, [canvasW, canvasH]);

  /* ── Mouse pan ── */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-pan]")) return;
    isDragging.current  = true;
    lastMouse.current   = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  /* ── Dept click handler ── */
  const handleDeptClick = useCallback((dept: Department) => {
    if (selectedDept?.id === dept.id) {
      setSelectedDept(null);
      setSpotlightOn(false);
    } else {
      setSelectedDept(dept);
      setSpotlightOn(true);
    }
  }, [selectedDept]);

  const handleClose = useCallback(() => {
    setSelectedDept(null);
    setSpotlightOn(false);
  }, []);

  /* ── SVG connector paths ── */
  const dgBottomX = dgPos.x + DGW / 2;
  const dgBottomY = dgPos.y + DGH;

  const outerCls = isPresentation
    ? "fixed inset-0 z-50 bg-[#060d1f] flex flex-col"
    : "flex flex-col rounded-2xl overflow-hidden border border-border/60 bg-white";

  const canvasAreaCls = isPresentation
    ? "flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#060d1f]"
    : "flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-[#f0f3f9]";

  const presNodeOpacity = isPresentation ? 1 : undefined;

  return (
    <div className={cn(outerCls, "h-[calc(100vh-190px)] min-h-[500px]")}>

      {/* ── TOOLBAR ── */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b shrink-0",
        isPresentation
          ? "bg-white/5 border-white/10"
          : "bg-white border-border/40"
      )}>

        {/* View toggle */}
        <div className={cn(
          "flex items-center gap-0.5 rounded-xl p-0.5",
          isPresentation ? "bg-white/10" : "bg-muted"
        )}>
          <button
            onClick={() => setViewMode("tree")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all",
              viewMode === "tree"
                ? "bg-white shadow-sm text-secondary"
                : isPresentation ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Arbre
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all",
              viewMode === "grid"
                ? "bg-white shadow-sm text-secondary"
                : isPresentation ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            Grille
          </button>
          <button
            onClick={() => setViewMode("auto")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all",
              viewMode === "auto"
                ? "bg-secondary text-white shadow-sm"
                : isPresentation ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3.5 h-3.5" />
            Hiérarchie
          </button>
        </div>

        {/* Today / Tomorrow — masqué en mode Hiérarchie automatique */}
        {viewMode !== "auto" && <div className={cn(
          "flex items-center gap-0.5 rounded-xl p-0.5",
          isPresentation ? "bg-white/10" : "bg-muted"
        )}>
          {(["today", "tomorrow"] as const).map(v => (
            <button
              key={v}
              onClick={() => setOrgView(v)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all",
                orgView === v
                  ? "bg-secondary text-white shadow-sm"
                  : isPresentation ? "text-white/50 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "today" ? "Aujourd'hui" : "Demain"}
            </button>
          ))}
        </div>}

        {/* Search */}
        <div className="relative flex-1 max-w-[240px]">
          <Search className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
            isPresentation ? "text-white/40" : "text-muted-foreground/50"
          )} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher…"
            data-no-pan
            className={cn(
              "w-full pl-8 pr-8 py-1.5 rounded-xl text-[12px] outline-none border transition-all",
              isPresentation
                ? "bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-white/40"
                : "bg-muted border-transparent focus:border-secondary/30 focus:bg-white"
            )}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
                    data-no-pan
                    className={cn("absolute right-2 top-1/2 -translate-y-1/2", isPresentation ? "text-white/40" : "text-muted-foreground/40")}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Dept count badge */}
        <span className={cn(
          "text-[11px] font-semibold px-2.5 py-1 rounded-full",
          isPresentation ? "bg-white/10 text-white/60" : "bg-muted text-muted-foreground"
        )}>
          {visibleDepts.length} dept.
        </span>

        {/* Zoom controls */}
        {viewMode === "tree" && (
          <div className="flex items-center gap-1">
            <button onClick={() => zoomBy(1.2)} data-no-pan
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      isPresentation ? "hover:bg-white/10 text-white/70" : "hover:bg-muted text-muted-foreground")}>
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} data-no-pan
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10.5px] font-mono font-bold transition-colors",
                      isPresentation ? "hover:bg-white/10 text-white/70" : "hover:bg-muted text-muted-foreground"
                    )}>
              {Math.round(scale * 100)}%
            </button>
            <button onClick={() => zoomBy(0.8)} data-no-pan
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      isPresentation ? "hover:bg-white/10 text-white/70" : "hover:bg-muted text-muted-foreground")}>
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetView} data-no-pan
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      isPresentation ? "hover:bg-white/10 text-white/70" : "hover:bg-muted text-muted-foreground")}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setShowMinimap(m => !m)} data-no-pan
                    className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                      showMinimap
                        ? "bg-secondary/10 text-secondary"
                        : isPresentation ? "text-white/40 hover:bg-white/10" : "text-muted-foreground hover:bg-muted")}>
              <Map className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Spotlight toggle */}
        {selectedDept && (
          <button
            data-no-pan
            onClick={() => setSpotlightOn(s => !s)}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
              spotlightOn
                ? "bg-primary/10 text-primary"
                : isPresentation ? "text-white/40 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Presentation mode */}
        <button
          data-no-pan
          onClick={() => setPresentation(p => !p)}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
            isPresentation
              ? "bg-white/10 text-white hover:bg-white/20"
              : "hover:bg-muted text-muted-foreground"
          )}
        >
          {isPresentation ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── CANVAS AREA ── */}
      {viewMode === "tree" ? (
        <div
          ref={containerRef}
          className={canvasAreaCls}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={() => { if (!isDragging.current) handleClose(); }}
        >
          {/* Dot grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: isPresentation
                ? "radial-gradient(circle, rgba(255,255,255,0.07) 1.5px, transparent 1.5px)"
                : "radial-gradient(circle, rgba(0,27,97,0.055) 1.5px, transparent 1.5px)",
              backgroundSize: "26px 26px",
            }}
          />

          {/* Transformed canvas */}
          <div
            style={{
              position: "absolute",
              width: canvasW,
              height: canvasH,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              opacity: presNodeOpacity,
            }}
          >
            {/* ─ SVG connector lines ─ */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
            >
              {/* Horizontal bar at DG bottom */}
              <motion.line
                x1={deptPositions[0] ? deptPositions[0].x + CW / 2 : dgBottomX}
                y1={dgBottomY + GY / 2}
                x2={deptPositions[n - 1] ? deptPositions[n - 1].x + CW / 2 : dgBottomX}
                y2={dgBottomY + GY / 2}
                stroke={isPresentation ? "rgba(255,255,255,0.15)" : "rgba(0,27,97,0.15)"}
                strokeWidth={1.5}
                initial={{ pathLength: 0 }}
                animate={entered ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              />
              {/* Vertical from DG to bar */}
              <motion.line
                x1={dgBottomX} y1={dgBottomY}
                x2={dgBottomX} y2={dgBottomY + GY / 2}
                stroke={isPresentation ? "rgba(255,255,255,0.15)" : "rgba(0,27,97,0.15)"}
                strokeWidth={1.5}
                initial={{ pathLength: 0 }}
                animate={entered ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ duration: 0.25, delay: 0.25 }}
              />
              {/* Vertical from bar to each dept */}
              {visibleDepts.map((dept, i) => {
                const pos    = deptPositions[i];
                if (!pos) return null;
                const midX   = pos.x + CW / 2;
                const isLit  = !spotlightOn || selectedDept?.id === dept.id;
                const isSearchHit = !searchQuery || dept.name.toLowerCase().includes(searchQuery.toLowerCase()) || dept.head.toLowerCase().includes(searchQuery.toLowerCase());

                return (
                  <motion.line
                    key={dept.id}
                    x1={midX} y1={dgBottomY + GY / 2}
                    x2={midX} y2={pos.y}
                    stroke={
                      selectedDept?.id === dept.id
                        ? "#ffae03"
                        : isPresentation
                        ? "rgba(255,255,255,0.12)"
                        : "rgba(0,27,97,0.13)"
                    }
                    strokeWidth={selectedDept?.id === dept.id ? 2.5 : 1.5}
                    strokeDasharray={selectedDept?.id === dept.id ? "6 3" : undefined}
                    opacity={isLit && isSearchHit ? 1 : 0.15}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={entered ? { pathLength: 1, opacity: isLit && isSearchHit ? 1 : 0.15 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.35, delay: 0.38 + i * 0.04 }}
                  />
                );
              })}
            </svg>

            {/* ─ DG Card ─ */}
            <DGCard
              org={organization}
              orgView={orgView}
              pos={dgPos}
              isAdmin={isAdmin}
              onEdit={() => setEditingOrg(true)}
              entered={entered}
            />

            {/* ─ Dept Cards ─ */}
            {visibleDepts.map((dept, i) => {
              const pos         = deptPositions[i];
              if (!pos) return null;
              const isSelected  = selectedDept?.id === dept.id;
              const dimmed      = spotlightOn && !isSelected;
              const q           = searchQuery.trim().toLowerCase();
              const isMatch     = q
                ? dept.name.toLowerCase().includes(q) || dept.head.toLowerCase().includes(q) || dept.nameTomorrow.toLowerCase().includes(q)
                : null;

              return (
                <DeptCard
                  key={dept.id}
                  dept={dept}
                  orgView={orgView}
                  pos={pos}
                  isSelected={isSelected}
                  dimmed={dimmed}
                  searchMatch={isMatch}
                  searchActive={!!searchQuery.trim()}
                  delay={0.46 + i * 0.055}
                  entered={entered}
                  onClick={() => handleDeptClick(dept)}
                />
              );
            })}
          </div>

          {/* Minimap */}
          {showMinimap && (
            <Minimap
              depts={visibleDepts}
              deptPositions={deptPositions}
              dgPos={dgPos}
              canvasW={canvasW}
              canvasH={canvasH}
              pan={pan}
              scale={scale}
              containerW={containerSize.w}
              containerH={containerSize.h}
            />
          )}

          {/* Presentation mode hint */}
          {isPresentation && (
            <div className="absolute top-4 right-4 text-white/30 text-[11px] pointer-events-none select-none">
              Molette pour zoomer · Cliquer-glisser pour naviguer
            </div>
          )}

          {/* Spotlight label */}
          {spotlightOn && selectedDept && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-secondary/90 text-white text-[11px] font-semibold backdrop-blur-sm shadow-lg flex items-center gap-2 pointer-events-none"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Mode spotlight — {orgView === "tomorrow" ? (selectedDept.nameTomorrow || selectedDept.name) : selectedDept.name}
            </motion.div>
          )}
        </div>
      ) : viewMode === "auto" ? (
        /* ── AUTO HIERARCHY MODE ── */
        <div className="flex-1 overflow-hidden flex flex-col">
          <OrgChartAutoView
            profiles={profiles}
            departments={departments}
          />
        </div>
      ) : (
        /* ── GRID MODE ── */
        <div className="flex-1 overflow-y-auto bg-[#f0f3f9]">
          <GridView
            depts={visibleDepts}
            orgView={orgView}
            selectedDept={selectedDept}
            searchQuery={searchQuery}
            onSelect={handleDeptClick}
          />
        </div>
      )}

      {/* ── DRAWER ── */}
      <AnimatePresence>
        {selectedDept && (
          <OrgDrawer
            dept={selectedDept}
            orgView={orgView}
            profiles={profiles}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>

      {/* ── EDIT ORG DIALOG ── */}
      {editingOrg && (
        <EditOrganizationDialog
          organization={organization}
          open={editingOrg}
          onOpenChange={setEditingOrg}
          onSave={updateOrganization}
        />
      )}
    </div>
  );
};

export default OrgChart;
