import { jsPDF } from 'jspdf';
import { SpeechAnalysisResult, ArgumentNode, ImprovedArgumentNode } from '../types';

interface ExportOptions {
  videoTitle: string;
  topicText: string;
  date: string;
  targetLang: string;
  level: string;
}

export function exportPracticeReportToPdf(
  analysis: SpeechAnalysisResult,
  options: ExportOptions
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Helper to add wrapped text and return new Y position
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 6): number => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  };

  // Helper to check if we need a new page
  const checkPageBreak = (requiredSpace: number): void => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Helper to draw a rounded rectangle box
  const drawBox = (x: number, y: number, width: number, height: number, fillColor: [number, number, number], borderColor: [number, number, number]) => {
    doc.setFillColor(...fillColor);
    doc.setDrawColor(...borderColor);
    doc.roundedRect(x, y, width, height, 2, 2, 'FD');
  };

  // Helper to get status color
  const getStatusColor = (status: string): [number, number, number] => {
    switch (status) {
      case 'strong': return [34, 139, 34]; // Green
      case 'weak': return [204, 136, 0]; // Amber
      case 'missing': return [180, 0, 0]; // Red
      default: return [100, 100, 100]; // Gray
    }
  };

  // Helper to get type label
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'fact': return '[Fact]';
      case 'story': return '[Story]';
      case 'opinion': return '[Opinion]';
      default: return '';
    }
  };

  // Helper to draw user's structure (My Logic)
  const drawUserStructure = () => {
    if (!analysis.structure?.conclusion || !analysis.structure?.arguments) return;

    checkPageBreak(60);

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('My Logic (Detected Structure)', margin, yPos);
    yPos += 12;

    // Conclusion box at top (pyramid peak)
    const conclusionBoxWidth = contentWidth * 0.7;
    const conclusionBoxX = margin + (contentWidth - conclusionBoxWidth) / 2;
    const boxPadding = 8;

    doc.setFontSize(9);
    const conclusionLines = doc.splitTextToSize(analysis.structure.conclusion, conclusionBoxWidth - boxPadding * 2);
    const conclusionBoxHeight = 8 + conclusionLines.length * 5 + boxPadding;

    checkPageBreak(conclusionBoxHeight + 15);
    drawBox(conclusionBoxX, yPos, conclusionBoxWidth, conclusionBoxHeight, [230, 230, 250], [100, 100, 180]);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 120);
    doc.text('Main Point', conclusionBoxX + boxPadding, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(conclusionLines, conclusionBoxX + boxPadding, yPos + 12);
    yPos += conclusionBoxHeight + 10;

    // Arguments (supporting points) - render vertically, one per row
    const args = analysis.structure.arguments;
    if (args.length > 0) {
      const argBoxWidth = contentWidth * 0.85;
      const argBoxX = margin + (contentWidth - argBoxWidth) / 2;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        const statusColor = getStatusColor(arg.status);
        const typeLabel = getTypeLabel(arg.type);
        const pointText = `${typeLabel} ${arg.point}`.trim();

        doc.setFontSize(9);
        const pointLines = doc.splitTextToSize(pointText, argBoxWidth - boxPadding * 2);

        // Calculate evidence lines if any
        let evidenceLines: string[] = [];
        if (arg.evidence && arg.evidence.length > 0) {
          doc.setFontSize(8);
          const evidenceText = `Evidence: ${arg.evidence.slice(0, 2).join('; ')}`;
          evidenceLines = doc.splitTextToSize(evidenceText, argBoxWidth - boxPadding * 2);
        }

        // Calculate total box height: status label + point text + evidence + padding
        const statusHeight = 6;
        const pointHeight = pointLines.length * 5;
        const evidenceHeight = evidenceLines.length > 0 ? evidenceLines.length * 4 + 4 : 0;
        const argBoxHeight = statusHeight + pointHeight + evidenceHeight + boxPadding * 2;

        checkPageBreak(argBoxHeight + 8);

        // Status indicator color for background
        const bgColor: [number, number, number] = arg.status === 'strong' ? [235, 250, 235] :
                        arg.status === 'weak' ? [255, 248, 230] : [255, 240, 240];

        drawBox(argBoxX, yPos, argBoxWidth, argBoxHeight, bgColor, statusColor);

        // Status label
        let textY = yPos + boxPadding;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...statusColor);
        doc.text(arg.status.toUpperCase(), argBoxX + boxPadding, textY);
        textY += statusHeight;

        // Point text
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text(pointLines, argBoxX + boxPadding, textY);
        textY += pointHeight;

        // Evidence (inside the box)
        if (evidenceLines.length > 0) {
          textY += 3;
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.setFont('helvetica', 'italic');
          doc.text(evidenceLines, argBoxX + boxPadding, textY);
        }

        yPos += argBoxHeight + 6;
      }
    }
    yPos += 8;
  };

  // Helper to draw AI improved structure
  const drawImprovedStructure = () => {
    if (!analysis.improved_structure?.conclusion || !analysis.improved_structure?.arguments) return;

    checkPageBreak(60);

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('AI Improved Structure', margin, yPos);
    yPos += 12;

    // Conclusion box at top
    const conclusionBoxWidth = contentWidth * 0.7;
    const conclusionBoxX = margin + (contentWidth - conclusionBoxWidth) / 2;
    const boxPadding = 8;

    doc.setFontSize(9);
    const conclusionLines = doc.splitTextToSize(analysis.improved_structure.conclusion, conclusionBoxWidth - boxPadding * 2);
    const conclusionBoxHeight = 8 + conclusionLines.length * 5 + boxPadding;

    checkPageBreak(conclusionBoxHeight + 15);
    drawBox(conclusionBoxX, yPos, conclusionBoxWidth, conclusionBoxHeight, [220, 245, 220], [34, 139, 34]);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 100, 34);
    doc.text('Improved Main Point', conclusionBoxX + boxPadding, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    doc.text(conclusionLines, conclusionBoxX + boxPadding, yPos + 12);
    yPos += conclusionBoxHeight + 10;

    // Improved arguments - render vertically, one per row
    const args = analysis.improved_structure.arguments;
    if (args.length > 0) {
      const argBoxWidth = contentWidth * 0.85;
      const argBoxX = margin + (contentWidth - argBoxWidth) / 2;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        const typeLabel = getTypeLabel(arg.type);
        const headlineText = `${typeLabel} ${arg.headline}`.trim();

        doc.setFontSize(9);
        const headlineLines = doc.splitTextToSize(headlineText, argBoxWidth - boxPadding * 2);

        // Calculate elaboration lines
        let elaborationLines: string[] = [];
        if (arg.elaboration) {
          doc.setFontSize(8);
          elaborationLines = doc.splitTextToSize(arg.elaboration, argBoxWidth - boxPadding * 2);
        }

        // Calculate total box height
        const headlineHeight = headlineLines.length * 5;
        const elaborationHeight = elaborationLines.length > 0 ? elaborationLines.length * 4 + 4 : 0;
        const argBoxHeight = headlineHeight + elaborationHeight + boxPadding * 2;

        checkPageBreak(argBoxHeight + 8);

        drawBox(argBoxX, yPos, argBoxWidth, argBoxHeight, [220, 245, 220], [34, 139, 34]);

        // Headline
        let textY = yPos + boxPadding;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 100, 34);
        doc.text(headlineLines, argBoxX + boxPadding, textY);
        textY += headlineHeight;

        // Elaboration (inside the box)
        if (elaborationLines.length > 0) {
          textY += 3;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60);
          doc.text(elaborationLines, argBoxX + boxPadding, textY);
        }

        yPos += argBoxHeight + 6;
      }
    }
    yPos += 8;
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Practice Report', margin, yPos);
  yPos += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Video: ${options.videoTitle}`, margin, yPos);
  yPos += 5;
  doc.text(`Topic: ${options.topicText}`, margin, yPos);
  yPos += 5;
  doc.text(`${options.targetLang} | ${options.level} | ${options.date}`, margin, yPos);
  yPos += 12;
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Transcription
  if (analysis.transcription) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Your Response', margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos = addWrappedText(analysis.transcription, margin, yPos, contentWidth);
    yPos += 15;
  }

  // Draw user's detected structure (My Logic graph)
  drawUserStructure();

  // Draw AI improved structure graph
  drawImprovedStructure();

  // Strengths
  if (analysis.feedback?.strengths && analysis.feedback.strengths.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 139, 34); // Green
    doc.text('Strengths', margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);

    for (const strength of analysis.feedback.strengths) {
      checkPageBreak(15);
      yPos = addWrappedText(`• ${strength}`, margin + 3, yPos, contentWidth - 6);
      yPos += 2;
    }
    yPos += 8;
  }

  // Areas for Improvement
  if (analysis.feedback?.weaknesses && analysis.feedback.weaknesses.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(204, 136, 0); // Amber
    doc.text('Areas for Improvement', margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);

    for (const weakness of analysis.feedback.weaknesses) {
      checkPageBreak(15);
      yPos = addWrappedText(`• ${weakness}`, margin + 3, yPos, contentWidth - 6);
      yPos += 2;
    }
    yPos += 8;
  }

  // Actionable Tips
  if (analysis.feedback?.suggestions && analysis.feedback.suggestions.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Actionable Tips', margin, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    for (const tip of analysis.feedback.suggestions) {
      checkPageBreak(15);
      yPos = addWrappedText(`• ${tip}`, margin + 3, yPos, contentWidth - 6);
      yPos += 2;
    }
    yPos += 8;
  }

  // Language Improvements
  if (analysis.improvements && analysis.improvements.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Language Polish & Alternatives', margin, yPos);
    yPos += 10;

    for (const imp of analysis.improvements) {
      checkPageBreak(35);

      // Original
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 0, 0);
      doc.text('Original:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      yPos = addWrappedText(`"${imp.original}"`, margin + 20, yPos, contentWidth - 20, 5);
      yPos += 3;

      // Improved
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 128, 0);
      doc.text('Better:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      yPos = addWrappedText(`"${imp.improved}"`, margin + 20, yPos, contentWidth - 20, 5);
      yPos += 3;

      // Explanation
      doc.setTextColor(100);
      doc.setFontSize(8);
      yPos = addWrappedText(imp.explanation, margin, yPos, contentWidth, 4);
      doc.setTextColor(0);
      yPos += 8;
    }
  }

  // Footer
  checkPageBreak(20);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Generated by Bilibala', margin, doc.internal.pageSize.getHeight() - 10);

  // Save the PDF
  const fileName = `practice-report-${options.date.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
  doc.save(fileName);
}
