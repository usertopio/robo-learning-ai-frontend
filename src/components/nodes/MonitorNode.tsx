import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

export default function MonitorNode({ id, data: _data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const [isActive, setIsActive] = useState(true);

    const dispatch = (active: boolean) =>
        window.dispatchEvent(new CustomEvent('monitor-power-change', { detail: { id, active } }));

    const onDelete = () => {
        dispatch(false);
        setNodes((nodes) => nodes.filter((n) => n.id !== id));
        setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
    };

    const togglePower = () => {
        const next = !isActive;
        setIsActive(next);
        dispatch(next);
    };

    useEffect(() => {
        dispatch(true);
        return () => dispatch(false);
    }, []);

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[240px] transition-all duration-200 ${selected ? 'ring-2 ring-indigo-500 shadow-xl dark:ring-indigo-400' : ''}`}>
            <Handle type="target" position={Position.Left} className="bg-indigo-500 hover:bg-indigo-400" />

            {/* Header */}
            <div className={`wb-header py-3 px-4 flex items-center justify-between rounded-t-2xl border-b transition-colors ${isActive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'}`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl">🖥️</span>
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">Live Monitor</p>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight">Dashboard Sink</p>
                    </div>
                </div>
                <button onClick={onDelete} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>

            {/* Body */}
            <div className="wb-body p-4 flex flex-col items-center gap-4 bg-white dark:bg-slate-900/50 rounded-b-2xl">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${isActive ? 'bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-500/20 animate-pulse' : 'bg-slate-100 text-slate-400 opacity-50'}`}>
                    {isActive ? '📡' : '💤'}
                </div>

                <button
                    onClick={togglePower}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${isActive ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-600 hover:bg-slate-500 text-white shadow-slate-500/20'}`}
                >
                    {isActive ? '⏹️ Deactivate Monitor' : '▶️ Activate Monitor'}
                </button>

                <div className="w-full h-[1px] bg-slate-100 dark:bg-slate-800" />

                <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 italic">
                    {isActive ? 'Streaming to Preview panel →' : 'Monitor is currently powered off.'}
                </p>
            </div>
        </div>
    );
}
