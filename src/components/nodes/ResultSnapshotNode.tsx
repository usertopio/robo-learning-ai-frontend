import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

export default function ResultSnapshotNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const [snapshot, setSnapshot] = useState<string | null>(null);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);

    const onDelete = () => {
        setNodes((nodes) => nodes.filter((n) => n.id !== id));
        setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
    };

    useEffect(() => {
        const updateImage = (img: string) => {
            if (isAutoRefresh && img) {
                setSnapshot(img);
            }
        };

        const handleNewFrameEvent = (e: any) => updateImage(e.detail);
        
        // 1. Listen to broadcast event from App.tsx
        window.addEventListener('new-ai-frame', handleNewFrameEvent);

        // 2. Also listen DIRECTLY to socket for redundancy
        const socket = (window as any).socket;
        if (socket) {
            socket.on('stream_to_web', updateImage);
        }

        return () => {
            window.removeEventListener('new-ai-frame', handleNewFrameEvent);
            if (socket) {
                socket.off('stream_to_web', updateImage);
            }
        };
    }, [isAutoRefresh]);

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[280px] transition-all duration-200 ${selected ? 'ring-2 ring-emerald-500 shadow-xl dark:ring-emerald-400' : ''}`}>
            <Handle 
                type="target" 
                position={Position.Left} 
                className="bg-indigo-500 hover:bg-indigo-400" 
            />

            {/* Header */}
            <div className="wb-header py-3 px-4 flex items-center justify-between rounded-t-2xl border-b bg-emerald-500/10 border-emerald-500/20">
                <div className="flex items-center gap-3">
                    <span className="text-xl">📸</span>
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">Result Snapshot</p>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Static Result Viewer</p>
                    </div>
                </div>
                <button onClick={onDelete} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>

            {/* Body */}
            <div className="wb-body p-4 flex flex-col gap-3 bg-white dark:bg-slate-900/50 rounded-b-2xl">
                <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center relative group">
                    {snapshot ? (
                        <img src={snapshot} alt="Snapshot" className="w-full h-full object-contain" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 opacity-50">
                            <span className="text-3xl">🖼️</span>
                            <p className="text-[10px] font-bold uppercase tracking-widest">Waiting for Data...</p>
                        </div>
                    )}
                    
                    {snapshot && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                             <p className="text-white text-[10px] font-bold px-3 py-1 bg-black/60 rounded-full">LATEST CAPTURE</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isAutoRefresh}
                            onChange={(e) => setIsAutoRefresh(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Auto Refresh</span>
                    </label>
                    <button 
                        onClick={() => setSnapshot(null)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-tight"
                    >
                        Clear
                    </button>
                </div>

                <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800" />
                
                <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 italic">
                    {isAutoRefresh ? 'Showing the most recent AI result...' : 'Capture paused. Click Auto Refresh to resume.'}
                </p>
            </div>
        </div>
    );
}
