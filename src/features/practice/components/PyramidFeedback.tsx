import PerformanceCard from '@/features/practice/components/PerformanceCard';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MiniMap, Node, Position, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { useTTS } from '../../../shared/hooks/useTTS';
import { useAudioPlayer } from '../../../shared/hooks/useAudioPlayer';
import { checkAnonymousPracticeLimit } from '../../../shared/services/usageTracking';
import { SpeechAnalysisResult } from '../../../shared/types';
import { generateFlowData } from '../utils/transformPyramid';
import AudioRecorder from './AudioRecorder';

// --- WORD WITH TOOLTIP COMPONENT ---
const WordWithTooltip = ({ word, onSpeak, isSpeakingThis }: {
    word: { word: string; status: 'good' | 'needs-work' | 'unclear'; feedback?: string };
    onSpeak?: (text: string) => void;
    isSpeakingThis?: boolean;
}) => {
    const wordRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
    const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
    const [tapped, setTapped] = useState(false);

    const updateTooltipPosition = useCallback(() => {
        if (!wordRef.current || !tooltipRef.current) return;
        const wordRect = wordRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const padding = 16;
        let left = wordRect.left + wordRect.width / 2 - tooltipRect.width / 2;
        if (left < padding) left = padding;
        else if (left + tooltipRect.width > viewportWidth - padding) left = viewportWidth - padding - tooltipRect.width;
        const top = wordRect.top - tooltipRect.height - 8;
        const wordCenterX = wordRect.left + wordRect.width / 2;
        const arrowLeft = wordCenterX - left;

        setTooltipStyle({ left: `${left}px`, top: `${top}px`, transform: 'none' });
        setArrowStyle({ left: `${arrowLeft}px`, transform: 'translateX(-50%)' });
    }, []);

    const handleMouseEnter = () => updateTooltipPosition();

    const handleClick = () => {
        // Recalculate position on tap (mouseenter doesn't fire reliably on touch)
        updateTooltipPosition();
        setTapped(true);
        if (onSpeak) onSpeak(word.word);
    };

    // Hide tooltip when speaking stops
    useEffect(() => {
        if (!isSpeakingThis) setTapped(false);
    }, [isSpeakingThis]);

    return (
        <div
            ref={wordRef}
            onMouseEnter={handleMouseEnter}
            onClick={handleClick}
            className={`group relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                word.status === 'good' ? 'bg-green-100 text-green-800 border border-green-200' :
                word.status === 'needs-work' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                'bg-red-100 text-red-800 border border-red-200'
            } ${isSpeakingThis ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
        >
            {word.word}
            {word.status === 'good' && <span className="ml-1">✓</span>}
            {isSpeakingThis && (
                <span className="ml-1 inline-flex items-center gap-[2px]">
                    <span className="w-[3px] h-[10px] bg-current rounded-full animate-[soundbar_0.5s_ease-in-out_infinite_alternate]" />
                    <span className="w-[3px] h-[14px] bg-current rounded-full animate-[soundbar_0.5s_ease-in-out_0.15s_infinite_alternate]" />
                    <span className="w-[3px] h-[8px] bg-current rounded-full animate-[soundbar_0.5s_ease-in-out_0.3s_infinite_alternate]" />
                </span>
            )}
            {word.feedback && (
                <div
                    ref={tooltipRef}
                    style={{
                        ...tooltipStyle,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.48))',
                        backdropFilter: 'blur(40px) saturate(1.8)',
                        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
                    }}
                    className={`fixed px-3 py-2 text-stone-800 text-xs rounded-2xl transition-opacity z-50 pointer-events-none max-w-[calc(100vw-32px)] ${
                        tapped ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                >
                    {word.feedback}
                    <div style={{ ...arrowStyle, borderTopColor: 'rgba(255,255,255,0.6)' }} className="absolute top-full border-4 border-transparent"></div>
                </div>
            )}
        </div>
    );
};

// --- NODE COMPONENT ---
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

