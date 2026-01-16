import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

// Frameworks that use sequential flow (node1 → node2 → node3 → ...)
const SEQUENTIAL_FRAMEWORKS = ['STAR', 'PREP', 'GOLDEN_CIRCLE', 'WSN'];

export const generateFlowData = (data: any, isAIImproved: boolean = false, isMobile: boolean = false, labels: any = {}, framework: string = '') => {
  if (!data) return { nodes: [], edges: [] };

  // --- RESPONSIVE CONFIGURATION ---
  // Tighter packing for Mobile
  const NODE_WIDTH = isMobile ? 150 : 260;  
  const NODE_HEIGHT = isMobile ? 80 : 120; 
  const RANK_SEP = isMobile ? 30 : 50;      // Vertical gap
  const NODE_SEP = isMobile ? 15 : 40;      // Horizontal gap

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const rootId = 'root';
  
  // Root Node
  nodes.push({
    id: rootId,
    type: 'pyramidNode',
    data: {
      label: data.conclusion,
      headline: data.conclusion,
      isRoot: true,
      isImproved: isAIImproved,
      isMobile: isMobile,
      labels: labels
    },
    position: { x: 0, y: 0 },
  });

  // Recursive Node Processing
  const processNode = (item: any, parentId: string, index: number) => {
    const nodeId = `${parentId}-${index}`;
    
    let statusColor = 'border-stone-200 bg-white';
    if (item.status === 'strong') statusColor = 'border-green-400 bg-green-50';
    if (item.status === 'weak') statusColor = 'border-amber-400 bg-amber-50';
    if (item.status === 'missing') statusColor = 'border-stone-300 border-dashed bg-stone-50';

    nodes.push({
      id: nodeId,
      type: 'pyramidNode',
      data: {
        label: item.point,
        headline: item.headline || item.point,
        elaboration: item.elaboration,
        critique: item.critique,
        type: item.type,
        status: item.status,
        isImproved: isAIImproved,
        statusStyle: statusColor,
        isMobile: isMobile,
        labels: labels
      },
      position: { x: 0, y: 0 },
    });

    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
      animated: item.status === 'weak' || item.status === 'missing',
      style: { strokeWidth: isMobile ? 1 : 2 },
    });

    if (item.sub_points) {
      item.sub_points.forEach((child: any, idx: number) => processNode(child, nodeId, idx));
    }
  };

  // Determine if this framework uses sequential flow
  const isSequentialFramework = SEQUENTIAL_FRAMEWORKS.includes(framework.toUpperCase());

  if (data.arguments) {
    if (isSequentialFramework && data.arguments.length > 0) {
      // Sequential flow: root → arg[0] → arg[1] → arg[2] → ...
      // First, create all nodes (without edges in processNode)
      const nodeIds: string[] = [];

      data.arguments.forEach((arg: any, index: number) => {
        const nodeId = `${rootId}-${index}`;
        nodeIds.push(nodeId);

        let statusColor = 'border-stone-200 bg-white';
        if (arg.status === 'strong') statusColor = 'border-green-400 bg-green-50';
        if (arg.status === 'weak') statusColor = 'border-amber-400 bg-amber-50';
        if (arg.status === 'missing') statusColor = 'border-stone-300 border-dashed bg-stone-50';

        nodes.push({
          id: nodeId,
          type: 'pyramidNode',
          data: {
            label: arg.point,
            headline: arg.headline || arg.point,
            elaboration: arg.elaboration,
            critique: arg.critique,
            type: arg.type,
            status: arg.status,
            isImproved: isAIImproved,
            statusStyle: statusColor,
            isMobile: isMobile,
            labels: labels
          },
          position: { x: 0, y: 0 },
        });

        // Process sub_points recursively (they still use tree structure)
        if (arg.sub_points) {
          arg.sub_points.forEach((child: any, idx: number) => processNode(child, nodeId, idx));
        }
      });

      // Create sequential edges: root → first, then each node → next node
      edges.push({
        id: `e-${rootId}-${nodeIds[0]}`,
        source: rootId,
        target: nodeIds[0],
        animated: data.arguments[0].status === 'weak' || data.arguments[0].status === 'missing',
        style: { strokeWidth: isMobile ? 1 : 2 },
      });

      for (let i = 0; i < nodeIds.length - 1; i++) {
        edges.push({
          id: `e-${nodeIds[i]}-${nodeIds[i + 1]}`,
          source: nodeIds[i],
          target: nodeIds[i + 1],
          animated: data.arguments[i + 1].status === 'weak' || data.arguments[i + 1].status === 'missing',
          style: { strokeWidth: isMobile ? 1 : 2 },
        });
      }
    } else {
      // Tree structure (MINTO or fallback): root → all children directly
      data.arguments.forEach((arg: any, index: number) => processNode(arg, rootId, index));
    }
  }

  // Layout Logic
  dagreGraph.setGraph({ 
    rankdir: 'TB', 
    nodesep: NODE_SEP, 
    ranksep: RANK_SEP,
    align: 'DL' 
  });

  nodes.forEach((node) => {
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
    // Shift position to center anchor
    node.position = {
      x: nodeWithPosition.x - NODE_WIDTH / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    };
  });

  return { nodes, edges };
};