import React, { memo, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    MiniMap,
    Node,
    Position,
    ReactFlowProvider,
    useEdgesState,
    useNodesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SpeechAnalysisResult } from '../../../shared/types';
import { generateFlowData } from '../utils/transformPyramid'; // Ensure this points to the file created in Step 2

interface PyramidFeedbackProps {
  analysis: SpeechAnalysisResult;
  onRetry: () => void;
  audioUrl?: string | null;
}

// --- 1. UPDATED NODE COMPONENT (Supports Badges & Depth) ---
const PyramidNode = memo(({ data }: { data: any }) => {
    // Determine Badge Style
    const getBadge = () => {
        if (data.type === 'story') return { label: '📖 Story', bg: 'bg-purple-100 text-purple-700' };
        if (data.type === 'fact') return { label: '📊 Fact', bg: 'bg-blue-100 text-blue-700' };
        if (data.type === 'opinion') return { label: '💭 Opinion', bg: 'bg-orange-100 text-orange-700' };
        return null;
    };
    const badge = getBadge();

    return (
        <div className={`
            relative flex flex-col w-[260px] p-4 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md
            ${data.isRoot ? 'bg-stone-900 text-white border-none' : 'border-2 bg-white'} 
            ${data.statusStyle || 'border-stone-200'}
        `}>
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />
            
            {/* Badge (Story/Fact) */}
            {badge && !data.isRoot && (
                <div className={`absolute -top-3 left-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}>
                    {badge.label}
                </div>
            )}

            {/* Content */}
            <div className="flex flex-col gap-1 items-center text-center">
                <span className={`font-bold text-sm leading-snug ${data.isRoot ? 'text-white' : 'text-stone-800'}`}>
                    {data.isImproved ? (data.headline || data.label) : data.label}
                </span>
                
                {/* Elaboration Preview for AI Mode */}
                {data.isImproved && data.elaboration && (
                    <span className="text-[10px] text-stone-500 leading-tight line-clamp-2 mt-1 px-2">
                        {data.elaboration}
                    </span>
                )}
            </div>

            {/* Visual Cue for Interaction */}
            {((!data.isImproved && data.critique) || (data.isImproved && data.elaboration)) && !data.isRoot && (
                <div className="mt-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />
        </div>
    );
});

const nodeTypes = {
    pyramidNode: PyramidNode,
};

// --- 2. MAIN COMPONENT ---
const PyramidFeedbackContent: React.FC<PyramidFeedbackProps> = ({ analysis, onRetry, audioUrl }) => {
  const { structure, improved_structure, feedback, transcription, improvements, detected_framework } = analysis;
  const [viewMode, setViewMode] = useState<'user' | 'ai'>('user');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);

  // Generate Data based on View Mode
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
      const targetStructure = viewMode === 'ai' && improved_structure ? improved_structure : structure;
      return generateFlowData(targetStructure, viewMode === 'ai');
  }, [structure, improved_structure, viewMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when viewMode changes
  useEffect(() => {
      setNodes(initialNodes);
      setEdges(initialEdges);
      setSelectedNodeId(null);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
      if ((viewMode === 'user' && node.data.critique) || (viewMode === 'ai' && node.data.elaboration)) {
          setSelectedNodeId(node.id);
      } else {
          setSelectedNodeId(null);
      }
  };

  const selectedNodeData = useMemo(() => {
      if (!selectedNodeId) return null;
      const node = nodes.find(n => n.id === selectedNodeId);
      return node?.data;
  }, [selectedNodeId, nodes]);

  // MiniMap Handlers
  const showMap = () => setIsMapVisible(true);
  const hideMap = () => setIsMapVisible(false);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header / Score */}
      <div className="text-center space-y-6">
        <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-stone-900 text-white text-3xl font-serif font-bold shadow-xl ring-4 ring-stone-100">
            {feedback?.score || 0}
            </div>
            <h2 className="text-2xl font-serif text-stone-800">Communication Logic Score</h2>
            
            {/* Detected Framework Badge */}
            {detected_framework && (
                <div className="inline-block mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-100">
                    Detected: {detected_framework.replace(/_/g, ' ')}
                </div>
            )}
        </div>

        {/* MODE TOGGLE */}
        <div className="inline-flex bg-stone-100 p-1 rounded-full border border-stone-200 shadow-inner">
            <button
                onClick={() => setViewMode('user')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    viewMode === 'user' 
                    ? 'bg-white text-stone-900 shadow-sm' 
                    : 'text-stone-500 hover:text-stone-700'
                }`}
            >
                My Logic
            </button>
            <button
                onClick={() => setViewMode('ai')}
                disabled={!improved_structure}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    viewMode === 'ai' 
                    ? 'bg-white text-sky-700 shadow-sm' 
                    : 'text-stone-500 hover:text-stone-700 disabled:opacity-50'
                }`}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                AI Improved
            </button>
        </div>
      </div>

      {/* GRAPH CONTAINER */}
      <div className="relative h-[650px] w-full">
          <div className="absolute inset-0 bg-stone-50 rounded-3xl border border-stone-200 shadow-inner overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onMoveStart={showMap}
                onMoveEnd={hideMap}
                onNodeDragStart={showMap}
                onNodeDragStop={hideMap}
                fitView
                minZoom={0.5}
                maxZoom={1.5}
                attributionPosition="bottom-left"
            >
                <Background color="#E7E5E4" gap={20} size={1} />
                <Controls className="bg-white shadow-lg border border-stone-100 rounded-lg overflow-hidden" />
                <div className={`transition-opacity duration-300 ${isMapVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <MiniMap position="top-right" className="bg-white border border-stone-100 rounded-lg shadow-lg m-4" />
                </div>
            </ReactFlow>
            
            {/* LEGEND */}
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-stone-200 shadow-sm">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Graph Legend</p>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div><span className="text-[10px] text-stone-600">Strong Logic</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[10px] text-stone-600">Weak Logic</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">STORY</span>
                        <span className="text-[10px] text-stone-500">Narrative</span>
                    </div>
                </div>
            </div>

            {/* CRITIQUE / ELABORATION PANEL */}
            {selectedNodeData && (
                <div className="absolute bottom-4 right-4 z-20 w-80 bg-white rounded-xl shadow-xl border border-stone-200 p-5 animate-in slide-in-from-right-4 fade-in duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${viewMode === 'ai' ? 'bg-sky-100' : 'bg-amber-100'}`}>
                                {viewMode === 'ai' ? (
                                    <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : (
                                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                )}
                            </div>
                            <span className="font-bold text-stone-800 text-sm">
                                {viewMode === 'ai' ? 'Detailed Elaboration' : 'Coach Critique'}
                            </span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }} className="text-stone-400 hover:text-stone-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <p className="text-sm text-stone-600 leading-relaxed">
                        {viewMode === 'ai' ? selectedNodeData.elaboration : selectedNodeData.critique}
                    </p>
                </div>
            )}
          </div>
      </div>

      {/* FEEDBACK & TRANSCRIPT SECTIONS (Keep as is) */}
      <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
               <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">Coach's Feedback</h3>
               <div className="space-y-4">
                   {/* Strengths */}
                   <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                       <h4 className="text-green-800 font-semibold text-sm mb-2">Strengths</h4>
                       <ul className="list-disc list-inside text-sm text-green-900 space-y-1">
                           {feedback?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>No feedback available.</li>}
                       </ul>
                   </div>
                   {/* Weaknesses */}
                   <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                       <h4 className="text-amber-800 font-semibold text-sm mb-2">Areas for Improvement</h4>
                       <ul className="list-disc list-inside text-sm text-amber-900 space-y-1">
                           {feedback?.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>No feedback available.</li>}
                       </ul>
                   </div>
                   {/* Suggestions */}
                   <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                       <h4 className="text-stone-800 font-semibold text-sm mb-2">Actionable Tips</h4>
                       <ul className="list-disc list-inside text-sm text-stone-700 space-y-1">
                           {feedback?.suggestions?.map((s, i) => <li key={i}>{s}</li>) || <li>No feedback available.</li>}
                       </ul>
                   </div>
               </div>
          </div>

          <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-stone-200 pb-2">
                  <h3 className="text-lg font-bold text-stone-800 font-serif">Transcription</h3>
              </div>
              {audioUrl && (
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex items-center gap-3 mb-2">
                      <audio controls src={audioUrl} className="w-full h-8" />
                  </div>
              )}
              <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm max-h-[500px] overflow-y-auto">
                  <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{transcription}</p>
              </div>
          </div>
      </div>

      <div className="flex justify-center pt-8">
          <button 
            onClick={onRetry}
            className="bg-stone-900 text-white w-24 h-24 rounded-full flex items-center justify-center hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 group"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
            </svg>
          </button>
      </div>

    </div>
  );
};

const PyramidFeedback: React.FC<PyramidFeedbackProps> = (props) => (
    <ReactFlowProvider>
        <PyramidFeedbackContent {...props} />
    </ReactFlowProvider>
);

export default PyramidFeedback;