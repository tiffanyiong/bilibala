import dagre from 'dagre';
import { jsPDF } from 'jspdf';
import { SpeechAnalysisResult } from '../types';

interface ExportOptions {
  videoTitle: string;
  topicText: string;
  questionText?: string;
  date: string;
  targetLang: string;
  nativeLang: string;
  level: string;
}

// Sequential frameworks that use chain layout (root → arg1 → arg2 → ...)
const SEQUENTIAL_FRAMEWORKS = ['STAR', 'PREP', 'GOLDEN_CIRCLE', 'WSN'];

// Translations for PDF headings - used for medium/hard levels
const HEADING_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Chinese (Mandarin - 中文)': {
    'Practice Report': '练习报告',
    'Topic': '主题',
    'Question': '问题',
    'Source': '来源',
    'Your Response': '你的回答',
    'Language Polish': '语言润色',
    'Before': '修改前',
    'After': '修改后',
    'Pronunciation & Intonation': '发音与语调',
    'Overall': '总体',
    'Intonation': '语调',
    'Words to Practice': '需要练习的词汇',
    'Strengths': '优点',
    'Areas for Improvement': '改进空间',
    'Actionable Tips': '实用建议',
    'Your Logic Structure': '你的逻辑结构',
    'Improved Structure': '改进后的结构',
  },
  'Japanese (日本語)': {
    'Practice Report': '練習レポート',
    'Topic': 'トピック',
    'Question': '質問',
    'Source': '出典',
    'Your Response': 'あなたの回答',
    'Language Polish': '言語の改善',
    'Before': '修正前',
    'After': '修正後',
    'Pronunciation & Intonation': '発音とイントネーション',
    'Overall': '総合',
    'Intonation': 'イントネーション',
    'Words to Practice': '練習する単語',
    'Strengths': '強み',
    'Areas for Improvement': '改善点',
    'Actionable Tips': '実践的なヒント',
    'Your Logic Structure': 'あなたの論理構造',
    'Improved Structure': '改善された構造',
  },
  'Korean (한국어)': {
    'Practice Report': '연습 보고서',
    'Topic': '주제',
    'Question': '질문',
    'Source': '출처',
    'Your Response': '당신의 답변',
    'Language Polish': '언어 교정',
    'Before': '수정 전',
    'After': '수정 후',
    'Pronunciation & Intonation': '발음과 억양',
    'Overall': '전체',
    'Intonation': '억양',
    'Words to Practice': '연습할 단어',
    'Strengths': '강점',
    'Areas for Improvement': '개선할 부분',
    'Actionable Tips': '실용적인 팁',
    'Your Logic Structure': '당신의 논리 구조',
    'Improved Structure': '개선된 구조',
  },
  'Spanish (Español)': {
    'Practice Report': 'Informe de Práctica',
    'Topic': 'Tema',
    'Question': 'Pregunta',
    'Source': 'Fuente',
    'Your Response': 'Tu Respuesta',
    'Language Polish': 'Mejora del Lenguaje',
    'Before': 'Antes',
    'After': 'Después',
    'Pronunciation & Intonation': 'Pronunciación y Entonación',
    'Overall': 'General',
    'Intonation': 'Entonación',
    'Words to Practice': 'Palabras para Practicar',
    'Strengths': 'Fortalezas',
    'Areas for Improvement': 'Áreas de Mejora',
    'Actionable Tips': 'Consejos Prácticos',
    'Your Logic Structure': 'Tu Estructura Lógica',
    'Improved Structure': 'Estructura Mejorada',
  },
  'French (Français)': {
    'Practice Report': 'Rapport de Pratique',
    'Topic': 'Sujet',
    'Question': 'Question',
    'Source': 'Source',
    'Your Response': 'Votre Réponse',
    'Language Polish': 'Amélioration Linguistique',
    'Before': 'Avant',
    'After': 'Après',
    'Pronunciation & Intonation': 'Prononciation et Intonation',
    'Overall': 'Global',
    'Intonation': 'Intonation',
    'Words to Practice': 'Mots à Pratiquer',
    'Strengths': 'Points Forts',
    'Areas for Improvement': 'Points à Améliorer',
    'Actionable Tips': 'Conseils Pratiques',
    'Your Logic Structure': 'Votre Structure Logique',
    'Improved Structure': 'Structure Améliorée',
  },
  'German (Deutsch)': {
    'Practice Report': 'Übungsbericht',
    'Topic': 'Thema',
    'Question': 'Frage',
    'Source': 'Quelle',
    'Your Response': 'Ihre Antwort',
    'Language Polish': 'Sprachliche Verbesserung',
    'Before': 'Vorher',
    'After': 'Nachher',
    'Pronunciation & Intonation': 'Aussprache und Intonation',
    'Overall': 'Gesamt',
    'Intonation': 'Intonation',
    'Words to Practice': 'Wörter zum Üben',
    'Strengths': 'Stärken',
    'Areas for Improvement': 'Verbesserungsbereiche',
    'Actionable Tips': 'Praktische Tipps',
    'Your Logic Structure': 'Ihre Logikstruktur',
    'Improved Structure': 'Verbesserte Struktur',
  },
};

