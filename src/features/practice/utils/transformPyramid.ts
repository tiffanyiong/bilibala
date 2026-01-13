import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

// Layout Configuration
const NODE_WIDTH = 260;  // Matches your CSS w-[260px]
const NODE_HEIGHT = 140; // Slightly taller to account for text wrapping
const RANK_SEP = 50;     // REDUCED from 80 (Vertical gap)
const NODE_SEP = 30;     // REDUCED from 50 (Horizontal gap)

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const generateFlowData = (data: any, isAIImproved: boolean = false) => {
  if (!data) return { nodes: [], edges: [] };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // 1. Create Root Node (Conclusion)
  const rootId = 'root';
  nodes.push({
    id: rootId,
    type: 'pyramidNode',
    data: {
      label: data.conclusion,
      headline: data.conclusion, // For AI view
      isRoot: true,
      isImproved: isAIImproved,
    },
    position: { x: 0, y: 0 },
  });

  // 2. Recursive Function to process Hierarchy
  const processNode = (item: any, parentId: string, index: number) => {
    // Generate unique ID
    const nodeId = `${parentId}-${index}`;
    
    // Determine Status Colors
    let statusColor = 'border-stone-200 bg-white';
    if (item.status === 'strong') statusColor = 'border-green-400 bg-green-50';
    if (item.status === 'weak') statusColor = 'border-amber-400 bg-amber-50';
    if (item.status === 'missing') statusColor = 'border-stone-300 border-dashed bg-stone-50';

    // Create Node
    nodes.push({
      id: nodeId,
      type: 'pyramidNode',
      data: {
        // Content
        label: item.point,
        headline: item.headline || item.point,
        elaboration: item.elaboration,
        critique: item.critique,
        
        // Metadata
        type: item.type, // 'story', 'fact', 'opinion'
        status: item.status,
        isImproved: isAIImproved,
        statusStyle: statusColor,
        
        // Depth Helper
        hasChildren: item.sub_points && item.sub_points.length > 0
      },
      position: { x: 0, y: 0 },
    });

    // Create Edge
    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      type: 'smoothstep', // Use 'smoothstep' or 'step' for cleaner 90-degree lines
      animated: item.status === 'weak' || item.status === 'missing',
      style: { 
        stroke: item.status === 'weak' ? '#fbbf24' : '#94a3b8', // Darker gray (#94a3b8)
        strokeWidth: 2,
      },
    });

    // RECURSION: Process sub_points (The Vertical Depth)
    if (item.sub_points && item.sub_points.length > 0) {
      item.sub_points.forEach((child: any, idx: number) => {
        processNode(child, nodeId, idx);
      });
    }
  };

  // 3. Start Recursion
  if (data.arguments) {
    data.arguments.forEach((arg: any, index: number) => {
      processNode(arg, rootId, index);
    });
  }

  // 4. Apply Dagre Layout (Calculates X/Y coordinates)
  return getLayoutedElements(nodes, edges);
};

// Helper: Dagre Layout Algorithm
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {

  // align: 'UL' (Upper Left) or 'DL' often helps compact trees better than default
  dagreGraph.setGraph({ 
    rankdir: 'TB', 
    nodesep: NODE_SEP, 
    ranksep: RANK_SEP,
    align: 'DL' // Try adding this for tighter packing
  });

  nodes.forEach((node) => {
    // Dynamic Height Calculation (Optional but recommended)
    // If text is long, the node is taller. 
    // For now, let's use a safe static height.
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;

    // Shift center for React Flow
    node.position = {
      x: nodeWithPosition.x - NODE_WIDTH / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    };
  });

  return { nodes, edges };
};