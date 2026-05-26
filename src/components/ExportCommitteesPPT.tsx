import PptxGenJS from "pptxgenjs";
import { Committee, frequencyLabels } from "@/data/committees";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

interface Props {
  committees: Committee[];
  getDeptName: (id: string) => string;
  profileMap: Record<string, string>;
}

const COLORS = {
  primary: "1B4F72",
  primaryLight: "2E86C1",
  accent: "E74C3C",
  dark: "2C3E50",
  gray: "7F8C8D",
  lightGray: "ECF0F1",
  white: "FFFFFF",
  green: "27AE60",
  orange: "E67E22",
};

const exportCommitteesPPT = ({ committees, getDeptName, profileMap }: Props) => {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "FACAM Strategic Roadmap";
  pptx.title = "Comités de Gouvernance";

  // ── Slide 1: Cover ──
  const cover = pptx.addSlide();
  cover.background = { fill: COLORS.primary };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.8, w: 13.33, h: 1.7,
    fill: { color: COLORS.primaryLight, transparency: 40 },
  });
  cover.addText("COMITÉS DE GOUVERNANCE", {
    x: 0.8, y: 1.8, w: 11.7, h: 1.2,
    fontSize: 36, fontFace: "Arial", bold: true,
    color: COLORS.white, align: "left",
  });
  cover.addText("Instances de coordination et de pilotage", {
    x: 0.8, y: 3.0, w: 11.7, h: 0.6,
    fontSize: 18, fontFace: "Arial",
    color: COLORS.lightGray, align: "left",
  });
  cover.addText(`${committees.length} comités`, {
    x: 0.8, y: 3.8, w: 3, h: 0.5,
    fontSize: 14, fontFace: "Arial",
    color: COLORS.white, align: "left",
  });
  const totalMembers = committees.reduce((s, c) => s + c.members.length, 0);
  cover.addText(`${totalMembers} participants`, {
    x: 3.8, y: 3.8, w: 3, h: 0.5,
    fontSize: 14, fontFace: "Arial",
    color: COLORS.white, align: "left",
  });
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  cover.addText(today, {
    x: 0.8, y: 6.2, w: 5, h: 0.4,
    fontSize: 12, fontFace: "Arial",
    color: COLORS.lightGray, align: "left",
  });

  // ── Slide 2: Sommaire ──
  const toc = pptx.addSlide();
  toc.background = { fill: COLORS.white };
  addHeader(toc, "SOMMAIRE", pptx);
  committees.forEach((c, i) => {
    const yPos = 1.6 + i * 0.5;
    if (yPos > 6.5) return;
    toc.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: yPos, w: 0.35, h: 0.35,
      fill: { color: COLORS.primary }, rectRadius: 0.05,
    });
    toc.addText(`${i + 1}`, {
      x: 0.8, y: yPos, w: 0.35, h: 0.35,
      fontSize: 11, fontFace: "Arial", bold: true,
      color: COLORS.white, align: "center", valign: "middle",
    });
    toc.addText(c.name, {
      x: 1.3, y: yPos, w: 7, h: 0.35,
      fontSize: 13, fontFace: "Arial", color: COLORS.dark, align: "left", valign: "middle",
    });
    toc.addText(frequencyLabels[c.frequency], {
      x: 9, y: yPos, w: 2, h: 0.35,
      fontSize: 11, fontFace: "Arial", color: COLORS.gray, align: "left", valign: "middle",
    });
    toc.addText(`${c.members.length} participants`, {
      x: 11, y: yPos, w: 2, h: 0.35,
      fontSize: 11, fontFace: "Arial", color: COLORS.primaryLight, align: "left", valign: "middle",
    });
  });

  // ── Slides per committee ──
  committees.forEach((c) => {
    const slide = pptx.addSlide();
    slide.background = { fill: COLORS.white };
    addHeader(slide, c.name.toUpperCase(), pptx);

    // Left column: Info
    const leftX = 0.8;

    // Responsible
    if (c.responsible) {
      slide.addText("RESPONSABLE", {
        x: leftX, y: 1.5, w: 5.5, h: 0.3,
        fontSize: 9, fontFace: "Arial", bold: true, color: COLORS.gray,
      });
      slide.addText(c.responsible, {
        x: leftX, y: 1.8, w: 5.5, h: 0.35,
        fontSize: 12, fontFace: "Arial", bold: true, color: COLORS.primary,
      });
    }

    // Frequency
    slide.addShape(pptx.ShapeType.roundRect, {
      x: leftX, y: 2.3, w: 1.8, h: 0.35,
      fill: { color: COLORS.lightGray }, rectRadius: 0.05,
    });
    slide.addText(`⏱ ${frequencyLabels[c.frequency]}`, {
      x: leftX, y: 2.3, w: 1.8, h: 0.35,
      fontSize: 10, fontFace: "Arial", color: COLORS.dark, align: "center", valign: "middle",
    });

    // Members count badge
    slide.addShape(pptx.ShapeType.roundRect, {
      x: leftX + 2, y: 2.3, w: 2, h: 0.35,
      fill: { color: COLORS.lightGray }, rectRadius: 0.05,
    });
    slide.addText(`👥 ${c.members.length} participant${c.members.length > 1 ? "s" : ""}`, {
      x: leftX + 2, y: 2.3, w: 2, h: 0.35,
      fontSize: 10, fontFace: "Arial", color: COLORS.dark, align: "center", valign: "middle",
    });

    // Institutions
    if ((c.institutions || []).length > 0) {
      slide.addText("INSTITUTIONS BANCAIRES", {
        x: leftX, y: 2.85, w: 5.5, h: 0.25,
        fontSize: 9, fontFace: "Arial", bold: true, color: COLORS.accent,
      });
      slide.addText((c.institutions || []).join(" · "), {
        x: leftX, y: 3.1, w: 5.5, h: 0.3,
        fontSize: 10, fontFace: "Arial", color: COLORS.dark,
      });
    }

    // Purpose / Mission
    const purposeY = (c.institutions || []).length > 0 ? 3.55 : 2.85;
    if (c.purpose) {
      slide.addText("OBJECTIF / MISSION", {
        x: leftX, y: purposeY, w: 5.5, h: 0.25,
        fontSize: 9, fontFace: "Arial", bold: true, color: COLORS.gray,
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: leftX, y: purposeY + 0.3, w: 5.5, h: Math.min(2.5, 0.3 + c.purpose.length * 0.003),
        fill: { color: "F8F9FA" }, rectRadius: 0.08,
        line: { color: COLORS.lightGray, width: 0.5 },
      });
      slide.addText(c.purpose, {
        x: leftX + 0.15, y: purposeY + 0.35, w: 5.2, h: Math.min(2.3, 0.25 + c.purpose.length * 0.003),
        fontSize: 10, fontFace: "Arial", color: COLORS.dark,
        lineSpacingMultiple: 1.3, valign: "top",
      });
    }

    // Linked departments
    if (c.linkedDepartmentIds.length > 0) {
      const deptY = purposeY + Math.min(2.8, 0.6 + (c.purpose?.length || 0) * 0.003) + 0.3;
      if (deptY < 6.5) {
        slide.addText("DÉPARTEMENTS RATTACHÉS", {
          x: leftX, y: deptY, w: 5.5, h: 0.25,
          fontSize: 9, fontFace: "Arial", bold: true, color: COLORS.gray,
        });
        c.linkedDepartmentIds.forEach((id, i) => {
          const chipY = deptY + 0.3 + Math.floor(i / 3) * 0.35;
          const chipX = leftX + (i % 3) * 1.9;
          if (chipY < 6.8) {
            slide.addShape(pptx.ShapeType.roundRect, {
              x: chipX, y: chipY, w: 1.8, h: 0.3,
              fill: { color: "EBF5FB" }, rectRadius: 0.05,
            });
            const deptLabel = getDeptName(id).replace(/[^\w\s\-àâäéèêëïîôùûüÿçæœ]/gi, "").trim();
            slide.addText(deptLabel, {
              x: chipX, y: chipY, w: 1.8, h: 0.3,
              fontSize: 8, fontFace: "Arial", color: COLORS.primary, align: "center", valign: "middle",
            });
          }
        });
      }
    }

    // Right column: Members table
    const rightX = 7;
    slide.addShape(pptx.ShapeType.rect, {
      x: rightX - 0.2, y: 1.4, w: 6.3, h: 0.05,
      fill: { color: COLORS.primary },
    });

    if (c.members.length > 0) {
      slide.addText("PARTICIPANTS", {
        x: rightX, y: 1.55, w: 5.5, h: 0.3,
        fontSize: 10, fontFace: "Arial", bold: true, color: COLORS.dark,
      });

      const tableRows: PptxGenJS.TableRow[] = [
        [
          { text: "Nom", options: { fontSize: 9, bold: true, fontFace: "Arial", color: COLORS.white, fill: { color: COLORS.primary }, align: "left", valign: "middle" } },
          { text: "Rôle", options: { fontSize: 9, bold: true, fontFace: "Arial", color: COLORS.white, fill: { color: COLORS.primary }, align: "left", valign: "middle" } },
        ],
      ];
      c.members.forEach((m) => {
        tableRows.push([
          { text: m.name, options: { fontSize: 9, fontFace: "Arial", color: COLORS.dark, align: "left", valign: "middle" } },
          { text: m.role, options: { fontSize: 9, fontFace: "Arial", color: COLORS.gray, align: "left", valign: "middle" } },
        ]);
      });

      slide.addTable(tableRows, {
        x: rightX, y: 1.9, w: 5.8,
        colW: [3, 2.8],
        rowH: 0.32,
        border: { type: "solid", pt: 0.5, color: COLORS.lightGray },
        autoPage: false,
      });
    }

    // Guests
    const guests = c.guests || [];
    if (guests.length > 0) {
      const guestY = 2.1 + (c.members.length + 1) * 0.32 + 0.3;
      if (guestY < 6.2) {
        slide.addText("INVITÉS", {
          x: rightX, y: guestY, w: 5.5, h: 0.3,
          fontSize: 10, fontFace: "Arial", bold: true, color: COLORS.dark,
        });
        guests.forEach((g, i) => {
          const isExternal = g.startsWith("ext:");
          const name = isExternal ? g.slice(4) : (profileMap[g] || g);
          const gy = guestY + 0.35 + i * 0.3;
          if (gy < 7) {
            slide.addText(`${name}${isExternal ? " (ext.)" : ""}`, {
              x: rightX + 0.2, y: gy, w: 5, h: 0.25,
              fontSize: 9, fontFace: "Arial",
              color: isExternal ? COLORS.orange : COLORS.dark,
            });
          }
        });
      }
    }

    // Footer
    addFooter(slide, c.name);
  });

  pptx.writeFile({ fileName: "Comites_Gouvernance.pptx" });
};

function addHeader(slide: PptxGenJS.Slide, title: string, pptx: PptxGenJS) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 1.2,
    fill: { color: COLORS.primary },
  });
  slide.addText(title, {
    x: 0.8, y: 0.25, w: 11, h: 0.7,
    fontSize: 22, fontFace: "Arial", bold: true,
    color: COLORS.white, align: "left", valign: "middle",
  });
}

function addFooter(slide: PptxGenJS.Slide, text: string) {
  slide.addText(`FACAM — ${text}`, {
    x: 0.8, y: 7.05, w: 8, h: 0.3,
    fontSize: 8, fontFace: "Arial", color: COLORS.gray,
  });
}

const ExportCommitteesPPTButton = (props: Props) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
      onClick={() => exportCommitteesPPT(props)}
    >
      <FileDown className="w-3.5 h-3.5" /> Export PPT
    </Button>
  );
};

export default ExportCommitteesPPTButton;
