import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// All source files to include in the export
const SOURCE_FILES: Record<string, () => Promise<string>> = {};

// We'll use import.meta.glob to dynamically import all source files
const modules = import.meta.glob(
  [
    "/src/**/*.{ts,tsx,css}",
    "/supabase/functions/**/*.ts",
    "!**/node_modules/**",
    "!**/integrations/supabase/types.ts",
  ],
  { query: "?raw", import: "default" }
);

const rootFiles = import.meta.glob(
  [
    "/index.html",
    "/tailwind.config.ts",
    "/vite.config.ts",
    "/package.json",
    "/tsconfig.json",
    "/tsconfig.app.json",
    "/postcss.config.js",
    "/components.json",
  ],
  { query: "?raw", import: "default" }
);

async function generateWordDocument() {
  const allModules = { ...rootFiles, ...modules };
  const entries: { path: string; content: string }[] = [];

  for (const [path, loader] of Object.entries(allModules)) {
    try {
      const content = (await loader()) as string;
      entries.push({ path: path.replace(/^\//, ""), content });
    } catch {
      // skip unreadable files
    }
  }

  // Sort by path
  entries.sort((a, b) => a.path.localeCompare(b.path));

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Export du Code Source — PerformX",
          bold: true,
          size: 36,
          font: "Calibri",
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    })
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
          italics: true,
          size: 20,
          color: "666666",
          font: "Calibri",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Table of contents
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Sommaire (${entries.length} fichiers)`,
          bold: true,
          size: 28,
          font: "Calibri",
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  entries.forEach((entry, i) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${i + 1}. ${entry.path}`,
            size: 18,
            font: "Calibri",
          }),
        ],
        spacing: { after: 40 },
      })
    );
  });

  // Separator
  children.push(
    new Paragraph({
      children: [],
      spacing: { after: 400 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
      },
    })
  );

  // Each file
  entries.forEach((entry) => {
    // File header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `📄 ${entry.path}`,
            bold: true,
            size: 24,
            font: "Calibri",
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 3, color: "DDDDDD" },
        },
      })
    );

    // Code content - split into lines
    const lines = entry.content.split("\n");
    lines.forEach((line, lineIdx) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${String(lineIdx + 1).padStart(4, " ")} │ `,
              size: 16,
              font: "Consolas",
              color: "999999",
            }),
            new TextRun({
              text: line || " ",
              size: 16,
              font: "Consolas",
            }),
          ],
          spacing: { after: 0, line: 260 },
        })
      );
    });

    // Separator after file
    children.push(
      new Paragraph({
        children: [],
        spacing: { after: 200 },
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `code_source_performx_${new Date().toISOString().slice(0, 10)}.docx`);
}

const ExportCodeToWord = () => {
  const { toast } = useToast();

  const handleExport = async () => {
    toast({ title: "Génération en cours...", description: "Veuillez patienter quelques secondes." });
    try {
      await generateWordDocument();
      toast({ title: "Export Word terminé ✓", description: "Le fichier a été téléchargé." });
    } catch (err) {
      console.error(err);
      toast({ title: "Erreur", description: "Impossible de générer le document.", variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
      <FileText className="w-3.5 h-3.5" /> Exporter le code en Word
    </Button>
  );
};

export default ExportCodeToWord;