// Get translated heading based on level, target language, and native language
const getHeading = (key: string, level: string, targetLang: string, nativeLang: string): string => {
  // Easy level uses native language
  if (level.toLowerCase() === 'easy') {
    const nativeTranslations = HEADING_TRANSLATIONS[nativeLang];
    if (nativeTranslations && nativeTranslations[key]) {
      return nativeTranslations[key];
    }
    return key; // Fallback to English if no translation
  }
  // Medium and Hard levels use target language
  const translations = HEADING_TRANSLATIONS[targetLang];
  if (translations && translations[key]) {
    return translations[key];
  }
  return key;
};

interface GraphNode {
  id: string;
  label: string;
  type?: string;
  status?: string;
  elaboration?: string;
  isRoot?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GraphEdge {
  source: string;
  target: string;
  animated?: boolean;
}

// Check if text contains CJK characters
const containsCJK = (text: string): boolean => {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/u.test(text);
};

// Convert ArrayBuffer to base64 safely (handles large files)
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);

  // For smaller files, use simple approach
  if (bytes.length < 100000) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // For larger files (like CJK fonts), use chunked approach
  const chunkSize = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  return btoa(chunks.join(''));
};

// Load Chinese font dynamically
const loadChineseFont = async (doc: jsPDF): Promise<boolean> => {
  // Try multiple font sources - local file first (most reliable)
  const fontSources = [
    // Noto Sans SC - Google's official Chinese font, best compatibility with jsPDF
    {
      url: '/fonts/NotoSansSC-Regular.ttf',
      ext: 'ttf',
    },
    // Fallback: LXGW WenKai font
    {
      url: '/fonts/LXGWWenKai-Regular.ttf',
      ext: 'ttf',
    },
    // CDN fallback - Noto Sans SC from Google Fonts
    {
      url: 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf',
      ext: 'ttf',
    },
  ];

  for (const { url, ext } of fontSources) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength < 100000) continue;

      const base64 = arrayBufferToBase64(arrayBuffer);
      const fileName = `ChineseFont.${ext}`;

      doc.addFileToVFS(fileName, base64);
      doc.addFont(fileName, 'ChineseFont', 'normal', 'normal');

      const fonts = doc.getFontList();
      if (fonts['ChineseFont']) {
        doc.setFont('ChineseFont', 'normal');
        doc.getTextWidth('测试'); // Verify font works
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
};

