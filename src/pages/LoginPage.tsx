import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const { signIn } = useAuth();
  const { toast }  = useToast();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* ── Fond pleine page ── */}
      <img
        src="/F12.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* ── Overlay sombre ── */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(0,10,40,0.72) 0%, rgba(0,27,97,0.68) 50%, rgba(0,0,0,0.78) 100%)" }}
      />

      {/* ── Blobs décoratifs ── */}
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] opacity-[0.12] pointer-events-none"
        style={{ background: "radial-gradient(circle, #FFAE03, transparent 65%)", borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%" }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] opacity-[0.10] pointer-events-none"
        style={{ background: "radial-gradient(circle, #FFAE03, transparent 65%)", borderRadius: "45% 55% 40% 60% / 60% 45% 55% 40%" }}
      />

      {/* ── Carte centrale ── */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full mx-4"
        style={{ maxWidth: "440px" }}
      >
        <div
          className="rounded-3xl px-10 py-10"
          style={{
            background:       "rgba(255, 255, 255, 0.07)",
            backdropFilter:   "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:           "1px solid rgba(255,255,255,0.15)",
            boxShadow:        "0 32px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
          }}
        >
          {/* Logo centré */}
          <div className="flex justify-center mb-6">
            <img
              src="/facam_stairway-blanc.png"
              alt="FACAM STAIRWAY"
              className="object-contain"
              style={{ height: "72px" }}
            />
          </div>

          {/* Titre */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl font-extrabold tracking-widest uppercase"
              style={{ color: "#ffffff", letterSpacing: "0.18em", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
            >
              Connexion
            </h1>
            <div className="mx-auto mt-3 w-10 h-[2px] rounded-full" style={{ backgroundColor: "#FFAE03" }} />
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Champ Email */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse email"
                required
                className="w-full h-12 pl-4 pr-12 rounded-xl text-sm outline-none transition-all"
                style={{
                  background:    "rgba(255,255,255,0.90)",
                  border:        "1.5px solid rgba(255,255,255,0.25)",
                  color:         "#1e293b",
                  caretColor:    "#001b61",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #1b48bb")}
                onBlur={(e)  => (e.currentTarget.style.border = "1.5px solid rgba(255,255,255,0.25)")}
              />
              <Mail
                className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#001b61" }}
              />
            </div>

            {/* Champ Mot de passe */}
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                required
                className="w-full h-12 pl-4 pr-12 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.90)",
                  border:     "1.5px solid rgba(255,255,255,0.25)",
                  color:      "#1e293b",
                  caretColor: "#001b61",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #1b48bb")}
                onBlur={(e)  => (e.currentTarget.style.border = "1.5px solid rgba(255,255,255,0.25)")}
              />
              <Lock
                className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "#001b61" }}
              />
            </div>

            {/* Mot de passe oublié */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: "rgba(255,255,255,0.65)" }}
                onClick={() => (window.location.href = "/reset-password")}
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Bouton connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-[1px] disabled:opacity-70"
              style={{
                background:  "#FFAE03",
                color:       "#001B61",
                boxShadow:   "0 4px 20px rgba(255,174,3,0.45)",
                border:      "none",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: "#ffffff30", borderTopColor: "#ffffff" }}
                  />
                  Connexion…
                </span>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Séparateur bas */}
          <div className="mt-8 pt-6 border-t border-white/10 flex justify-center">
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.30)" }}>
              © {new Date().getFullYear()} FACAM STAIRWAY
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
