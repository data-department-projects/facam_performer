import { motion } from "framer-motion";

interface StatPill {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  minimal?: boolean;
  stats?: StatPill[];
}

const DashboardHeader = ({ title, subtitle, stats }: DashboardHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md shadow-card p-5 mb-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {(title || subtitle) && (
            <div className="min-w-0">
              {title && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-primary" />
                  <h2 className="font-display font-semibold text-lg tracking-tight text-secondary">{title}</h2>
                </div>
              )}
              {subtitle && <p className="text-[13px] text-muted-foreground/70 mt-0.5 ml-3.5">{subtitle}</p>}
            </div>
          )}
        </div>

        {stats && stats.length > 0 && (
          <div className="flex items-center gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/50 bg-muted px-4 py-2.5 text-center hover-lift"
              >
                <p className={`font-display font-semibold text-[13px] ${stat.highlight ? "text-primary" : "text-foreground"}`}>
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardHeader;