// Convert duck SVG to base64 PNG for PDF embedding
const getDuckLogoBase64 = async (): Promise<string | null> => {
  try {
    const svgString = `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 55C25 40 35 25 55 25C70 25 80 35 80 45C80 50 85 50 90 45C95 40 98 45 95 55C92 65 85 85 55 85C35 85 25 75 25 55Z" fill="#FCD34D" />
      <path d="M45 60C45 60 55 50 70 60" stroke="#F59E0B" stroke-width="4" stroke-linecap="round" />
      <path d="M25 45H15C10 45 10 55 15 55H25" fill="#F97316"/>
      <circle cx="45" cy="40" r="4" fill="#1F2937"/>
      <path d="M55 25C55 20 60 15 65 20" stroke="#FCD34D" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

    // Create a canvas to render the SVG
    const canvas = document.createElement('canvas');
    const size = 100; // Render at good resolution
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Create an image from the SVG
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        const base64 = canvas.toDataURL('image/png');
        resolve(base64);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
};

export async function exportPracticeReportToPdf(
  analysis: SpeechAnalysisResult,
  options: ExportOptions
): Promise<void> {

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Check if we need Chinese font support
    const allText = [
      analysis.transcription || '',
      options.videoTitle,
      options.topicText,
      options.questionText || '',
      ...(analysis.feedback?.strengths || []),
      ...(analysis.feedback?.weaknesses || []),
      ...(analysis.feedback?.suggestions || []),
      ...(analysis.improvements?.map(i => `${i.original} ${i.improved} ${i.explanation}`) || []),
      analysis.pronunciation?.summary || '',
      analysis.pronunciation?.intonation?.feedback || '',
      ...(analysis.pronunciation?.words?.map(w => w.feedback || '') || []),
    ].join(' ');

    const needsChinese = containsCJK(allText);
    let chineseFontLoaded = false;

    if (needsChinese) {
      chineseFontLoaded = await loadChineseFont(doc);
    }

    // Load duck logo for header
    const duckLogoBase64 = await getDuckLogoBase64();

    // ==================== NOTION-STYLE COLORS ====================
    const colors = {
      black: [55, 53, 47] as [number, number, number],
      darkGray: [120, 119, 116] as [number, number, number],
      mediumGray: [155, 154, 151] as [number, number, number],
      lightGray: [227, 226, 224] as [number, number, number],
      background: [251, 251, 250] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],

      // Subtle callout backgrounds (Notion-style)
      grayCallout: [241, 241, 239] as [number, number, number],
      blueCallout: [231, 243, 248] as [number, number, number],
      greenCallout: [237, 243, 236] as [number, number, number],
      yellowCallout: [251, 243, 219] as [number, number, number],
      orangeCallout: [250, 235, 221] as [number, number, number],
      pinkCallout: [245, 224, 233] as [number, number, number],
      purpleCallout: [234, 228, 242] as [number, number, number],

      // Status colors for graph
      strong: [68, 131, 97] as [number, number, number],
      weak: [203, 145, 47] as [number, number, number],
      rootNode: [55, 53, 47] as [number, number, number],
    };

    // Font helper - use Chinese font for all text when loaded to ensure consistency
    const setFont = (style: 'normal' | 'bold' | 'italic' = 'normal', size: number = 10) => {
      if (chineseFontLoaded) {
        doc.setFont('ChineseFont', 'normal');
      } else {
        doc.setFont('helvetica', style);
      }
      doc.setFontSize(size);
    };

    // Font helper for specific text - use Chinese font only if the text contains CJK characters
    const setFontForText = (text: string, style: 'normal' | 'bold' | 'italic' = 'normal', size: number = 10) => {
      if (chineseFontLoaded && containsCJK(text)) {
        doc.setFont('ChineseFont', 'normal');
      } else {
        doc.setFont('helvetica', style);
      }
      doc.setFontSize(size);
    };

    // Check page break
    const checkPageBreak = (requiredSpace: number): void => {
      if (yPos + requiredSpace > pageHeight - 25) {
        doc.addPage();
        yPos = margin;
      }
    };

    // Draw a subtle horizontal divider
    const drawDivider = () => {
      doc.setDrawColor(...colors.lightGray);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
    };

    // Draw section header (Notion-style: clean bold text)
    const drawSectionHeader = (title: string) => {
      checkPageBreak(15);

      setFont('bold', 12);
      doc.setTextColor(...colors.black);
      doc.text(title, margin, yPos);
      yPos += 8;
    };

    // Draw callout box (Notion-style light background)
    const drawCallout = (text: string, bgColor: [number, number, number], textColor: [number, number, number] = colors.black) => {
      setFont('normal', 10);
      const lines = doc.splitTextToSize(text, contentWidth - 16);
      const boxHeight = lines.length * 5.5 + 5;

      checkPageBreak(boxHeight + 5);

      // Background
      doc.setFillColor(...bgColor);
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3, 3, 'F');

      // Text
      doc.setTextColor(...textColor);
      doc.text(lines, margin + 8, yPos + 8);

      yPos += boxHeight + 6;
    };

    // Draw bullet list item
    const drawBulletItem = (text: string, bulletColor: [number, number, number] = colors.darkGray) => {
      setFont('normal', 10);
      const lines = doc.splitTextToSize(text, contentWidth - 12);
      const itemHeight = lines.length * 5.5 + 2;

      checkPageBreak(itemHeight);

      // Bullet point
      doc.setFillColor(...bulletColor);
      doc.circle(margin + 3, yPos + 2, 1.5, 'F');

      // Text
      doc.setTextColor(...colors.black);
      doc.text(lines, margin + 10, yPos + 4);

      yPos += itemHeight + 3;
    };

    // Draw numbered item
    const drawNumberedItem = (num: number, text: string) => {
      setFont('normal', 10);
      const lines = doc.splitTextToSize(text, contentWidth - 15);
      const itemHeight = lines.length * 5.5 + 2;

      checkPageBreak(itemHeight);

      // Number
      setFont('bold', 9);
      doc.setTextColor(...colors.darkGray);
      doc.text(`${num}.`, margin, yPos + 4);

      // Text
      setFont('normal', 10);
      doc.setTextColor(...colors.black);
      doc.text(lines, margin + 10, yPos + 4);

      yPos += itemHeight + 3;
    };

    // ==================== GRAPH RENDERING ====================

    // Calculate dynamic node dimensions using actual jsPDF text measurement
    const calculateNodeDimensions = (label: string, type?: string, elaboration?: string, isRoot?: boolean, isImproved?: boolean) => {
      const NODE_WIDTH = 100;
      const PADDING = 4;
      const TEXT_WIDTH = NODE_WIDTH - PADDING * 2;

      // Use actual jsPDF text measurement for accurate line counts
      const LABEL_FONT_SIZE = 8;
      const ELAB_FONT_SIZE = 7;
      const TYPE_FONT_SIZE = 6;

      // Measure label text
      setFont('bold', LABEL_FONT_SIZE);
      const labelLines = doc.splitTextToSize(label, TEXT_WIDTH);
      const labelHeight = labelLines.length * LABEL_FONT_SIZE * 0.4;

      let height = PADDING * 2;

      if (isRoot) {
        height += labelHeight;
        height = Math.max(height, 18);
      } else {
        // Type badge
        if (type) {
          height += TYPE_FONT_SIZE * 0.5 + 2;
        }

        // Label
        height += labelHeight + 2;

        // Elaboration for improved structure
        if (elaboration && isImproved) {
          setFont('italic', ELAB_FONT_SIZE);
          const elabLines = doc.splitTextToSize(elaboration, TEXT_WIDTH);
          const elabHeight = elabLines.length * ELAB_FONT_SIZE * 0.4;
          height += elabHeight + 4;
        }

        height = Math.max(height, 20);
      }

      return { width: NODE_WIDTH, height };
    };

    const generateFlowData = (data: any, isImproved: boolean = false, framework: string = ''): { nodes: GraphNode[], edges: GraphEdge[] } => {
      if (!data) return { nodes: [], edges: [] };

      const RANK_SEP = 35;
      const NODE_SEP = 20;

      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({ rankdir: 'TB', nodesep: NODE_SEP, ranksep: RANK_SEP, align: 'DL' });

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const rootId = 'root';

      // Calculate root node dimensions
      const rootDimensions = calculateNodeDimensions(data.conclusion, undefined, undefined, true, isImproved);
      nodes.push({
        id: rootId,
        label: data.conclusion,
        isRoot: true,
        x: 0, y: 0,
        width: rootDimensions.width,
        height: rootDimensions.height,
      });

      const processNode = (item: any, parentId: string, index: number) => {
        const nodeId = `${parentId}-${index}`;
        const label = isImproved ? (item.headline || item.point) : item.point;
        const dimensions = calculateNodeDimensions(label, item.type, item.elaboration, false, isImproved);

        nodes.push({
          id: nodeId,
          label: label,
          type: item.type,
          status: item.status,
          elaboration: item.elaboration,
          x: 0, y: 0,
          width: dimensions.width,
          height: dimensions.height,
        });

        edges.push({
          source: parentId,
          target: nodeId,
          animated: item.status === 'weak' || item.status === 'missing',
        });

        if (item.sub_points?.length > 0) {
          item.sub_points.forEach((child: any, idx: number) => processNode(child, nodeId, idx));
        }
      };

      const isSequentialFramework = SEQUENTIAL_FRAMEWORKS.includes(framework.toUpperCase());

      if (data.arguments?.length > 0) {
        if (isSequentialFramework) {
          const nodeIds: string[] = [];
          data.arguments.forEach((arg: any, index: number) => {
            const nodeId = `${rootId}-${index}`;
            nodeIds.push(nodeId);
            const label = isImproved ? (arg.headline || arg.point) : arg.point;
            const dimensions = calculateNodeDimensions(label, arg.type, arg.elaboration, false, isImproved);

            nodes.push({
              id: nodeId,
              label: label,
              type: arg.type,
              status: arg.status,
              elaboration: arg.elaboration,
              x: 0, y: 0,
              width: dimensions.width,
              height: dimensions.height,
            });

            if (arg.sub_points?.length > 0) {
              arg.sub_points.forEach((child: any, idx: number) => processNode(child, nodeId, idx));
            }
          });

          edges.push({ source: rootId, target: nodeIds[0], animated: data.arguments[0].status === 'weak' || data.arguments[0].status === 'missing' });
          for (let i = 0; i < nodeIds.length - 1; i++) {
            edges.push({ source: nodeIds[i], target: nodeIds[i + 1], animated: data.arguments[i + 1].status === 'weak' || data.arguments[i + 1].status === 'missing' });
          }
        } else {
          data.arguments.forEach((arg: any, index: number) => processNode(arg, rootId, index));
        }
      }

      nodes.forEach(node => {
        dagreGraph.setNode(node.id, { width: node.width, height: node.height });
      });
      edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target));
      dagre.layout(dagreGraph);

      nodes.forEach(node => {
        const pos = dagreGraph.node(node.id);
        if (pos) {
          node.x = pos.x - node.width / 2;
          node.y = pos.y - node.height / 2;
        }
      });

      return { nodes, edges };
    };

    const drawGraph = (structure: any, title: string, isImproved: boolean = false, framework: string = '') => {
      if (!structure?.conclusion || !structure?.arguments) return;

      const { nodes, edges } = generateFlowData(structure, isImproved, framework);
      if (nodes.length === 0) return;

      // Calculate bounds using actual node dimensions from each node
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x + node.width);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y + node.height);
      });

      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;

      const headerSpace = 15;
      const legendSpace = 20;
      const bottomMargin = 25;

      // Calculate scale to fit width (MUST fit within page width)
      const widthScale = (contentWidth - 10) / graphWidth;

      // Calculate available height on current page
      let availableHeight = pageHeight - yPos - headerSpace - legendSpace - bottomMargin;
      let heightScale = availableHeight / graphHeight;

      // If graph won't fit on current page, start a new page
      const minRequiredScale = Math.min(widthScale, 0.3); // At least 30% or width-constrained
      if (heightScale < minRequiredScale) {
        doc.addPage();
        yPos = margin;
        availableHeight = pageHeight - yPos - headerSpace - legendSpace - bottomMargin;
        heightScale = availableHeight / graphHeight;
      }

      // Scale to fit both width and height - width is mandatory, height is preferred
      // Always respect width constraint to prevent overflow
      const scale = Math.min(1, widthScale, heightScale);
      const scaledHeight = graphHeight * scale;

      // Section header
      drawSectionHeader(title);

      const graphStartY = yPos;
      const offsetX = margin + (contentWidth - graphWidth * scale) / 2 - minX * scale;
      const offsetY = graphStartY - minY * scale;

      // Draw edges (simple straight lines for Notion-like cleanliness)
      doc.setDrawColor(...colors.lightGray);
      doc.setLineWidth(0.5);
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          const x1 = offsetX + (source.x + source.width / 2) * scale;
          const y1 = offsetY + (source.y + source.height) * scale;
          const x2 = offsetX + (target.x + target.width / 2) * scale;
          const y2 = offsetY + target.y * scale;

          if (edge.animated) {
            doc.setLineDashPattern([2, 2], 0);
          } else {
            doc.setLineDashPattern([], 0);
          }
          doc.line(x1, y1, x2, y2);
        }
      });
      doc.setLineDashPattern([], 0);

      // Draw nodes - use fixed font sizes that match the calculation
      const LABEL_FONT_SIZE = 8 * scale;
      const ELAB_FONT_SIZE = 7 * scale;
      const TYPE_FONT_SIZE = 6 * scale;

      nodes.forEach(node => {
        const x = offsetX + node.x * scale;
        const y = offsetY + node.y * scale;
        const w = node.width * scale;
        const h = node.height * scale;
        const r = Math.max(1.5, 2.5 * scale);
        const pad = 4 * scale;
        const textWidth = w - pad * 2;

        if (node.isRoot) {
          // Root node - dark background
          doc.setFillColor(...colors.rootNode);
          doc.roundedRect(x, y, w, h, r, r, 'F');

          setFont('bold', LABEL_FONT_SIZE);
          doc.setTextColor(255, 255, 255);
          const lines = doc.splitTextToSize(node.label, textWidth);
          const lineHeight = LABEL_FONT_SIZE * 0.45;
          const totalTextHeight = lines.length * lineHeight;
          const startY = y + (h - totalTextHeight) / 2 + lineHeight * 0.8;
          doc.text(lines, x + pad, startY, { maxWidth: textWidth, lineHeightFactor: 1.15 });
        } else {
          // Child nodes
          let bgColor = colors.grayCallout;
          let borderColor = colors.lightGray;

          if (isImproved) {
            bgColor = colors.greenCallout;
            borderColor = colors.strong;
          } else if (node.status === 'strong') {
            bgColor = colors.greenCallout;
            borderColor = colors.strong;
          } else if (node.status === 'weak') {
            bgColor = colors.yellowCallout;
            borderColor = colors.weak;
          }

          doc.setFillColor(...bgColor);
          doc.setDrawColor(...borderColor);
          doc.setLineWidth(0.5);
          doc.roundedRect(x, y, w, h, r, r, 'FD');

          // Type badge at top
          let currentY = y + pad;
          if (node.type) {
            setFont('bold', TYPE_FONT_SIZE);
            doc.setTextColor(...colors.mediumGray);
            doc.text(node.type.toUpperCase(), x + pad, currentY + TYPE_FONT_SIZE * 0.35);
            currentY += TYPE_FONT_SIZE * 0.5 + 2 * scale;
          }

          // Label (headline) - bold
          setFont('bold', LABEL_FONT_SIZE);
          doc.setTextColor(...colors.black);
          const labelLines = doc.splitTextToSize(node.label, textWidth);
          const labelLineHeight = LABEL_FONT_SIZE * 0.45;
          doc.text(labelLines, x + pad, currentY + labelLineHeight * 0.8, { maxWidth: textWidth, lineHeightFactor: 1.15 });
          currentY += labelLines.length * labelLineHeight + 2 * scale;

          // Elaboration text (italic quote in light box) - for improved structure
          if (node.elaboration && isImproved) {
            const elabBoxTop = currentY;

            setFont('italic', ELAB_FONT_SIZE);
            const elabLines = doc.splitTextToSize(node.elaboration, textWidth);
            const elabLineHeight = ELAB_FONT_SIZE * 0.45;
            const elabBoxH = elabLines.length * elabLineHeight + pad;

            // Light blue background - sized to fit text
            doc.setFillColor(235, 245, 255);
            doc.roundedRect(x + pad * 0.5, elabBoxTop, w - pad, elabBoxH, 1.5 * scale, 1.5 * scale, 'F');

            // Italic elaboration text
            doc.setTextColor(80, 80, 80);
            doc.text(elabLines, x + pad, elabBoxTop + elabLineHeight * 0.8, { maxWidth: textWidth, lineHeightFactor: 1.15 });
          }
        }
      });

      yPos = graphStartY + scaledHeight + 15;

      // Simple legend for user structure
      if (!isImproved) {
        setFont('normal', 8);
        doc.setTextColor(...colors.mediumGray);

        doc.setFillColor(...colors.strong);
        doc.circle(margin + 3, yPos, 2, 'F');
        doc.text('Strong', margin + 8, yPos + 1);

        doc.setFillColor(...colors.weak);
        doc.circle(margin + 35, yPos, 2, 'F');
        doc.text('Needs work', margin + 40, yPos + 1);

        yPos += 10;
      }
    };

    // ==================== PDF CONTENT ====================

    // Helper to get translated heading
    const t = (key: string) => getHeading(key, options.level, options.targetLang, options.nativeLang);

    // Title
    setFont('bold', 24);
    doc.setTextColor(...colors.black);
    doc.text(t('Practice Report'), margin, yPos + 5);
    yPos += 15;

    // Meta info (subtle gray text)
    setFont('normal', 10);
    doc.setTextColor(...colors.darkGray);
    doc.text(`${options.date}  •  ${options.targetLang}  •  ${options.level}`, margin, yPos);
    yPos += 12;

    drawDivider();

    // Topic & Question block
    setFont('bold', 11);
    doc.setTextColor(...colors.black);
    doc.text(t('Topic'), margin, yPos);
    yPos += 6;

    setFont('normal', 11);
    doc.setTextColor(...colors.black);
    const topicLines = doc.splitTextToSize(options.topicText, contentWidth);
    doc.text(topicLines, margin, yPos);
    yPos += topicLines.length * 5.5 + 4;

    if (options.questionText) {
      setFont('bold', 11);
      doc.setTextColor(...colors.black);
      doc.text(t('Question'), margin, yPos);
      yPos += 6;

      setFont('normal', 10);
      doc.setTextColor(...colors.darkGray);
      const questionLines = doc.splitTextToSize(options.questionText, contentWidth);
      doc.text(questionLines, margin, yPos);
      yPos += questionLines.length * 5 + 4;
    }

    // Video source
    setFont('normal', 9);
    doc.setTextColor(...colors.mediumGray);
    const videoLines = doc.splitTextToSize(`${t('Source')}: ${options.videoTitle}`, contentWidth);
    doc.text(videoLines[0], margin, yPos);
    yPos += 12;

    drawDivider();

    // ==================== 1. YOUR RESPONSE ====================
    if (analysis.transcription) {
      drawSectionHeader(t('Your Response'));
      drawCallout(analysis.transcription, colors.grayCallout);
      yPos += 4;
    }

    // ==================== 2. LANGUAGE POLISH ====================
    if (analysis.improvements && analysis.improvements.length > 0) {
      drawSectionHeader(t('Language Polish'));

      for (const imp of analysis.improvements) {
        checkPageBreak(35);

        // Original (strikethrough style)
        setFont('normal', 9);
        doc.setTextColor(180, 80, 80);
        doc.text(`${t('Before')}:`, margin, yPos);
        yPos += 5;

        setFont('normal', 10);
        doc.setTextColor(...colors.darkGray);
        const origLines = doc.splitTextToSize(`"${imp.original}"`, contentWidth - 5);
        doc.text(origLines, margin + 5, yPos);
        yPos += origLines.length * 5 + 4;

        // Improved
        setFont('normal', 9);
        doc.setTextColor(68, 131, 97);
        doc.text(`${t('After')}:`, margin, yPos);
        yPos += 5;

        setFont('normal', 10);
        doc.setTextColor(...colors.black);
        const improvLines = doc.splitTextToSize(`"${imp.improved}"`, contentWidth - 5);
        doc.text(improvLines, margin + 5, yPos);
        yPos += improvLines.length * 5 + 4;

        // Explanation (subtle)
        setFont('italic', 9);
        doc.setTextColor(...colors.mediumGray);
        const explLines = doc.splitTextToSize(imp.explanation, contentWidth - 5);
        doc.text(explLines, margin + 5, yPos);
        yPos += explLines.length * 4.5 + 8;
      }
      yPos += 4;
    }

    // ==================== 3. PRONUNCIATION & INTONATION ====================
    if (analysis.pronunciation) {
      drawSectionHeader(t('Pronunciation & Intonation'));

      // Overall Pronunciation
      checkPageBreak(20);
      setFont('bold', 10);
      doc.setTextColor(...colors.black);
      const overallLabel = analysis.pronunciation.overall.replace('-', ' ');
      doc.text(`${t('Overall')}: ${overallLabel}`, margin, yPos);
      yPos += 6;

      if (analysis.pronunciation.summary) {
        setFontForText(analysis.pronunciation.summary, 'normal', 10);
        doc.setTextColor(...colors.darkGray);
        const summaryLines = doc.splitTextToSize(analysis.pronunciation.summary, contentWidth - 5);
        doc.text(summaryLines, margin + 5, yPos);
        yPos += summaryLines.length * 5 + 4;
      }

      // Intonation
      checkPageBreak(15);
      setFont('bold', 10);
      doc.setTextColor(...colors.black);
      doc.text(`${t('Intonation')}: ${analysis.pronunciation.intonation.pattern}`, margin, yPos);
      yPos += 6;

      if (analysis.pronunciation.intonation.feedback) {
        setFontForText(analysis.pronunciation.intonation.feedback, 'normal', 10);
        doc.setTextColor(...colors.darkGray);
        const intoLines = doc.splitTextToSize(analysis.pronunciation.intonation.feedback, contentWidth - 5);
        doc.text(intoLines, margin + 5, yPos);
        yPos += intoLines.length * 5 + 6;
      }

      // Word Pronunciation - only show words that need work or are unclear, with their tips
      if (analysis.pronunciation.words && analysis.pronunciation.words.length > 0) {
        const wordsNeedingAttention = analysis.pronunciation.words.filter(
          w => w.status === 'needs-work' || w.status === 'unclear'
        );

        if (wordsNeedingAttention.length > 0) {
          checkPageBreak(15);
          setFont('bold', 10);
          doc.setTextColor(...colors.black);
          doc.text(`${t('Words to Practice')}:`, margin, yPos);
          yPos += 6;

          for (const wordObj of wordsNeedingAttention) {
            checkPageBreak(15);

            const bulletColor = wordObj.status === 'needs-work' ? colors.weak : [239, 68, 68] as [number, number, number];

            // Bullet point
            doc.setFillColor(...bulletColor);
            doc.circle(margin + 3, yPos + 2, 1.5, 'F');

            // Word only
            setFont('bold', 10);
            doc.setTextColor(...colors.black);
            doc.text(wordObj.word, margin + 10, yPos + 4);

            yPos += 6;

            // Feedback/tip from tooltip if available
            if (wordObj.feedback) {
              setFontForText(wordObj.feedback, 'normal', 9);
              doc.setTextColor(...colors.darkGray);
              const feedbackLines = doc.splitTextToSize(wordObj.feedback, contentWidth - 15);
              doc.text(feedbackLines, margin + 10, yPos + 2);
              yPos += feedbackLines.length * 4.5 + 3;
            }
          }
        }
      }

      yPos += 6;
    }

    // ==================== 4. STRENGTHS ====================
    if (analysis.feedback?.strengths && analysis.feedback.strengths.length > 0) {
      drawSectionHeader(t('Strengths'));

      for (const strength of analysis.feedback.strengths) {
        drawBulletItem(strength, colors.strong);
      }
      yPos += 6;
    }

    // ==================== 5. AREAS FOR IMPROVEMENT ====================
    if (analysis.feedback?.weaknesses && analysis.feedback.weaknesses.length > 0) {
      drawSectionHeader(t('Areas for Improvement'));

      for (const weakness of analysis.feedback.weaknesses) {
        drawBulletItem(weakness, colors.weak);
      }
      yPos += 6;
    }

    // ==================== 6. ACTIONABLE TIPS ====================
    if (analysis.feedback?.suggestions && analysis.feedback.suggestions.length > 0) {
      drawSectionHeader(t('Actionable Tips'));

      for (let i = 0; i < analysis.feedback.suggestions.length; i++) {
        drawNumberedItem(i + 1, analysis.feedback.suggestions[i]);
      }
      yPos += 6;
    }

    // ==================== 7. LOGIC STRUCTURE ====================
    const detectedFramework = analysis.detected_framework || '';

    if (analysis.structure?.conclusion && analysis.structure?.arguments) {
      drawGraph(analysis.structure, t('Your Logic Structure'), false, detectedFramework);
    }

    // ==================== 8. AI IMPROVED STRUCTURE ====================
    if (analysis.improved_structure?.conclusion && analysis.improved_structure?.arguments) {
      const improvedFramework = analysis.improved_structure.recommended_framework || detectedFramework;
      drawGraph(analysis.improved_structure, t('Improved Structure'), true, improvedFramework);
    }

    // ==================== HEADER & FOOTER ON ALL PAGES ====================
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Header - duck logo + "bilibala" branding on top right
      setFont('bold', 11);
      doc.setTextColor(...colors.darkGray);
      const brandText = 'Bilibala';
      const brandWidth = doc.getTextWidth(brandText);
      const logoSize = 6; // Size of the duck logo in mm
      const logoTextGap = 1; // Gap between logo and text
      const totalBrandWidth = logoSize + logoTextGap + brandWidth;
      const brandStartX = pageWidth - margin - totalBrandWidth;

      // Add duck logo if available
      if (duckLogoBase64) {
        doc.addImage(duckLogoBase64, 'PNG', brandStartX, 7, logoSize, logoSize);
      }

      // Add "bilibala" text
      doc.text(brandText, brandStartX + logoSize + logoTextGap, 12);

      // Footer - page number at bottom right
      setFont('normal', 8);
      doc.setTextColor(...colors.mediumGray);
      const pageText = `${i} / ${totalPages}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      doc.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 10);
    }

    // Save - format: {topic}-report-{date}.pdf
    const sanitizedTopic = options.topicText
      .substring(0, 50) // Limit topic length
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-') // Keep alphanumeric and Chinese chars
      .replace(/-+/g, '-') // Remove consecutive dashes
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
    const sanitizedDate = options.date.replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `${sanitizedTopic}-report-${sanitizedDate}.pdf`;
    doc.save(fileName);
  } catch (error) {
    throw error;
  }
}
