import { useState, useEffect } from "react";
import logoImg from "@/assets/facam-performer-logo.png";

interface WelcomeAnimationProps {
  onComplete: () => void;
}

const WelcomeAnimation = ({ onComplete }: WelcomeAnimationProps) => {
  const [phase, setPhase] = useState<"logo" | "text" | "fadeout">("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"), 1200);
    const t2 = setTimeout(() => setPhase("fadeout"), 5500);
    const t3 = setTimeout(() => onComplete(), 6300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-700 ${phase === "fadeout" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      onClick={onComplete}
    >
      <div className="flex flex-col items-center gap-8 max-w-2xl px-8">
        {/* Logo */}
        <div
          className={`transition-all duration-1000 ease-out ${
            phase === "logo"
              ? "scale-110 opacity-100"
              : "scale-100 opacity-100"
          }`}
          style={{
            animation: phase === "logo" ? "welcomeLogoPulse 1.2s ease-in-out" : undefined,
          }}
        >
          <img
            src={logoImg}
            alt="FACAM PERFORMER"
            className="w-48 h-auto object-contain drop-shadow-lg"
          />
        </div>

        {/* Text */}
        <div
          className={`text-center transition-all duration-1000 ease-out ${
            phase === "text" || phase === "fadeout"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Avec FACAM PERFORMER, prenez enfin le contrôle de vos missions.
            Visualisez vos réalisations, mettez en lumière votre valeur ajoutée
            et avancez vers vos objectifs avec une clarté totale. Chaque
            fonctionnalité a été conçue pour vous. Pour simplifier, collaborer,
            et performer. Parce que votre succès, c'est notre raison d'être.
          </p>
        </div>

        {/* Skip hint */}
        <p
          className={`text-xs text-muted-foreground/50 transition-opacity duration-700 ${
            phase === "text" ? "opacity-100" : "opacity-0"
          }`}
        >
          Cliquez n'importe où pour continuer
        </p>
      </div>

      <style>{`
        @keyframes welcomeLogoPulse {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default WelcomeAnimation;
