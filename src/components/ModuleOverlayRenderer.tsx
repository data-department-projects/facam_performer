import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CustomTextBlock, CustomImageBlock, getImageContainerStyle, textStyleToCSS } from "@/components/loginDesignTypes";

interface ModuleOverlay {
  customTexts: CustomTextBlock[];
  customImages: CustomImageBlock[];
}

const ModuleOverlayRenderer = ({ moduleId }: { moduleId: string }) => {
  const [overlay, setOverlay] = useState<ModuleOverlay | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_organization")
        .select("data")
        .eq("id", `module_overlay_${moduleId}`)
        .maybeSingle();
      if (data?.data) {
        const parsed = data.data as unknown as ModuleOverlay;
        if (parsed.customTexts?.length || parsed.customImages?.length) {
          setOverlay(parsed);
        } else {
          setOverlay(null);
        }
      } else {
        setOverlay(null);
      }
    };
    load();
  }, [moduleId]);

  if (!overlay) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {overlay.customImages?.map((img) => (
        <div
          key={img.id}
          className="absolute"
          style={{
            left: `${img.position.x}%`,
            top: `${img.position.y}%`,
          }}
        >
          <div style={getImageContainerStyle(img.settings, 120, 1)} className="overflow-hidden">
            <img
              src={img.url}
              alt=""
              className="w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: `${img.settings.objectPositionX}% ${img.settings.objectPositionY}%`,
              }}
            />
          </div>
        </div>
      ))}
      {overlay.customTexts?.map((txt) => (
        <div
          key={txt.id}
          className="absolute"
          style={{
            left: `${txt.position.x}%`,
            top: `${txt.position.y}%`,
            ...textStyleToCSS(txt.style),
          }}
        >
          {txt.text}
        </div>
      ))}
    </div>
  );
};

export default ModuleOverlayRenderer;
