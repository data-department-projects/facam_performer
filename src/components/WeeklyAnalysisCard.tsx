import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface ProjectAnalysisData {
  name: string;
  totalHours: number;
  humanCost: number;
  expenses: number;
  totalCost: number;
  collaborators: {
    name: string;
    hours: number;
    hourlyRate: number | null;
    cost: number | null;
  }[];
  milestones: {
    title: string;
    status: string;
    deadline?: string;
    deliverables: { submittedAt: string; link: string }[];
  }[];
  expenseDetails: {
    description: string;
    amount: number;
    date: string;
    createdBy: string;
  }[];
}

interface WeeklyAnalysisCardProps {
  projectData: ProjectAnalysisData[];
}

const CHAT_URL = "/api/weekly-analysis";

const WeeklyAnalysisCard = ({ projectData }: WeeklyAnalysisCardProps) => {
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateAnalysis = useCallback(async () => {
    setIsLoading(true);
    setAnalysis("");

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectData }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur inconnue" }));
        toast({ title: "Erreur", description: err.error || `Erreur ${resp.status}`, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setAnalysis(fullText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setAnalysis(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("Analysis error:", e);
      toast({ title: "Erreur", description: "Impossible de générer l'analyse.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [projectData, toast]);

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Analyse hebdomadaire IA
          </CardTitle>
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1.5"
            onClick={generateAnalysis}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Analyse en cours...
              </>
            ) : analysis ? (
              <>
                <RefreshCw className="w-3 h-3" /> Actualiser
              </>
            ) : (
              <>
                <Brain className="w-3 h-3" /> Générer l'analyse
              </>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Analyse IA des performances projets, collaborateurs, coûts et délais de livraison.
        </p>
      </CardHeader>
      <CardContent>
        {!analysis && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Brain className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Cliquez sur « Générer l'analyse » pour obtenir un rapport IA hebdomadaire.
            </p>
          </div>
        )}
        {(analysis || isLoading) && (
          <div className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed">
            <ReactMarkdown>{analysis || "⏳ Génération de l'analyse en cours..."}</ReactMarkdown>
            {isLoading && (
              <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px]">L'IA analyse vos données...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAnalysisCard;
