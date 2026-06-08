import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
const logoImg = "/facam_stairway-bleu.png";

interface Campaign {
  id: string;
  title: string;
  description: string;
  logo_url: string | null;
  custom_image_url: string | null;
  button_label: string | null;
  button_url: string | null;
  duration_seconds: number;
  trigger_type: string;
  date_start: string | null;
  date_end: string | null;
  max_views: number | null;
}

const CampaignAnimationPlayer = () => {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [phase, setPhase] = useState<"logo" | "text" | "fadeout">("logo");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkCampaigns();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkCampaigns = async () => {
    if (!user) return;

    // Get active campaigns
    const { data: campaigns } = await supabase
      .from("campaign_animations")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (!campaigns || campaigns.length === 0) return;

    // Get user's viewed campaigns with view count
    const { data: views } = await supabase
      .from("campaign_views")
      .select("campaign_id, viewed_at, view_count")
      .eq("user_id", user.id);

    const viewMap = new Map<string, { lastViewed: Date; viewCount: number }>();
    (views || []).forEach((v: { campaign_id: string; viewed_at: string; view_count: number | null }) => {
      viewMap.set(v.campaign_id, {
        lastViewed: new Date(v.viewed_at),
        viewCount: v.view_count || 1,
      });
    });
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    for (const c of campaigns as Campaign[]) {
      const viewData = viewMap.get(c.id);
      const lastViewed = viewData?.lastViewed;
      const viewCount = viewData?.viewCount || 0;

      // Check max views limit
      if (c.max_views != null && viewCount >= c.max_views) continue;
      // Check date range
      if (c.date_start && today < c.date_start) continue;
      if (c.date_end && today > c.date_end) continue;

      if (c.trigger_type === "first_login") {
        if (lastViewed) continue; // Already seen
        setCampaign(c);
        return;
      }

      if (c.trigger_type === "always") {
        // Show once per session — use sessionStorage
        if (sessionStorage.getItem(`campaign_${c.id}`)) continue;
        setCampaign(c);
        return;
      }

      if (c.trigger_type === "date_range") {
        if (lastViewed) continue; // Show once in the date range
        setCampaign(c);
        return;
      }

      if (c.trigger_type === "recurring_daily") {
        if (lastViewed && lastViewed.toDateString() === now.toDateString()) continue;
        setCampaign(c);
        return;
      }

      if (c.trigger_type === "recurring_weekly") {
        if (lastViewed) {
          const diff = (now.getTime() - lastViewed.getTime()) / (1000 * 60 * 60 * 24);
          if (diff < 7) continue;
        }
        setCampaign(c);
        return;
      }

      if (c.trigger_type === "recurring_monthly") {
        if (lastViewed) {
          const sameMonth = lastViewed.getMonth() === now.getMonth() && lastViewed.getFullYear() === now.getFullYear();
          if (sameMonth) continue;
        }
        setCampaign(c);
        return;
      }
    }
  };

  const dismiss = useCallback(async () => {
    if (!campaign || !user || dismissed) return;
    setDismissed(true);
    setPhase("fadeout");

    // Mark as viewed — increment view_count
    sessionStorage.setItem(`campaign_${campaign.id}`, "1");
    const { data: existing } = await supabase
      .from("campaign_views")
      .select("view_count")
      .eq("campaign_id", campaign.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const prev = existing as { view_count?: number | null };
      await supabase.from("campaign_views")
        .update({ viewed_at: new Date().toISOString(), view_count: (prev.view_count || 1) + 1 })
        .eq("campaign_id", campaign.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("campaign_views")
        .insert({ campaign_id: campaign.id, user_id: user.id, viewed_at: new Date().toISOString(), view_count: 1 });
    }

    setTimeout(() => setCampaign(null), 700);
  }, [campaign, user, dismissed]);

  useEffect(() => {
    if (!campaign) return;
    const t1 = setTimeout(() => setPhase("text"), 1200);
    const t2 = setTimeout(() => setPhase("fadeout"), (campaign.duration_seconds - 0.8) * 1000);
    const t3 = setTimeout(() => dismiss(), campaign.duration_seconds * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [campaign, dismiss]);

  if (!campaign) return null;

  const imgSrc = campaign.custom_image_url || campaign.logo_url || logoImg;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-700 ${
        phase === "fadeout" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      onClick={dismiss}
    >
      <div className="flex flex-col items-center gap-8 max-w-2xl px-8">
        <div
          className={`transition-all duration-1000 ease-out ${
            phase === "logo" ? "scale-110 opacity-100" : "scale-100 opacity-100"
          }`}
          style={{ animation: phase === "logo" ? "campaignLogoPulse 1.2s ease-in-out" : undefined }}
        >
          <img
            src={imgSrc}
            alt={campaign.title}
            className={campaign.custom_image_url ? "max-w-[300px] max-h-[200px] object-contain" : "w-48 h-auto object-contain drop-shadow-lg"}
          />
        </div>

        <div
          className={`text-center transition-all duration-1000 ease-out ${
            phase === "text" || phase === "fadeout" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >


        </div>

        <p
          className={`text-xs text-muted-foreground/50 transition-opacity duration-700 ${
            phase === "text" ? "opacity-100" : "opacity-0"
          }`}
        >
          Cliquez n'importe où pour continuer
        </p>
      </div>

      <style>{`
        @keyframes campaignLogoPulse {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default CampaignAnimationPlayer;
