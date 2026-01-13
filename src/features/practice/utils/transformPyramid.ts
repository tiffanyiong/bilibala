import { Node, Edge } from 'reactflow';
import { SpeechAnalysisResult } from '../shared/types';

export const generateFlowData = (aiPyramidData: SpeechAnalysisResult['structure']) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Constants for layout
  const NODE_WIDTH = 250;
  const GAP_X = 50;
  const LEVEL_HEIGHT = 150;

  // 1. Create Root Node (Conclusion)
  // Calculate center X based on number of arguments
  const totalWidth = aiPyramidData.arguments.length * (NODE_WIDTH + GAP_X) - GAP_X;
  const rootX = totalWidth / 2 - NODE_WIDTH / 2;

  nodes.push({
    id: 'root',
    type: 'input',
    data: { label: aiPyramidData.conclusion || "No conclusion detected" },
    position: { x: rootX, y: 0 },
    style: { 
      backgroundColor: '#FAFAF9', // stone-50
      borderColor: '#1C1917', // stone-900
      borderWidth: 2,
      borderRadius: '12px',
      padding: '16px',
      width: NODE_WIDTH,
      fontSize: '14px',
      fontWeight: 600,
      textAlign: 'center',
      color: '#1C1917',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    }
  });

  // 2. Create Children Nodes (Arguments)
  aiPyramidData.arguments.forEach((arg, index) => {
    const argId = `arg-${index}`;
    const xPos = index * (NODE_WIDTH + GAP_X);
    const yPos = LEVEL_HEIGHT;
    
    const isWeak = arg.status === 'weak' || arg.status === 'missing';
    const isMissing = arg.status === 'missing';

    // Argument Node
    nodes.push({
      id: argId,
      data: { 
        label: isMissing ? "Missing Argument" : arg.point,
        status: arg.status,
        evidence: arg.evidence
      },
      position: { x: xPos, y: yPos },
      style: { 
        backgroundColor: isWeak ? '#FEF2F2' : '#F0FDF4', // red-50 : green-50
        borderColor: isWeak ? '#EF4444' : '#22C55E', // red-500 : green-500
        borderStyle: isWeak ? 'dashed' : 'solid',
        borderWidth: 2,
        borderRadius: '12px',
        padding: '12px',
        width: NODE_WIDTH,
        fontSize: '13px',
        color: '#44403C', // stone-700
        textAlign: 'left',
        opacity: isMissing ? 0.7 : 1
      }
    });

    // Edge (Root -> Argument)
    edges.push({
      id: `e-root-${argId}`,
      source: 'root',
      target: argId,
      animated: true,
      style: { 
        stroke: isWeak ? '#EF4444' : '#22C55E',
        strokeWidth: 2,
        strokeDasharray: isWeak ? '5,5' : '0' 
      }
    });

    // 3. Evidence Nodes (Level 3)
    if (arg.evidence && arg.evidence.length > 0) {
       arg.evidence.forEach((ev, evIndex) => {
           const evId = `ev-${index}-${evIndex}`;
           // Stack evidence vertically below the argument
           const evYPos = yPos + LEVEL_HEIGHT + (evIndex * 80); 
           
           nodes.push({
               id: evId,
               data: { label: ev },
               position: { x: xPos, y: evYPos },
               style: {
                   backgroundColor: '#FFFFFF',
                   borderColor: '#E7E5E4', // stone-200
                   borderWidth: 1,
                   borderRadius: '8px',
                   padding: '8px',
                   width: NODE_WIDTH,
                   fontSize: '11px',
                   color: '#78716C', // stone-500
                   fontStyle: 'italic'
               }
           });

           // Edge (Argument -> Evidence)
           edges.push({
               id: `e-${argId}-${evId}`,
               source: argId,
               target: evId,
               type: 'step', // Step line for clean look
               style: { stroke: '#E7E5E4', strokeWidth: 1 }
           });
       });
    }
  });

  return { nodes, edges };
};
