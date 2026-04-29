import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

function getBadgeClass(color: string) {
    const map: Record<string, string> = {
        blue: 'bg-blue-200 text-blue-800',
        purple: 'bg-purple-200 text-purple-800',
        green: 'bg-emerald-200 text-emerald-800',
        amber: 'bg-amber-200 text-amber-800',
        rose: 'bg-rose-200 text-rose-800',
    };
    return map[color] || 'bg-slate-200 text-slate-800';
}

function getBlockIcon(blockId: string, defaultIcon: string) {
    // Map for blocks with problematic emoji encoding
    const iconMap: Record<string, string> = {
        'ai-detector': '🤖',  // Robot
        'webcam-input': '📹',  // Video camera
        'robot-stream': '🎥',  // Movie camera  
        'roboflow-dataset': '📚',  // Books/library
    };
    return iconMap[blockId] || defaultIcon;
}

export default function CustomNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const { def } = data;

    // ⚠️ ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURN (Rules of Hooks)
    const [cameraStatus, setCameraStatus] = useState<Record<number, string>>({});
    const [isTraining, setIsTraining] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState<'idle' | 'training' | 'complete' | 'error'>('idle');
    const [liveDetections, setLiveDetections] = useState<any[]>([]);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [uploadCount, setUploadCount] = useState(0);
    const [imgProgress, setImgProgress] = useState({ running: false, current: 0, total: 0, filename: '' });
    const [lossData, setLossData] = useState<{ epoch: number; loss: number; val_loss: number }[]>([]);
    // Dataset-related state
    const [datasets, setDatasets] = useState<any[]>([]);
    const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
    const [datasetStatus, setDatasetStatus] = useState<{ status: string; name?: string; classes?: string[]; num_train?: number; num_val?: number; error?: string } | null>(null);
    // Training artifacts state (confusion matrix, charts)
    const [trainingArtifacts, setTrainingArtifacts] = useState<{ confusion_matrix?: string; results_chart?: string; pr_curve?: string; metrics?: Record<string, number> } | null>(null);

    const defId = def?.id ?? '';

    // Listen for detection results updates (det-results block)
    useEffect(() => {
        if (defId !== 'det-results') return;
        const handler = (e: any) => setLiveDetections(e.detail || []);
        window.addEventListener('det-results-update', handler);
        return () => window.removeEventListener('det-results-update', handler);
    }, [defId]);

    // Listen for training progress (loss-chart block)
    useEffect(() => {
        if (defId !== 'loss-chart') return;
        const handler = (e: any) => {
            const d = e.detail;
            if (d.epoch > 0 && d.status === 'training') {
                setLossData(prev => [
                    ...prev.filter(p => p.epoch !== d.epoch),
                    { epoch: d.epoch, loss: d.loss || 0, val_loss: d.val_loss || 0 }
                ].slice(-50));
            }
            if (d.status === 'started') setLossData([]);
        };
        window.addEventListener('training-progress-update', handler);
        return () => window.removeEventListener('training-progress-update', handler);
    }, [defId]);

    // Listen for image inference progress (test-image block)
    useEffect(() => {
        if (defId !== 'test-image') return;
        const onStart   = (e: any) => setImgProgress({ running: true, current: 0, total: e.detail.total, filename: '' });
        const onProgress = (e: any) => setImgProgress({ running: true, current: e.detail.current, total: e.detail.total, filename: e.detail.filename });
        const onDone    = () => setImgProgress(p => ({ ...p, running: false, filename: 'Done ✅' }));
        window.addEventListener('image-inference-start', onStart);
        window.addEventListener('image-inference-progress', onProgress);
        window.addEventListener('image-inference-done', onDone);
        return () => {
            window.removeEventListener('image-inference-start', onStart);
            window.removeEventListener('image-inference-progress', onProgress);
            window.removeEventListener('image-inference-done', onDone);
        };
    }, [defId]);

    // Listen for global datasets list (train-engine block)
    useEffect(() => {
        if (defId !== 'train-engine') return;
        const handler = (e: any) => setDatasets(e.detail || []);
        window.addEventListener('datasets-updated', handler);
        return () => window.removeEventListener('datasets-updated', handler);
    }, [defId]);

    // Listen for dataset validation status (roboflow-dataset block)
    useEffect(() => {
        if (defId !== 'roboflow-dataset') return;
        const handler = (e: any) => setDatasetStatus(e.detail);
        window.addEventListener('dataset-status-update', handler);
        return () => window.removeEventListener('dataset-status-update', handler);
    }, [defId]);

    // Listen for training artifacts (confusion-matrix block)
    useEffect(() => {
        if (defId !== 'confusion-matrix') return;
        const handler = (e: any) => setTrainingArtifacts(e.detail?.artifacts ? {
            confusion_matrix: e.detail.artifacts.confusion_matrix,
            results_chart: e.detail.artifacts.results_chart,
            pr_curve: e.detail.artifacts.pr_curve,
            metrics: e.detail.metrics
        } : null);
        window.addEventListener('training-artifacts-update', handler);
        return () => window.removeEventListener('training-artifacts-update', handler);
    }, [defId]);

    // ✅ Early return AFTER all hooks
    if (!def) return null;


    const onDelete = () => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const handleParamChange = (idx: number, newValue: any, key: string = 'value') => {
        setNodes((nds) => 
            nds.map((node) => {
                if (node.id === id) {
                    const newDef = { ...node.data.def };
                    const newParams = [...newDef.params];
                    newParams[idx] = { ...newParams[idx], [key]: newValue };
                    newDef.params = newParams;

                    // Emit to system for AI Sync
                    window.dispatchEvent(new CustomEvent('ai-param-update', { 
                        detail: { nodeId: id, paramIdx: idx, key, value: newValue, label: newParams[idx].label } 
                    }));

                    return { ...node, data: { ...node.data, def: newDef } };
                }
                return node;
            })
        );
    };

    const testCamera = async (paramIdx: number) => {
        setCameraStatus(s => ({ ...s, [paramIdx]: 'testing' }));
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop()); // ปิดกล้องทันทีหลังทดสอบ
            setCameraStatus(s => ({ ...s, [paramIdx]: 'ok' }));
        } catch (err: any) {
            setCameraStatus(s => ({ ...s, [paramIdx]: 'error' }));
        }
    };

    const handleStartTraining = async () => {
        if (def.id !== 'train-engine') return;
        
        // Get current mode and other parameters from the node
        const modeParam = def.params.find((p: any) => p.label === 'Operation Mode');
        const mode = modeParam?.value || 'Inference (Testing)';
        
        // Extract training hyperparameters from all params in this block
        const hyperparams = def.params.reduce((acc: any, p: any) => {
            if (p.label === 'Epochs')             acc.epochs = p.value;
            if (p.label === 'Initial LR (lr0)')   acc.lr0 = p.value;
            if (p.label === 'Batch Size')          acc.batch_size = p.value?.split(' ')[0] || 16;
            if (p.label === 'Weight Decay')        acc.weight_decay = p.value;
            if (p.label === 'Optimizer Type')      acc.optimizer_type = p.value?.split(' ')[0] || 'AdamW';
            if (p.label === 'LR Scheduler')        acc.lr_scheduler = p.value?.split(' ')[0] || 'Cosine';
            if (p.label === 'Image Size (imgsz)')  acc.imgsz = p.value;
            return acc;
        }, {});


        setIsTraining(true);
        setTrainingStatus('training');

        try {
            const response = await fetch('http://localhost:3000/api/train/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    hyperparams,
                    dataset_id: selectedDatasetId  // send selected dataset
                })
            });

            const result = await response.json();
            if (response.ok) {
                setTrainingStatus('complete');
                setTimeout(() => setTrainingStatus('idle'), 3000);
            } else {
                setTrainingStatus('error');
                console.error('Training error:', result.error);
            }
        } catch (err: any) {
            setTrainingStatus('error');
            console.error('Training request failed:', err);
        } finally {
            setIsTraining(false);
        }
    };

    const hasTargetHandle = def.color !== 'blue'; // ทุกอันรับ Input ได้ยกเว้นสีบล็อก Input (Blue)
    const hasSourceHandle = def.color !== 'green' && def.color !== 'rose'; // ทุกอันส่ง Output ได้ ยกเว้นบล็อก Output (Green/Rose)

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[260px] transition-all duration-200 ${selected ? 'ring-2 ring-indigo-500 shadow-xl dark:ring-indigo-400' : ''}`}>
            
            {/* Input Handle (รับเส้นที่ถูกโยงมาหา) */}
            {hasTargetHandle && (
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700 border-4 border-white dark:border-slate-700 rounded-full hover:w-24 hover:h-24 hover:shadow-2xl hover:shadow-indigo-500/70 -left-10 transition-all shadow-xl cursor-grab active:cursor-grabbing" 
                />
            )}

            <div className={`wb-header py-3.5 px-4 flex items-center justify-between rounded-t-2xl ${def.color}-header transition-colors border-b border-white/50 dark:border-slate-800/50`}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-md">{getBlockIcon(def.id, def.icon)}</span>
                    <div className="pt-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{def.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{def.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${getBadgeClass(def.color)} shadow-sm tracking-wide`}>{def.badge}</span>
                    <button 
                        onClick={onDelete} 
                        className="text-slate-400/80 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 w-7 h-7 flex items-center justify-center rounded-full transition-all" 
                        title="Delete Block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            </div>
            
            <div className={`wb-body p-4 text-xs text-slate-600 dark:text-slate-300 font-sans transition-colors bg-white dark:bg-slate-900/50 rounded-b-2xl ${def.id === 'train-engine' ? '' : 'max-h-[500px] overflow-y-auto'}`}>
                {def.params.map((p: any, idx: number) => {
                    if (p.type === 'slider') {
                        const step = p.step || 1;
                        const increment = () => {
                            const val = Math.min(p.max, Number((p.value + step).toFixed(4)));
                            handleParamChange(idx, val);
                        };
                        const decrement = () => {
                            const val = Math.max(p.min, Number((p.value - step).toFixed(4)));
                            handleParamChange(idx, val);
                        };

                        return (
                            <div key={idx} className="mb-4">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{p.label}</label>
                                    
                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <button 
                                            onClick={decrement}
                                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-all active:scale-90"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                                        </button>
                                        
                                        <input
                                            type="number"
                                            value={p.value}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                if (!isNaN(val)) handleParamChange(idx, val);
                                            }}
                                            onBlur={(e) => {
                                                let val = Number(e.target.value);
                                                val = Math.round(val / step) * step;
                                                if (val < p.min) val = p.min;
                                                if (val > p.max) val = p.max;
                                                handleParamChange(idx, Number(val.toFixed(4)));
                                            }}
                                            className="w-12 text-center bg-transparent border-none text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:ring-0 p-0 appearance-none no-spinner"
                                        />

                                        <button 
                                            onClick={increment}
                                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-all active:scale-90"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="px-1">
                                    <input 
                                        type="range" 
                                        min={p.min} 
                                        max={p.max} 
                                        value={p.value} 
                                        step={p.step} 
                                        onChange={(e) => handleParamChange(idx, Number(e.target.value))}
                                        className="w-full accent-indigo-500 cursor-pointer h-1 rounded-lg appearance-none bg-slate-200 dark:bg-slate-800"
                                    />
                                    <div className="flex justify-between mt-1 text-[8px] text-slate-400 font-mono opacity-60">
                                        <span>{p.min}</span>
                                        <span>{p.max}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    
                    if (p.type === 'select') return (
                        <div key={idx} className="mb-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                            <select 
                                value={p.value || p.options[0]}
                                onChange={(e) => handleParamChange(idx, e.target.value)}
                                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                {p.options.map((o:string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    );

                    if (p.type === 'text') return (
                        <div key={idx} className="mb-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                            <input 
                                type="text" 
                                placeholder={p.placeholder} 
                                value={p.value || ''} 
                                onChange={(e) => handleParamChange(idx, e.target.value)}
                                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                            />
                        </div>
                    );

                    if (p.type === 'check') return (
                        <div key={idx} className="mb-3">
                            <label className="flex items-center gap-2 group cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={p.checked} 
                                    onChange={(e) => handleParamChange(idx, e.target.checked, 'checked')}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all cursor-pointer"
                                />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.label}</span>
                            </label>
                        </div>
                    );

                    if (p.type === 'button') {
                        const camStatus = cameraStatus[idx];
                        const isCamTest = p.label === 'Check Connection' || p.label.includes('Test');
                        return (
                            <button
                                key={idx}
                                onClick={() => isCamTest ? testCamera(idx) : undefined}
                                className={`w-full mt-2 text-xs px-4 py-2 rounded-xl text-center transition-colors font-bold shadow-sm active:scale-[0.98]
                                    ${ isCamTest
                                        ? camStatus === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                        : camStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300'
                                        : camStatus === 'testing' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 cursor-wait opacity-80'
                                        : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                        : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                    }`}
                            >
                                { isCamTest
                                    ? camStatus === 'ok' ? '✅ Connected!'
                                    : camStatus === 'error' ? '❌ Connection Failed'
                                    : camStatus === 'testing' ? '⏳ Checking...'
                                    : p.label
                                    : p.label
                                }
                            </button>
                        );
                    }
                    
                    if (p.type === 'dropzone') {
                        const isRoboflow = def.id === 'roboflow-dataset';
                        const folder = 'test_images';

                        // ---- Roboflow ZIP upload ----
                        if (isRoboflow) {
                            const handleZipUpload = async (files: FileList | null) => {
                                if (!files || files.length === 0) return;
                                const file = files[0];
                                if (!file.name.endsWith('.zip')) {
                                    setDatasetStatus({ status: 'error', error: 'Please select a .zip file from Roboflow' });
                                    return;
                                }
                                setDatasetStatus({ status: 'uploading' });
                                const formData = new FormData();
                                formData.append('dataset', file);
                                try {
                                    const res = await fetch('http://localhost:3000/api/datasets/upload', {
                                        method: 'POST', body: formData
                                    });
                                    if (!res.ok) {
                                        setDatasetStatus({ status: 'error', error: 'Upload failed' });
                                    } else {
                                        setDatasetStatus({ status: 'validating' });
                                        // actual result comes via socket 'dataset_status' event
                                    }
                                } catch { setDatasetStatus({ status: 'error', error: 'Network error' }); }
                            };

                            const statusIcon = datasetStatus?.status === 'uploading' ? '⏳'
                                : datasetStatus?.status === 'validating' ? '🔍'
                                : datasetStatus?.status === 'valid' ? '✅'
                                : datasetStatus?.status === 'error' ? '❌' : '📦';
                            const statusMsg = datasetStatus?.status === 'uploading' ? 'Uploading...'
                                : datasetStatus?.status === 'validating' ? 'Validating dataset...'
                                : datasetStatus?.status === 'valid'
                                    ? `${datasetStatus.name} (${datasetStatus.classes?.length} classes)`
                                : datasetStatus?.status === 'error' ? datasetStatus.error || 'Error'
                                : 'Click to upload Roboflow ZIP';
                            const borderColor = datasetStatus?.status === 'valid'
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                : datasetStatus?.status === 'error'
                                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                                : datasetStatus?.status === 'uploading' || datasetStatus?.status === 'validating'
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-400';

                            return (
                                <div key={idx} className="mb-3 mt-3">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                                    <label className={`w-full text-[11px] text-center border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center gap-1 group ${borderColor}`}>
                                        <span className="text-xl">{statusIcon}</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px] text-center">{statusMsg}</span>
                                        <span className="text-[9px] text-slate-400">Export from Roboflow → YOLOv8 format → download ZIP</span>
                                        <input type="file" accept=".zip" className="hidden" onChange={e => handleZipUpload(e.target.files)} />
                                    </label>
                                    {/* Show class list after validation */}
                                    {datasetStatus?.status === 'valid' && datasetStatus.classes && (
                                        <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                                                🏷️ {datasetStatus.classes.length} Classes · 🖼️ {datasetStatus.num_train} train / {datasetStatus.num_val} val
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {datasetStatus.classes.slice(0, 10).map((c: string, i: number) => (
                                                    <span key={i} className="text-[8px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-mono">{c}</span>
                                                ))}
                                                {(datasetStatus.classes.length > 10) && <span className="text-[8px] text-slate-400">+{datasetStatus.classes.length - 10} more</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // ---- Test Images upload (unchanged) ----
                        const handleUpload = async (files: FileList | null) => {
                            if (!files || files.length === 0) return;
                            setUploadStatus('uploading');
                            const formData = new FormData();
                            Array.from(files).forEach(f => formData.append('images', f));
                            try {
                                const res = await fetch(`http://localhost:3000/api/upload/images?folder=${folder}`, {
                                    method: 'POST', body: formData
                                });
                                const result = await res.json();
                                if (res.ok) { setUploadStatus('done'); setUploadCount(result.count || 0); }
                                else setUploadStatus('error');
                            } catch { setUploadStatus('error'); }
                        };
                        const runInference = async () => {
                            await fetch('http://localhost:3000/api/upload/run-inference', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ folder })
                            });
                        };

                        return (
                            <div key={idx} className="mb-3 mt-3">
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                                <label className={`w-full text-[11px] text-center border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 group
                                    ${ uploadStatus === 'uploading' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' 
                                      : uploadStatus === 'done' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
                                      : uploadStatus === 'error' ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                                      : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-400 hover:bg-slate-100'}`}>
                                    <span className="text-xl block group-hover:scale-110 transition-transform">
                                        {uploadStatus === 'uploading' ? '⏳' : uploadStatus === 'done' ? '✅' : uploadStatus === 'error' ? '❌' : '📂'}
                                    </span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">
                                        {uploadStatus === 'uploading' ? 'Uploading...' 
                                         : uploadStatus === 'done' ? `${uploadCount} images uploaded!` 
                                         : uploadStatus === 'error' ? 'Upload failed' 
                                         : 'Click to upload images'}
                                    </span>
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} />
                                </label>
                                {/* Image Inference Progress */}
                                {(imgProgress.running || imgProgress.filename) && (
                                    <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="flex justify-between text-[9px] font-mono mb-1">
                                            <span className="text-slate-500 truncate max-w-[120px]">{imgProgress.filename}</span>
                                            <span className="font-bold text-indigo-500">{imgProgress.current}/{imgProgress.total}</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" 
                                                style={{ width: imgProgress.total > 0 ? `${(imgProgress.current/imgProgress.total)*100}%` : '0%' }} />
                                        </div>
                                    </div>
                                )}
                                {/* Run Inference Button */}
                                {uploadStatus === 'done' && !imgProgress.running && (
                                    <button onClick={runInference} className="w-full mt-2 py-1.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all active:scale-95">
                                        🚀 Run AI on {uploadCount} images
                                    </button>
                                )}
                            </div>
                        );
                    }

                    if (p.type === 'divider') return (
                        <div key={idx} className="border-t border-slate-200 dark:border-slate-700 mt-4 mb-2 pt-3">
                            <label className="text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase tracking-widest block">{p.label}</label>
                        </div>
                    );
                    
                    if (p.type === 'info') return (
                        <div key={idx} className="mb-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{p.label}</label>
                            <span className="text-[12px] font-mono font-bold text-slate-800 dark:text-slate-100">{p.text}</span>
                        </div>
                    );

                    if (p.type === 'progress') return (
                        <div key={idx} className="mb-2 mt-3 p-1">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{p.label}</label>
                                <span className="text-[10px] font-mono font-bold text-indigo-500">{p.value}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                                <div 
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
                                    style={{ width: `${p.value}%` }}
                                />
                            </div>
                        </div>
                    );

                    if (p.type === 'table') {
                        const isLiveTable = def.id === 'det-results' && p.columns[0] === 'Class';
                        const tableData = isLiveTable ? liveDetections : (p.data || null);
                        return (
                            <div key={idx} className="mb-2 mt-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{p.label}</label>
                                    {isLiveTable && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${liveDetections.length > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                            {liveDetections.length > 0 ? `🟢 ${liveDetections.length} found` : '⚪ idle'}
                                        </span>
                                    )}
                                </div>
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                        <thead><tr className="bg-slate-50 dark:bg-slate-900/50">{p.columns.map((c:any, i:number)=><th key={i} className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 dark:text-slate-300 font-bold">{c}</th>)}</tr></thead>
                                        <tbody>
                                            {tableData && tableData.length > 0 ? tableData.map((row:any[], ri:number) => (
                                                <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                    {row.map((cell:any, ci:number) => (
                                                        <td key={ci} className={`px-2 py-1.5 font-mono text-[9px] dark:text-slate-400 ${ci === 0 ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''}`}>{cell}</td>
                                                    ))}
                                                </tr>
                                            )) : isLiveTable ? (
                                                <tr><td colSpan={p.columns.length} className="px-2 py-3 text-center text-slate-300 dark:text-slate-600 text-[10px] italic">Waiting for detections...</td></tr>
                                            ) : Array.from({length: p.rows}).map((_:any, ri:number) => (
                                                <tr key={ri} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                    {p.columns.map((_:any, ci:number) => <td key={ci} className="px-2 py-1.5 text-slate-300 dark:text-slate-600 text-center">-</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    }

                    // --- Live Loss Chart (for loss-chart block) ---
                    if (p.type === 'select' && def.id === 'loss-chart' && p.label === 'Chart Type') {
                        const W = 220, H = 100, PAD = 10;
                        const maxLoss = lossData.length > 0 ? Math.max(...lossData.map(d => Math.max(d.loss, d.val_loss))) : 1;
                        const minLoss = lossData.length > 0 ? Math.min(...lossData.map(d => Math.min(d.loss, d.val_loss))) : 0;
                        const range = maxLoss - minLoss || 1;
                        const toX = (i: number) => PAD + (i / Math.max(lossData.length - 1, 1)) * (W - PAD * 2);
                        const toY = (v: number) => PAD + (1 - (v - minLoss) / range) * (H - PAD * 2);
                        const pathFor = (key: 'loss' | 'val_loss') =>
                            lossData.length < 2 ? '' :
                            lossData.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(' ');

                        return (
                            <div key={`chart-${idx}`} className="mb-3 mt-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Loss Chart</label>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lossData.length > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                        {lossData.length > 0 ? `🔴 ${lossData.length} epochs` : '⚪ idle'}
                                    </span>
                                </div>
                                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 p-1">
                                    {lossData.length < 2 ? (
                                        <div className="flex items-center justify-center h-[100px] text-[10px] text-slate-500 italic">Start training to see chart...</div>
                                    ) : (
                                        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
                                            {/* Grid lines */}
                                            {[0.25, 0.5, 0.75].map(t => (
                                                <line key={t} x1={PAD} y1={PAD + t * (H - PAD * 2)} x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
                                                    stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                                            ))}
                                            {/* Train Loss line */}
                                            <path d={pathFor('loss')} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            {/* Val Loss line */}
                                            <path d={pathFor('val_loss')} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,2" />
                                            {/* Last point dots */}
                                            {lossData.length > 0 && (<>
                                                <circle cx={toX(lossData.length-1)} cy={toY(lossData[lossData.length-1].loss)} r="2.5" fill="#f43f5e" />
                                                <circle cx={toX(lossData.length-1)} cy={toY(lossData[lossData.length-1].val_loss)} r="2.5" fill="#6366f1" />
                                            </>)}
                                        </svg>
                                    )}
                                </div>
                                {/* Legend */}
                                <div className="flex gap-3 mt-1.5 px-1">
                                    <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-3 h-0.5 bg-rose-500 inline-block rounded" />Train Loss</span>
                                    <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" style={{borderTop:'1px dashed'}} />Val Loss</span>
                                    {lossData.length > 0 && <span className="text-[9px] text-slate-500 ml-auto">L={lossData[lossData.length-1].loss}</span>}
                                </div>
                            </div>
                        );
                    }

                    if (p.type === 'matrix') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-widest">{p.label}</label>
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
                                <table className="w-full text-[9px] text-center border-collapse">
                                    <thead><tr className="bg-slate-50 dark:bg-slate-900/50"><th className="p-1 border-b border-r border-slate-200 dark:border-slate-800 font-normal text-slate-400">#</th>{p.headers.map((h:any, i:number)=><th key={i} className="p-1.5 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-200 font-bold">{h}</th>)}</tr></thead>
                                    <tbody>
                                        {p.headers.map((hLine:any, ri:number) => (
                                            <tr key={ri} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 font-bold">{hLine}</th>
                                                {p.headers.map((_:any, ci:number) => <td key={ci} className={`p-1.5 font-mono ${ri === ci ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>{ri === ci ? '1.0' : '0.0'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );

                    return null;
                })}

                {/* Confusion Matrix Block — shows real training artifacts */}
                {def.id === 'confusion-matrix' && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        {trainingArtifacts?.confusion_matrix ? (
                            <div className="space-y-3">
                                {/* Confusion Matrix Image */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                                        🧮 Confusion Matrix (Real)
                                    </label>
                                    <img
                                        src={`data:image/png;base64,${trainingArtifacts.confusion_matrix}`}
                                        alt="Confusion Matrix"
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                                    />
                                </div>

                                {/* Final Metrics Summary */}
                                {trainingArtifacts.metrics && Object.keys(trainingArtifacts.metrics).length > 0 && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                                            📊 Final Metrics
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                            {Object.entries(trainingArtifacts.metrics)
                                                .filter(([k]) => ['metrics/mAP50(B)', 'metrics/precision(B)', 'metrics/recall(B)', 'val/box_loss'].includes(k))
                                                .map(([k, v]) => (
                                                    <div key={k} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-1.5 text-center">
                                                        <div className="text-[8px] text-slate-400 truncate">{k.replace('metrics/', '').replace('(B)', '')}</div>
                                                        <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{String(v)}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* PR Curve */}
                                {trainingArtifacts.pr_curve && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                                            📈 PR Curve
                                        </label>
                                        <img
                                            src={`data:image/png;base64,${trainingArtifacts.pr_curve}`}
                                            alt="PR Curve"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-600">
                                <div className="text-3xl mb-2">🧮</div>
                                <div className="text-[10px] font-medium">Waiting for Training...</div>
                                <div className="text-[9px] mt-1 opacity-70">Run Training Engine first, then results will appear here</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Training Start Button - สำหรับ Training Block เท่านั้น */}
                {def.id === 'train-engine' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                        {/* Dataset Selector */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                                📚 Training Dataset
                            </label>
                            <select
                                value={selectedDatasetId ?? ''}
                                onChange={e => setSelectedDatasetId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full text-[10px] font-medium border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                            >
                                <option value="">🔬 coco8 (demo — no upload needed)</option>
                                {datasets.filter((d: any) => d.status === 'valid').map((d: any) => (
                                    <option key={d.id} value={d.id}>
                                        ✅ {d.name} ({d.classes?.length || '?'} classes · {d.num_train} imgs)
                                    </option>
                                ))}
                            </select>
                            {datasets.filter((d: any) => d.status === 'valid').length === 0 && (
                                <p className="text-[9px] text-slate-400 mt-1 italic">No datasets uploaded yet — upload a Roboflow ZIP first</p>
                            )}
                        </div>

                        {/* Hyperparameter Summary — แสดงค่าที่จะใช้ก่อน Train */}
                        {!isTraining && trainingStatus !== 'training' && (() => {
                            const ep  = def.params.find((p:any) => p.label === 'Epochs')?.value ?? 100;
                            const bs  = def.params.find((p:any) => p.label === 'Batch Size')?.value ?? '16';
                            const lr  = def.params.find((p:any) => p.label === 'Initial LR (lr0)')?.value ?? 0.01;
                            const opt = def.params.find((p:any) => p.label === 'Optimizer Type')?.value ?? 'AdamW';
                            const sch = def.params.find((p:any) => p.label === 'LR Scheduler')?.value ?? 'Cosine';
                            const img = def.params.find((p:any) => p.label === 'Image Size (imgsz)')?.value ?? 'auto';
                            return (
                                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">⚙️ Config Preview</div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                                        <div className="flex justify-between"><span className="text-slate-400">Epochs</span><span className="font-mono font-bold text-amber-600 dark:text-amber-400">{ep}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Batch</span><span className="font-mono font-bold text-amber-600 dark:text-amber-400">{String(bs).split(' ')[0]}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">LR (lr0)</span><span className="font-mono font-bold text-amber-600 dark:text-amber-400">{lr}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">ImgSz</span><span className="font-mono font-bold text-amber-600 dark:text-amber-400">{img ?? 'auto'}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Optimizer</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{String(opt).split(' ')[0]}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400">Scheduler</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{String(sch).split(' ')[0]}</span></div>
                                    </div>
                                </div>
                            );
                        })()}

                        <button
                            onClick={handleStartTraining}
                            disabled={isTraining}
                            className={`w-full py-2.5 px-3 text-xs font-bold rounded-lg transition-all shadow-md active:scale-[0.98] text-center ${
                                isTraining || trainingStatus === 'training'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 cursor-wait opacity-80'
                                    : trainingStatus === 'complete'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                    : trainingStatus === 'error'
                                    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                    : 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-amber-500/30'
                            }`}
                        >
                            {isTraining || trainingStatus === 'training'
                                ? '⏳ Training...'
                                : trainingStatus === 'complete'
                                ? '✅ Training Complete'
                                : trainingStatus === 'error'
                                ? '❌ Training Failed'
                                : selectedDatasetId
                                ? `🎓 Train on ${datasets.find((d:any) => d.id === selectedDatasetId)?.name || 'dataset'}`
                                : '🎓 Start Training (demo)'
                            }
                        </button>
                    </div>
                )}


            </div>


            {/* Output Handle (ลากเส้นออกไปหาคนอื่น) */}
            {hasSourceHandle && (
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 border-4 border-white dark:border-slate-700 rounded-full hover:w-24 hover:h-24 hover:shadow-2xl hover:shadow-emerald-500/70 -right-10 transition-all shadow-xl cursor-grab active:cursor-grabbing" 
                />
            )}
        </div>
    );
}
