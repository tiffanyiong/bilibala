import { Edge, MarkerType, Node } from 'reactflow';
import { SpeechAnalysisResult } from '../../../shared/types';

export const generateFlowData = (
    structure: SpeechAnalysisResult['structure'] | SpeechAnalysisResult['improved_structure'], 
    isImproved: boolean = false
) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  if (!structure) return { nodes, edges };

  // Constants for layout
  const NODE_WIDTH = 250;
  const GAP_X = 50;
  const LEVEL_HEIGHT = 150;

  // 1. Create Root Node (Conclusion)
  const argCount = structure.arguments.length || 1;
  const totalWidth = argCount * (NODE_WIDTH + GAP_X) - GAP_X;
  const rootX = totalWidth / 2 - NODE_WIDTH / 2;

  nodes.push({
    id: 'root',
    type: 'default',
    data: { label: structure.conclusion || "No conclusion detected" },
    position: { x: rootX, y: 0 },
    style: { 
      backgroundColor: isImproved ? '#F0F9FF' : '#FAFAF9', 
      borderColor: isImproved ? '#0EA5E9' : '#1C1917',
      borderWidth: 2,
      borderRadius: '12px',
      padding: '16px',
      width: NODE_WIDTH,
      fontSize: '14px',
      fontWeight: 600,
      textAlign: 'center',
      color: isImproved ? '#0C4A6E' : '#1C1917',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }
  });

  // 2. Create Children Nodes (Arguments)
  structure.arguments.filter(arg => arg && (isImproved ? arg.headline : arg.point)).forEach((arg: any, index) => {
    const argId = `arg-${index}`;
    const xPos = index * (NODE_WIDTH + GAP_X);
    const yPos = LEVEL_HEIGHT;
    
    // Status Logic
    const isWeak = !isImproved && (arg.status === 'weak' || arg.status === 'missing');
    const isMissing = !isImproved && arg.status === 'missing';
    const isIrrelevant = !isImproved && arg.status === 'irrelevant';
    
    // Labels differ between User and AI
    const label = isImproved 
        ? (arg.headline || "Ideal Argument") 
        : (isMissing ? "Evidence Missing" : arg.point);

    // AI elaboration acts like a critique (info popup)
    const info = isImproved ? arg.elaboration : arg.critique;

    // Argument Node
    nodes.push({
      id: argId,
      type: 'pyramidNode',
      data: { 
        label: label,
        headline: isImproved ? arg.headline : undefined,
        elaboration: isImproved ? arg.elaboration : undefined,
        isImproved: isImproved,
        critique: info 
      },
      position: { x: xPos, y: yPos },
      className: (isWeak || isIrrelevant || isImproved) ? 'cursor-pointer hover:shadow-lg transition-shadow' : '', 
      style: { 
        backgroundColor: isMissing ? '#F5F5F4' : (isIrrelevant ? '#FEF2F2' : (isWeak ? '#FEFCE8' : (isImproved ? '#F0F9FF' : '#F0FDF4'))), 
        borderColor: isMissing ? '#A8A29E' : (isIrrelevant ? '#EF4444' : (isWeak ? '#FACC15' : (isImproved ? '#0EA5E9' : '#22C55E'))), 
        borderStyle: (isWeak || isMissing || isIrrelevant) ? 'dashed' : 'solid',
        borderWidth: 2,
        borderRadius: '12px',
        padding: '12px',
        width: NODE_WIDTH,
        fontSize: '13px',
        color: isMissing ? '#78716C' : (isIrrelevant ? '#991B1B' : (isImproved ? '#0C4A6E' : '#44403C')),
        textAlign: 'left',
        opacity: isIrrelevant ? 0.7 : 1
      }
    });

    // Edge (Root -> Argument)
    if (!isIrrelevant) {
        edges.push({
          id: `e-root-${argId}`,
          source: 'root',
          target: argId,
          animated: !isImproved, 
          style: { 
            stroke: isMissing ? '#A8A29E' : (isWeak ? '#FACC15' : (isImproved ? '#0EA5E9' : '#22C55E')),
            strokeWidth: 2,
            strokeDasharray: (isWeak || isMissing) ? '5,5' : '0' 
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: isMissing ? '#A8A29E' : (isWeak ? '#FACC15' : (isImproved ? '#0EA5E9' : '#22C55E')) }
        });
    }

    // 3. Evidence Nodes
    if (arg.evidence && arg.evidence.length > 0) {
       arg.evidence.filter((ev: string) => ev && ev.trim().length > 0).forEach((ev: string, evIndex: number) => {
           const evId = `ev-${index}-${evIndex}`;
           const evYPos = yPos + LEVEL_HEIGHT + (evIndex * 80); 
           
           nodes.push({
               id: evId,
               type: 'default',
               data: { label: ev },
               position: { x: xPos, y: evYPos },
               style: {
                   backgroundColor: isImproved ? '#F0F9FF' : '#FFFFFF',
                   borderColor: isImproved ? '#0EA5E9' : '#E7E5E4',
                   borderWidth: isImproved ? 2 : 1,
                   borderRadius: '8px',
                   padding: '8px',
                   width: NODE_WIDTH,
                   fontSize: '11px',
                   color: isImproved ? '#075985' : '#78716C',
                   fontStyle: isImproved ? 'normal' : 'italic',
                   boxShadow: isImproved ? '0 2px 4px rgba(14, 165, 233, 0.15)' : 'none'
               }
           });

           edges.push({
               id: `e-${argId}-${evId}`,
               source: argId,
               target: evId,
               type: 'step', 
               style: { 
                   stroke: isImproved ? '#0EA5E9' : '#E7E5E4', 
                   strokeWidth: isImproved ? 2 : 1 
               }
           });
       });
    } else if (isWeak && !isMissing) {
        const ghostId = `ghost-ev-${index}`;
        const ghostYPos = yPos + LEVEL_HEIGHT;
        
        nodes.push({
            id: ghostId,
            type: 'default',
            data: { label: "No evidence provided" },
            position: { x: xPos, y: ghostYPos },
            style: {
                backgroundColor: '#F5F5F4',
                borderColor: '#A8A29E',
                borderStyle: 'dashed',
                borderWidth: 1,
                borderRadius: '8px',
                padding: '8px',
                width: NODE_WIDTH,
                fontSize: '11px',
                color: '#A8A29E',
                fontStyle: 'italic',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }
        });

        edges.push({
            id: `e-${argId}-${ghostId}`,
            source: argId,
            target: ghostId,
            type: 'step', 
            style: { stroke: '#A8A29E', strokeWidth: 1, strokeDasharray: '4,4' }
        });
    }
  });

  return { nodes, edges };
};