interface PyramidFeedbackProps {
    analysis: SpeechAnalysisResult;
    onRetry: () => void;
    audioUrl?: string | null;
    startRetake: (audioData: string, mimeType?: string, referenceTranscript?: string) => void;
    level: string;
    nativeLang: string;
    targetLang: string;
    preFetchedLabels: any;
    showRetry?: boolean;
    onRequireAuth?: () => void;
}

const PyramidFeedbackContent: React.FC<PyramidFeedbackProps> = ({
    analysis,
    onRetry,
    audioUrl,
    startRetake,
    level,
    nativeLang,
    targetLang,
    preFetchedLabels,
    showRetry = true,
    onRequireAuth,
}) => {
  const { structure, improved_structure, improved_transcription, feedback, transcription, detected_framework, improvements, pronunciation } = analysis;
  const [viewMode, setViewMode] = useState<'user' | 'ai'>('user');
  const [transcriptViewMode, setTranscriptViewMode] = useState<'user' | 'ai'>('user');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);
  const [isRecorderMinimized, setIsRecorderMinimized] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const { fitView } = useReactFlow();
  const { speak, stop: stopTTS, togglePlayPause: toggleTTS, seek: seekTTS, isSpeaking, isPaused: isTTSPaused, progress: ttsProgress, currentTime: ttsCurrentTime, duration: ttsDuration, formatTime: formatTTSTime, currentText: ttsCurrentText } = useTTS(targetLang);
  const { stop: stopUserAudio, togglePlayPause: toggleUserAudio, seek: seekUserAudio, isPlaying: userAudioPlaying, progress: userProgress, currentTime: userCurrentTime, duration: userDuration, formatTime: formatUserTime } = useAudioPlayer(audioUrl);

  const labels = preFetchedLabels || {
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
    aiVoice: 'AI Voice',
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
    scoreKeepGrowing: 'Keep Growing',
    pronunciationIntonation: 'Pronunciation & Intonation',
    overallPronunciation: 'Overall Pronunciation',
    intonation: 'Intonation',
    wordPronunciation: 'Word Pronunciation',
    pronunciationNativeLike: 'native-like',
    pronunciationClear: 'clear',
    pronunciationAccented: 'accented',
    pronunciationNeedsWork: 'needs work',
    intonationNatural: 'natural',
    intonationFlat: 'flat',
    intonationMonotone: 'monotone',
    intonationOverlyExpressive: 'overly-expressive',
    pronunciationGood: 'Good',
    pronunciationNeedsWorkLabel: 'Needs Work',
    pronunciationUnclear: 'Unclear'
  };


  const getOverallPronunciationLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'native-like': labels.pronunciationNativeLike,
      'clear': labels.pronunciationClear,
      'accented': labels.pronunciationAccented,
      'needs-work': labels.pronunciationNeedsWork,
    };
    return statusMap[status] || status.replace('-', ' ');
  };

  const getIntonationPatternLabel = (pattern: string) => {
    const patternMap: Record<string, string> = {
      'natural': labels.intonationNatural,
      'flat': labels.intonationFlat,
      'monotone': labels.intonationMonotone,
      'overly-expressive': labels.intonationOverlyExpressive,
    };
    return patternMap[pattern] || pattern;
  };
    // MiniMap Handlers
  const showMap = () => setIsMapVisible(true);
  const hideMap = () => setIsMapVisible(false);


  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Stop audio when switching between tabs
  useEffect(() => {
      stopTTS();
      stopUserAudio();
  }, [transcriptViewMode, stopTTS, stopUserAudio]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
      const targetStructure = viewMode === 'ai' && improved_structure ? improved_structure : structure;
      const framework = viewMode === 'ai' ? (improved_structure?.recommended_framework || detected_framework || '') : (detected_framework || '');
      return generateFlowData(targetStructure, viewMode === 'ai', isMobile, labels, framework);
  }, [structure, improved_structure, viewMode, isMobile, labels, detected_framework]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); setSelectedNodeId(null); setTimeout(() => fitView({ padding: 0.1, duration: 800 }), 100); }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => { if ((viewMode === 'user' && node.data.critique) || (viewMode === 'ai' && node.data.elaboration)) setSelectedNodeId(node.id); else setSelectedNodeId(null); };
  const selectedNodeData = useMemo(() => { if (!selectedNodeId) return null; return nodes.find(n => n.id === selectedNodeId)?.data; }, [selectedNodeId, nodes]);

  // Use improved_transcription if available (fluent AI-generated speech),
  // fallback to concatenated structure for backward compatibility
  const aiImprovedText = useMemo(() => {
    // Prefer the fluent improved_transcription from the API
    if (improved_transcription) return improved_transcription;

    // Fallback: concatenate improved_structure for older data
    if (!improved_structure) return null;
    const parts: string[] = [];
    if (improved_structure.conclusion) {
      parts.push(improved_structure.conclusion);
    }
    if (improved_structure.arguments && improved_structure.arguments.length > 0) {
      improved_structure.arguments.forEach((arg) => {
        if (arg.headline) parts.push(arg.headline);
        if (arg.elaboration) parts.push(arg.elaboration);
        if (arg.sub_points) {
          arg.sub_points.forEach((sub) => {
            if (sub.headline) parts.push(sub.headline);
            if (sub.elaboration) parts.push(sub.elaboration);
          });
        }
      });
    }
    return parts.join(' ');
  }, [improved_transcription, improved_structure]);

  // Pass the improved transcription as reference so backend knows this is a "practice" session
  // and should focus on delivery scoring, not content restructuring
  const handleRetakeComplete = (audioData: string, mimeType?: string) => {
    startRetake(audioData, mimeType, aiImprovedText || undefined);
    setShowRetakeModal(false);
  };
  const handleOpenRetake = async () => {
    if (onRequireAuth) {
      const practiceStatus = await checkAnonymousPracticeLimit();
      if (!practiceStatus.allowed) { onRequireAuth(); return; }
    }
    setShowRetakeModal(true);
    setIsRecorderMinimized(false);
  };

  const getContainerClasses = () => {
      const baseClasses = "fixed z-50 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl border border-stone-200 overflow-hidden";
      if (isRecorderMinimized) return `${baseClasses} bg-stone-900 rounded-full py-3 ` + (isMobile ? "bottom-6 left-4 right-4" : "bottom-10 left-1/2 -translate-x-1/2 w-[600px]");
      const expandedBase = `${baseClasses} bg-white`;
      return isMobile ? `${expandedBase} bottom-0 left-0 right-0 rounded-t-3xl pb-8 pt-4` : `${expandedBase} top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] p-8 rounded-3xl`;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 md:space-y-12 relative pb-32">
      

      {/* INTEGRATED GRAPH COMPONENT */}
      <div className="bg-stone-50 rounded-[32px] border border-stone-200 shadow-inner overflow-hidden flex flex-col h-[500px] md:h-[750px]">
          
          {/* HEADER AREA */}
          <div className="bg-white/70 backdrop-blur-md border-b border-stone-200 px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4 z-20">
              <div className="flex flex-col items-center md:items-start">
                  <h2 className="text-base md:text-xl font-serif font-black text-stone-800 tracking-tight">
                    {labels.communicationLogic}
                  </h2>
              </div>

              <div className="bg-stone-200/50 p-1 rounded-full border border-stone-100 inline-flex shadow-inner">
                  <button onClick={() => setViewMode('user')} className={`px-6 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'user' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                      {labels.myLogic}
                  </button>
                  <button onClick={() => setViewMode('ai')} disabled={!improved_structure} className={`px-6 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'ai' ? 'bg-white text-sky-700 shadow-sm' : 'text-stone-400 disabled:opacity-30'}`}>
                      {labels.aiImproved}
                  </button>
              </div>
          </div>

          {/* CANVAS AREA */}
          <div className="flex-1 relative touch-none overflow-hidden">
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                nodeTypes={nodeTypes} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onNodeClick={onNodeClick} 
                onMoveStart={() => setIsMapVisible(true)} 
                onMoveEnd={() => setIsMapVisible(false)} 
                fitView 
                minZoom={0.2} 
                maxZoom={2} 
                panOnDrag={true} 
                zoomOnPinch={true}
            >
                <Background color="#E7E5E4" gap={isMobile ? 12 : 20} size={1} />
                
                {/* LEGEND - Top Left */}
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-2 rounded-xl border border-stone-200 shadow-sm pointer-events-auto">
                    <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2 border-b border-stone-100 pb-1">{labels.legend}</p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                          <span className="text-[10px] font-bold text-stone-600">{labels.strong}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                          <span className="text-[10px] font-bold text-stone-600">{labels.weak}</span>
                        </div>
                    </div>
                </div>

                {/* RESTORED MINIMAP */}
                <div className={`hidden md:block transition-opacity duration-300 ${isMapVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <MiniMap position="top-right" className="bg-white border border-stone-100 rounded-xl shadow-lg m-4" />
                </div>

                {/* NODE MESSAGE BOX - Restored & Floating above Mask */}
                {selectedNodeData && (
                    <div className="absolute bottom-14 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-stone-200 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300 z-30">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`p-1 rounded-full ${viewMode === 'ai' ? 'bg-sky-100' : 'bg-amber-100'}`}>
                                    <svg className={`w-3 h-3 ${viewMode === 'ai' ? 'text-sky-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="font-bold text-stone-800 text-xs md:text-sm">
                                    {viewMode === 'ai' ? labels.elaboration : labels.critique}
                                </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }} className="text-stone-400 hover:text-stone-600 p-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-xs md:text-sm text-stone-600 leading-relaxed max-h-32 overflow-y-auto">
                            {viewMode === 'ai' ? selectedNodeData.elaboration : selectedNodeData.critique}
                        </p>
                    </div>
                )}

                {/* MASKING BADGE */}
                <div className="absolute bottom-0 right-0 z-20 bg-stone-50 px-4 py-2 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-stone-200 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">Bilibala</span>
                    </div>
                </div>

                {!isMobile && <Controls className="bg-white/90 shadow-lg border border-stone-200 rounded-xl overflow-hidden m-4" />}
            </ReactFlow>
          </div>
      </div>

      {/*  LANGUAGE POLISH & ALTERNATIVES SECTION */}
      {improvements && improvements.length > 0 && (
          <div className="space-y-6">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">{labels.languagePolish}</h3>
              <div className="grid gap-6">
                  {improvements.map((imp, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-[24px] border border-stone-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-1 space-y-2">
                              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider px-2 py-0.5 bg-red-50 rounded-full">{labels.original}</span>
                              <p className="text-stone-600 italic leading-relaxed text-sm">"{imp.original}"</p>
                          </div>
                          <div className="hidden md:flex items-center self-center text-stone-300">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                          </div>
                          <div className="flex-1 space-y-2">
                              <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider px-2 py-0.5 bg-green-50 rounded-full">{labels.betterAlternative}</span>
                              <p className="text-stone-800 font-medium leading-relaxed text-sm">"{imp.improved}"</p>
                              {imp.explanation && <p className="text-xs text-stone-400 mt-2 bg-stone-50 p-2 rounded-lg">{imp.explanation}</p>}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* POC: Pronunciation & Intonation Analysis */}
      {pronunciation && (
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">
                  {labels.pronunciationIntonation}
              </h3>

              {/* Overall Rating & Intonation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{labels.overallPronunciation}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              pronunciation.overall === 'native-like' ? 'bg-green-100 text-green-700' :
                              pronunciation.overall === 'clear' ? 'bg-blue-100 text-blue-700' :
                              pronunciation.overall === 'accented' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                          }`}>
                              {getOverallPronunciationLabel(pronunciation.overall)}
                          </span>
                      </div>
                      <p className="text-sm text-stone-600">{pronunciation.summary}</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{labels.intonation}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              pronunciation.intonation.pattern === 'natural' ? 'bg-green-100 text-green-700' :
                              pronunciation.intonation.pattern === 'flat' || pronunciation.intonation.pattern === 'monotone' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                          }`}>
                              {getIntonationPatternLabel(pronunciation.intonation.pattern)}
                          </span>
                      </div>
                      <p className="text-sm text-stone-600">{pronunciation.intonation.feedback}</p>
                  </div>
              </div>

              {/* Pronunciation Heatmap & Restored Legend */}
              <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block mb-3">{labels.wordPronunciation}</span>
                  <div className="flex flex-wrap gap-2">
                      {pronunciation.words.map((w, idx) => (
                          <WordWithTooltip key={idx} word={w} onSpeak={speak} isSpeakingThis={isSpeaking && ttsCurrentText === w.word} />
                      ))}
                  </div>
                  
                  {/* RESTORED LABELS LEGEND */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone-100">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                        <span className="text-[10px] text-stone-500 font-medium">{labels.pronunciationGood}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200"></div>
                        <span className="text-[10px] text-stone-500 font-medium">{labels.pronunciationNeedsWorkLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                        <span className="text-[10px] text-stone-500 font-medium">{labels.pronunciationUnclear}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {/* Stats and Transcription */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">{labels.coachFeedback}</h3>
              <div className="space-y-4">
                 {/* PerformanceCard */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <PerformanceCard
                        score={feedback?.score || 0}
                        targetLang={targetLang}
                        nativeLang={nativeLang}
                        level={level}
                    />
                </div>
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
          <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <h3 className="text-lg font-bold text-stone-800 font-serif">{labels.transcription}</h3>
                  {aiImprovedText && (
                      <div className="bg-stone-200/50 p-0.5 rounded-full border border-stone-100 inline-flex shadow-inner">
                          <button
                              onClick={() => setTranscriptViewMode('user')}
                              className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${transcriptViewMode === 'user' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                          >
                              {labels.original}
                          </button>
                          <button
                              onClick={() => setTranscriptViewMode('ai')}
                              className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${transcriptViewMode === 'ai' ? 'bg-white text-sky-700 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                          >
                              {labels.aiImproved}
                          </button>
                      </div>
                  )}
              </div>
              {/* Audio Player - switches between user recording and AI TTS */}
              {transcriptViewMode === 'user' ? (
                  audioUrl && (
                      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden mb-2">
                          <div className="flex items-center px-3 py-2.5 gap-3">
                              <button
                                  onClick={toggleUserAudio}
                                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${userAudioPlaying ? 'bg-stone-500 hover:bg-stone-600' : 'bg-stone-100 hover:bg-stone-200'}`}
                              >
                                  {userAudioPlaying ? (
                                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                          <rect x="6" y="4" width="4" height="16" rx="1" />
                                          <rect x="14" y="4" width="4" height="16" rx="1" />
                                      </svg>
                                  ) : (
                                      <svg className="w-4 h-4 text-stone-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M8 5v14l11-7z" />
                                      </svg>
                                  )}
                              </button>
                              <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-stone-700">{labels.yourRecording}</span>
                                          {userAudioPlaying && (
                                              <div className="flex items-center gap-0.5">
                                                  {[3,5,4,6,3,5].map((h, i) => (
                                                      <div key={i} className="w-0.5 bg-stone-400 rounded-full animate-pulse" style={{ height: `${h * 2}px`, animationDelay: `${i * 0.08}s` }} />
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <span className="text-[10px] text-stone-400 font-medium tabular-nums">
                                          {formatUserTime(userCurrentTime)} / {userDuration > 0 ? formatUserTime(userDuration) : '--:--'}
                                      </span>
                                  </div>
                                  {/* Clickable + touch-draggable progress bar */}
                                  <div
                                      className="h-2 bg-stone-100 rounded-full overflow-hidden cursor-pointer group touch-none"
                                      onClick={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.clientX - rect.left) / rect.width) * 100;
                                          seekUserAudio(Math.max(0, Math.min(100, percent)));
                                      }}
                                      onTouchStart={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                          seekUserAudio(Math.max(0, Math.min(100, percent)));
                                      }}
                                      onTouchMove={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                          seekUserAudio(Math.max(0, Math.min(100, percent)));
                                      }}
                                  >
                                      <div
                                          className="h-full bg-gradient-to-r from-stone-400 to-stone-500 rounded-full transition-all duration-100 relative"
                                          style={{ width: `${userProgress}%` }}
                                      >
                                          {/* Playhead dot */}
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-stone-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )
              ) : (
                  aiImprovedText && (
                      <div className="bg-white rounded-xl border border-sky-200 shadow-sm overflow-hidden mb-2">
                          <div className="flex items-center px-3 py-2.5 gap-3">
                              <button
                                  onClick={() => {
                                      if (isSpeaking || isTTSPaused) {
                                          toggleTTS();
                                      } else {
                                          speak(aiImprovedText);
                                      }
                                  }}
                                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isSpeaking ? 'bg-sky-500 hover:bg-sky-600' : 'bg-sky-100 hover:bg-sky-200'}`}
                              >
                                  {isSpeaking ? (
                                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                          <rect x="6" y="4" width="4" height="16" rx="1" />
                                          <rect x="14" y="4" width="4" height="16" rx="1" />
                                      </svg>
                                  ) : (
                                      <svg className="w-4 h-4 text-sky-600 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M8 5v14l11-7z" />
                                      </svg>
                                  )}
                              </button>
                              <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-sky-700">{labels.aiVoice}</span>
                                          {isSpeaking && (
                                              <div className="flex items-center gap-0.5">
                                                  {[3,5,4,6,3,5].map((h, i) => (
                                                      <div key={i} className="w-0.5 bg-sky-400 rounded-full animate-pulse" style={{ height: `${h * 2}px`, animationDelay: `${i * 0.08}s` }} />
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                      <span className="text-[10px] text-sky-400 font-medium tabular-nums">
                                          {formatTTSTime(ttsCurrentTime)} / {ttsDuration > 0 ? formatTTSTime(ttsDuration) : '--:--'}
                                      </span>
                                  </div>
                                  {/* Clickable + touch-draggable progress bar */}
                                  <div
                                      className="h-2 bg-sky-100 rounded-full overflow-hidden cursor-pointer group touch-none"
                                      onClick={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.clientX - rect.left) / rect.width) * 100;
                                          seekTTS(Math.max(0, Math.min(100, percent)));
                                      }}
                                      onTouchStart={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                          seekTTS(Math.max(0, Math.min(100, percent)));
                                      }}
                                      onTouchMove={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          const percent = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                          seekTTS(Math.max(0, Math.min(100, percent)));
                                      }}
                                  >
                                      <div
                                          className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-100 relative"
                                          style={{ width: `${ttsProgress}%` }}
                                      >
                                          {/* Playhead dot */}
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )
              )}
              <div className={`leading-relaxed text-sm p-4 rounded-lg min-h-[150px] ${transcriptViewMode === 'ai' ? 'bg-sky-50 text-sky-900 border border-sky-100' : 'bg-stone-50 text-stone-600'}`}>
                  {transcriptViewMode === 'ai' && aiImprovedText ? aiImprovedText : transcription}
              </div>
          </div>

        

      </div>
         
              

      {showRetry && !showRetakeModal && (
          <div className="flex justify-center pt-8">
              <button onClick={handleOpenRetake} className="bg-stone-900 text-white w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 group">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              </button>
          </div>
      )}

      {/* --- UNIFIED RETAKE MODAL --- */}
      {showRetry && showRetakeModal && (
        <div className={getContainerClasses()}>
            <div className={`absolute top-4 right-4 flex items-center gap-2 z-50 transition-opacity duration-200 ${isRecorderMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <button onClick={() => setIsRecorderMinimized(true)} className="p-1 text-stone-400 hover:text-stone-600 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
                </button>
                <button onClick={() => setShowRetakeModal(false)} className="p-1 text-stone-400 hover:text-red-500 transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className={`w-full h-full ${isRecorderMinimized ? '' : (isMobile ? 'px-6 mt-8' : 'mt-4')}`}>
                <AudioRecorder
                    key="universal-recorder"
                    onRecordingComplete={handleRetakeComplete}
                    onCancel={() => setShowRetakeModal(false)}
                    isMinimized={isRecorderMinimized}
                    onToggleMinimize={() => setIsRecorderMinimized(!isRecorderMinimized)}
                    defaultTitle={labels.recordAnswer}
                    labels={labels}
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