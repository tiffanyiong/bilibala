import React, { useMemo } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    MiniMap, 
    useNodesState, 
    useEdgesState 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SpeechAnalysisResult } from '../../../shared/types';
import { generateFlowData } from '../utils/transformPyramid';

interface PyramidFeedbackProps {
  analysis: SpeechAnalysisResult;
  onRetry: () => void;
  audioUrl?: string | null;
}

const PyramidFeedback: React.FC<PyramidFeedbackProps> = ({ analysis, onRetry, audioUrl }) => {
  const { structure, feedback, transcription, improvements } = analysis;

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => 
    generateFlowData(structure), 
  [structure]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header / Score */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-stone-900 text-white text-3xl font-serif font-bold shadow-xl ring-4 ring-stone-100">
          {feedback.score}
        </div>
        <h2 className="text-2xl font-serif text-stone-800">Communication Logic Score</h2>
        <p className="text-stone-500 max-w-lg mx-auto text-sm">
            We analyzed your speech using the Minto Pyramid Principle.
        </p>
      </div>

      {/* REACT FLOW GRAPH */}
      <div className="h-[600px] w-full bg-stone-50 rounded-3xl border border-stone-200 shadow-inner overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            attributionPosition="bottom-right"
          >
            <Background color="#E7E5E4" gap={16} size={1} />
            <Controls className="bg-white shadow-lg border border-stone-100 rounded-lg overflow-hidden" />
            <MiniMap 
                nodeStrokeColor={(n) => {
                    if (n.style?.borderColor) return n.style.borderColor as string;
                    return '#000';
                }}
                nodeColor={(n) => {
                    if (n.style?.backgroundColor) return n.style.backgroundColor as string;
                    return '#fff';
                }}
                className="bg-white border border-stone-100 rounded-lg shadow-lg"
            />
          </ReactFlow>
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-500">
              Interactive Logic Graph
          </div>
      </div>

      {/* Word Choice & Language Polish */}
      {improvements && improvements.length > 0 && (
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">Language Polish & Alternatives</h3>
              <div className="grid gap-4">
                  {improvements.map((imp, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                          <div className="flex-1 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Original</span>
                              <p className="text-stone-600 italic leading-relaxed text-sm">"{imp.original}"</p>
                          </div>
                          
                          <div className="hidden md:flex items-center self-center text-stone-300">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                          </div>

                          <div className="flex-1 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Better Alternative</span>
                              <p className="text-stone-800 font-medium leading-relaxed text-sm">"{imp.improved}"</p>
                              <p className="text-xs text-stone-400 mt-2">{imp.explanation}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Feedback & Transcription Grid */}
      <div className="grid md:grid-cols-2 gap-8">
          {/* Feedback Report */}
          <div className="space-y-6">
               <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">Coach's Feedback</h3>
               
               <div className="space-y-4">
                   <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                       <h4 className="text-green-800 font-semibold text-sm mb-2 flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                           Strengths
                       </h4>
                       <ul className="list-disc list-inside text-sm text-green-900 space-y-1">
                           {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                       </ul>
                   </div>

                   <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                       <h4 className="text-amber-800 font-semibold text-sm mb-2 flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                           Areas for Improvement
                       </h4>
                       <ul className="list-disc list-inside text-sm text-amber-900 space-y-1">
                           {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                       </ul>
                   </div>

                   <div className="bg-stone-100 p-4 rounded-xl border border-stone-200">
                       <h4 className="text-stone-800 font-semibold text-sm mb-2 flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                           Actionable Tips
                       </h4>
                       <ul className="list-disc list-inside text-sm text-stone-700 space-y-1">
                           {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                       </ul>
                   </div>
               </div>
          </div>

          {/* Transcription & Audio Player */}
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-stone-800 font-serif border-b border-stone-200 pb-2">Transcription</h3>
              
              {audioUrl && (
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                      </div>
                      <div className="flex-1">
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-0.5">Your Recording</p>
                          <audio controls src={audioUrl} className="w-full h-6" />
                      </div>
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
            className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Record Again
          </button>
      </div>

    </div>
  );
};

export default PyramidFeedback;
