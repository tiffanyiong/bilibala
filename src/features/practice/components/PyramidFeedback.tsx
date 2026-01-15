import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MiniMap, Node, Position, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { SpeechAnalysisResult } from '../../../shared/types';
import { generateFlowData } from '../utils/transformPyramid';
import AudioRecorder from './AudioRecorder';

// --- NODE COMPONENT (Unchanged) ---
const PyramidNode = memo(({ data }: { data: any }) => {
    const getBadge = () => {
        const labels = data.labels || {};
        if (data.type === 'story') return { label: `📖 ${labels.story || 'Story'}`, bg: 'bg-purple-100 text-purple-700' };
        if (data.type === 'fact') return { label: `📊 ${labels.fact || 'Fact'}`, bg: 'bg-blue-100 text-blue-700' };
        if (data.type === 'opinion') return { label: `💭 ${labels.opinion || 'Opinion'}`, bg: 'bg-orange-100 text-orange-700' };
        return null;
    };
    const badge = getBadge();
    const isMobile = data.isMobile;
    return (
        <div className={`relative flex flex-col ${isMobile ? 'w-[140px] p-2' : 'w-[260px] p-4'} rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${data.isRoot ? 'bg-stone-900 text-white border-none' : 'border-2 bg-white'} ${data.statusStyle || 'border-stone-200'} ${((!data.isImproved && data.critique) || (data.isImproved && data.elaboration)) ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-200' : ''}`}>
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-none" />
            {badge && !data.isRoot && <div className={`absolute -top-2.5 left-3 px-1.5 py-0.5 rounded-full ${isMobile ? 'text-[7px]' : 'text-[10px]'} font-bold uppercase tracking-wider ${badge.bg}`}>{badge.label}</div>}
            <div className="flex flex-col gap-1 items-center text-center">
                <span className={`font-bold leading-snug ${isMobile ? 'text-[10px]' : 'text-sm'} ${data.isRoot ? 'text-white' : 'text-stone-800'}`}>{data.isImproved ? (data.headline || data.label) : data.label}</span>
                {data.isImproved && data.elaboration && <div className={`bg-sky-50 border border-sky-100 rounded-lg w-full mt-1 ${isMobile ? 'p-1' : 'p-2'}`}><p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-sky-800 font-medium italic font-serif leading-relaxed`}>"{data.elaboration}"</p></div>}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-none" />
        </div>
    );
});
const nodeTypes = { pyramidNode: PyramidNode };

// --- DRAGGABLE WRAPPER ---
const DraggableWrapper = ({ children, isMinimized, onClose, onMinimize }: any) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    useEffect(() => { if (typeof window !== 'undefined') setPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); }, []);
    const handleMouseDown = (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('.drag-handle')) { setIsDragging(true); dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }; } };
    useEffect(() => { const handleMouseMove = (e: MouseEvent) => { if (!isDragging) return; setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); }; const handleMouseUp = () => setIsDragging(false); if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); } return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }, [isDragging]);
    if (isMinimized) return <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-[600px] bg-stone-900 rounded-full shadow-2xl py-3 animate-in slide-in-from-bottom-4">{children}</div>;
    return (
        <div style={{ position: 'fixed', left: position.x, top: position.y, transform: 'translate(-50%, -50%)', zIndex: 50 }} className="bg-white p-8 rounded-3xl shadow-2xl w-[500px] animate-in zoom-in-95 duration-200 border border-stone-200" onMouseDown={handleMouseDown}>
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
                <button onClick={onMinimize} className="p-1 text-stone-400 hover:text-stone-600 transition-colors"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg></button>
                <button onClick={onClose} className="p-1 text-stone-400 hover:text-red-500 transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="drag-handle absolute top-0 left-0 right-0 h-10 cursor-move flex justify-center items-start group rounded-t-3xl"><div className="w-12 h-1.5 bg-stone-200 rounded-full group-hover:bg-stone-300 transition-colors mt-3" /></div>
            <div className="mt-4">{children}</div>
        </div>
    );
};

interface PyramidFeedbackProps { 
    analysis: SpeechAnalysisResult; 
    onRetry: () => void; 
    audioUrl?: string | null; 
    startRetake: (audioData: string) => void; 
    level: string; 
    nativeLang: string; 
    targetLang: string; 
    preFetchedLabels: any; // Receive labels from parent
}

const PyramidFeedbackContent: React.FC<PyramidFeedbackProps> = ({ 
    analysis, 
    onRetry, 
    audioUrl, 
    startRetake, 
    level, 
    nativeLang, 
    targetLang, 
    preFetchedLabels // Destructure passed labels
}) => {
  const { structure, improved_structure, feedback, transcription, detected_framework, improvements } = analysis;
  const [viewMode, setViewMode] = useState<'user' | 'ai'>('user');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [isRecorderMinimized, setIsRecorderMinimized] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const { fitView } = useReactFlow();

  // --- CHANGED: Use prop directly ---
  // No internal fetching, no state, no loading spinner needed here.
  const labels = preFetchedLabels || {
    // Basic fallback just in case, though parent should handle this
    communicationLogic: 'Communication Logic',
    detected: 'Detected',
    myLogic: 'My Logic',
    aiImproved: 'AI Improved',
    legend: 'Legend',
    strong: 'Strong',
    weak: 'Weak',
    elaboration: 'Elaboration',
    critique: 'Critique',
    languagePolish: 'Language Polish & Alternatives',
    original: 'Original',
    betterAlternative: 'Better Alternative',
    coachFeedback: "Coach's Feedback",
    strengths: 'Strengths',
    areasForImprovement: 'Areas for Improvement',
    actionableTips: 'Actionable Tips',
    transcription: 'Transcription',
    yourRecording: 'Your Recording',
    recordAnswer: 'Record Answer',
    reviewAnswer: 'Review Answer',
    takeYourTime: 'Take your time',
    tapAnalyze: 'Tap analyze when ready',
    tryIncorporateFeedback: 'Try to incorporate the feedback',
    microphoneError: 'Microphone Error',
    retake: 'Retake',
    story: 'Story',
    fact: 'Fact',
    opinion: 'Opinion',
    scorePerfect: 'Perfect!',
    scoreExcellent: 'Excellent',
    scoreGreatJob: 'Great Job',
    scoreGoodStart: 'Good Start',
    scoreKeepGrowing: 'Keep Growing'
  };

  // Helper to get score label and styling based on score value
  const getScoreDisplay = (score: number) => {
    if (score >= 95) return { label: labels.scorePerfect, style: 'bg-emerald-100 text-emerald-800 ring-emerald-200' };
    if (score >= 85) return { label: labels.scoreExcellent, style: 'bg-green-100 text-green-800 ring-green-200' };
    if (score >= 75) return { label: labels.scoreGreatJob, style: 'bg-blue-100 text-blue-800 ring-blue-200' };
    if (score >= 60) return { label: labels.scoreGoodStart, style: 'bg-amber-100 text-amber-800 ring-amber-200' };
    return { label: labels.scoreKeepGrowing, style: 'bg-stone-100 text-stone-700 ring-stone-200' };
  };

  const scoreDisplay = getScoreDisplay(feedback?.score || 0);

  // MiniMap Handlers
  const showMap = () => setIsMapVisible(true);
  const hideMap = () => setIsMapVisible(false);

  // Handle Resize
  useEffect(() => { 
      const checkMobile = () => setIsMobile(window.innerWidth < 768); 
      checkMobile(); 
      window.addEventListener('resize', checkMobile); 
      return () => window.removeEventListener('resize', checkMobile); 
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
      const targetStructure = viewMode === 'ai' && improved_structure ? improved_structure : structure;
      // Pass the appropriate framework: detected_framework for user's logic, recommended_framework for AI improved
      const framework = viewMode === 'ai'
        ? (improved_structure?.recommended_framework || detected_framework || '')
        : (detected_framework || '');
      return generateFlowData(targetStructure, viewMode === 'ai', isMobile, labels, framework);
  }, [structure, improved_structure, viewMode, isMobile, labels, detected_framework]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); setSelectedNodeId(null); setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 100); }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => { if ((viewMode === 'user' && node.data.critique) || (viewMode === 'ai' && node.data.elaboration)) setSelectedNodeId(node.id); else setSelectedNodeId(null); };
  const selectedNodeData = useMemo(() => { if (!selectedNodeId) return null; return nodes.find(n => n.id === selectedNodeId)?.data; }, [selectedNodeId, nodes]);
  const handleRetakeComplete = (audioData: string) => { startRetake(audioData); setShowRetakeModal(false); };
  const handleOpenRetake = () => { setShowRetakeModal(true); setIsRecorderMinimized(false); };

  // --- DYNAMIC STYLES HELPER ---
  const getContainerClasses = () => {
      const baseClasses = "fixed z-50 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl border border-stone-200 overflow-hidden";
      if (isRecorderMinimized) {
          return `${baseClasses} bg-stone-900 rounded-full py-3 ` + (isMobile ? "bottom-6 left-4 right-4" : "bottom-10 left-1/2 -translate-x-1/2 w-[600px]");
      }
      const expandedBase = `${baseClasses} bg-white`;
      if (isMobile) {
          return `${expandedBase} bottom-0 left-0 right-0 rounded-t-3xl pb-8 pt-4`;
      } else {
          return `${expandedBase} top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] p-8 rounded-3xl`;
      }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 md:space-y-12 relative pb-32">
      {/* Header and Controls */}
      <div className="text-center space-y-6">
        <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-serif text-stone-800">{labels.communicationLogic}</h2>
            {detected_framework && <div className="inline-block mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-100">{labels.detected}: {detected_framework.replace(/_/g, ' ')}</div>}
        </div>
        <div className="inline-flex bg-stone-100 p-1 rounded-full border border-stone-200 shadow-inner">
            <button onClick={() => setViewMode('user')} className={`px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-medium transition-all ${viewMode === 'user' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{labels.myLogic}</button>
            <button onClick={() => setViewMode('ai')} disabled={!improved_structure} className={`px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-medium transition-all ${viewMode === 'ai' ? 'bg-white text-sky-700 shadow-sm' : 'text-stone-500 disabled:opacity-50'}`}>{labels.aiImproved}</button>
        </div>
      </div>

      {/* Graph Area */}
      <div className="relative h-[400px] md:h-[650px] w-full touch-none">
          <div className="absolute inset-0 bg-stone-50 rounded-2xl md:rounded-3xl border border-stone-200 shadow-inner overflow-hidden">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} onMoveStart={showMap} onMoveEnd={hideMap} onNodeDragStart={showMap} onNodeDragStop={hideMap} fitView minZoom={0.2} maxZoom={2} panOnDrag={true} zoomOnPinch={true} panOnScroll={false} attributionPosition="bottom-left">
                <Background color="#E7E5E4" gap={isMobile ? 12 : 20} size={1} />
                {!isMobile && <Controls className="bg-white shadow-lg border border-stone-100 rounded-lg overflow-hidden" />}
                <div className={`transition-opacity duration-300 ${isMapVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <MiniMap position="top-right" className="bg-white border border-stone-100 rounded-lg shadow-lg m-4" />
                </div>
            </ReactFlow>

            {/* Legend */}
            <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 bg-white/90 backdrop-blur px-2 py-1.5 md:px-3 md:py-2 rounded-lg border border-stone-200 shadow-sm">
                <p className="text-[10px] md:text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">{labels.legend}</p>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-400"></div><span className="text-[9px] md:text-[10px] text-stone-600">{labels.strong}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div><span className="text-[9px] md:text-[10px] text-stone-600">{labels.weak}</span></div>
                </div>
            </div>

            {selectedNodeData && (
                <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-xl border border-stone-200 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300 z-20">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2"><div className={`p-1 rounded-full ${viewMode === 'ai' ? 'bg-sky-100' : 'bg-amber-100'}`}><svg className={`w-3 h-3 ${viewMode === 'ai' ? 'text-sky-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><span className="font-bold text-stone-800 text-xs md:text-sm">{viewMode === 'ai' ? labels.elaboration : labels.critique}</span></div>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }} className="text-stone-400 hover:text-stone-600 p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <p className="text-xs md:text-sm text-stone-600 leading-relaxed max-h-32 overflow-y-auto">{viewMode === 'ai' ? selectedNodeData.elaboration : selectedNodeData.critique}</p>
                </div>
            )}
          </div>
      </div>

      {/* Word Choice & Language Polish */}
      {improvements && improvements.length > 0 && (
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">{labels.languagePolish}</h3>
              <div className="grid gap-4">
                  {improvements.map((imp, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-1 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">{labels.original}</span>
                              <p className="text-stone-600 italic leading-relaxed text-sm">"{imp.original}"</p>
                          </div>

                          <div className="hidden md:flex items-center self-center text-stone-300">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                          </div>

                          <div className="flex-1 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider">{labels.betterAlternative}</span>
                              <p className="text-stone-800 font-medium leading-relaxed text-sm">"{imp.improved}"</p>
                              <p className="text-xs text-stone-400 mt-2">{imp.explanation}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Stats and Transcription */}
   
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">{labels.coachFeedback}</h3>
              <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                      <h4 className="text-green-800 font-semibold text-sm mb-2">{labels.strengths}</h4>
                      <ul className="list-disc list-inside text-sm text-green-900 space-y-1">{feedback?.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>No feedback available.</li>}</ul>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <h4 className="text-amber-800 font-semibold text-sm mb-2">{labels.areasForImprovement}</h4>
                      <ul className="list-disc list-inside text-sm text-amber-900 space-y-1">{feedback?.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>No feedback available.</li>}</ul>
                  </div>
                  <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                      <h4 className="text-stone-800 font-semibold text-sm mb-2">{labels.actionableTips}</h4>
                      <ul className="list-disc list-inside text-sm text-stone-700 space-y-1">{feedback?.suggestions?.map((s, i) => <li key={i}>{s}</li>) || <li>No feedback available.</li>}</ul>
                  </div>
              </div>
          </div>
          <div className="space-y-4 relative">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">{labels.transcription}</h3>

              {audioUrl && (
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex items-center gap-3 mb-2">
                      <div className="flex-1">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-0.5">{labels.yourRecording}</p>
                          <audio controls src={audioUrl} className="w-full h-6" />
                      </div>
                  </div>
              )}

              <p className="text-stone-600 leading-relaxed text-sm bg-stone-50 p-4 rounded-lg">{transcription}</p>
              {/* Score Stamp - positioned below transcript */}
              <div className="flex justify-center md:justify-end mt-4">
                  <div className="relative transform -rotate-12 mix-blend-multiply opacity-85">
                      <div className="border-[6px] border-red-900/90 text-red-900/90 px-3 py-3 rounded-lg font-serif font-black text-2xl md:text-4xl uppercase tracking-widest text-center shadow-none relative">
                          {/* Inner thin border common in rubber stamps */}
                          <div className="border-[3px] border-red-900/90 rounded px-4 py-2">
                              {scoreDisplay.label}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {!showRetakeModal && (
          <div className="flex justify-center pt-8">
              <button onClick={handleOpenRetake} className="bg-stone-900 text-white w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 group"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg></button>
          </div>
      )}

      {/* --- UNIFIED RETAKE MODAL --- */}
      {showRetakeModal && (
        <div className={getContainerClasses()}>
            
            {/* Header Controls (Minimize / Close) */}
            {/* Logic: Visible if NOT minimized. */}
            <div className={`absolute top-4 right-4 flex items-center gap-2 z-50 transition-opacity duration-200 ${isRecorderMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <button onClick={() => setIsRecorderMinimized(true)} className="p-1 text-stone-400 hover:text-stone-600 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button onClick={() => setShowRetakeModal(false)} className="p-1 text-stone-400 hover:text-red-500 transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Inner Content Wrapper */}
            {/* Logic: If mobile expanded, add specific padding. If desktop expanded, margin top. */}
            <div className={`w-full h-full ${isRecorderMinimized ? '' : (isMobile ? 'px-6 mt-8' : 'mt-4')}`}>
                <AudioRecorder
                    // STATIC KEY: Using a static string means React will NEVER unmount this
                    // component, regardless of isMobile or isRecorderMinimized changes.
                    key="universal-recorder"
                    onRecordingComplete={handleRetakeComplete}
                    onCancel={() => setShowRetakeModal(false)}
                    isMinimized={isRecorderMinimized}
                    onToggleMinimize={() => setIsRecorderMinimized(!isRecorderMinimized)}
                    defaultTitle={labels.recordAnswer}
                    labels={labels}
                    // Removed autoStart={false} as it's not in standard props, relying on default behavior
                />
            </div>
        </div>
      )}
      
    </div>
  );
};

const PyramidFeedback: React.FC<PyramidFeedbackProps> = (props) => (
    <ReactFlowProvider>
        <PyramidFeedbackContent {...props} />
    </ReactFlowProvider>
);

export default PyramidFeedback;