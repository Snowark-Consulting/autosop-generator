import React, { useState, useEffect, useRef } from 'react';
import { SopData, SopStep } from '../types';
import { Modal } from './Modal';

interface SopEditorProps {
  initialData: SopData;
  videoFile: File;
  onSave: (data: SopData) => void;
  onCancel: () => void;
}

type Tool = 'NONE' | 'CROP' | 'BOX' | 'ARROW';

export const SopEditor: React.FC<SopEditorProps> = ({ initialData, videoFile, onSave, onCancel }) => {
  const [data, setData] = useState<SopData>(initialData);
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Editor State
  const [mode, setMode] = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('NONE');
  const [interactionState, setInteractionState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

  // Load image for canvas when editingImage changes
  useEffect(() => {
    if (editingImage) {
      const img = new Image();
      img.src = editingImage;
      img.onload = () => {
        imageRef.current = img;
        renderCanvas();
      };
    }
  }, [editingImage]);

  // Re-render canvas when interactions or tools change
  useEffect(() => {
    renderCanvas();
  }, [interactionState, activeTool]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset canvas size to match image resolution if needed
    if (canvas.width !== img.width || canvas.height !== img.height) {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    // 1. Draw Base Image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // 2. Draw Interaction Overlay
    if (interactionState) {
      const { startX, startY, currentX, currentY } = interactionState;
      const width = currentX - startX;
      const height = currentY - startY;

      ctx.save();
      if (activeTool === 'CROP') {
        // Dim background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Clear selection area (make it bright)
        ctx.drawImage(img, startX, startY, width, height, startX, startY, width, height);
        
        // Draw border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(startX, startY, width, height);
        
        // Draw dimensions
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${Math.abs(Math.round(width))} x ${Math.abs(Math.round(height))}`, startX, startY - 8);

      } else if (activeTool === 'BOX') {
        ctx.strokeStyle = '#DC2626'; // Red-600
        ctx.lineWidth = 4;
        ctx.strokeRect(startX, startY, width, height);
      } else if (activeTool === 'ARROW') {
        drawArrow(ctx, startX, startY, currentX, currentY);
      }
      ctx.restore();
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headLen = 20; // length of head in pixels
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#DC2626'; // Red-600
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Line
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    
    // Arrowhead
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    
    ctx.stroke();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'NONE' || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setInteractionState({
      isDragging: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactionState || !interactionState.isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setInteractionState({
      ...interactionState,
      currentX: x,
      currentY: y
    });
  };

  const handleMouseUp = () => {
    if (!interactionState || !canvasRef.current || !imageRef.current) return;

    const { startX, startY, currentX, currentY } = interactionState;
    const width = currentX - startX;
    const height = currentY - startY;

    // Ignore tiny drags
    if (Math.abs(width) < 5 || Math.abs(height) < 5) {
      setInteractionState(null);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply changes based on tool
    if (activeTool === 'CROP') {
      // Create temp canvas for cropped image
      const tempCanvas = document.createElement('canvas');
      // Ensure positive dimensions
      const cropW = Math.abs(width);
      const cropH = Math.abs(height);
      const cropX = width > 0 ? startX : currentX;
      const cropY = height > 0 ? startY : currentY;

      tempCanvas.width = cropW;
      tempCanvas.height = cropH;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
         tempCtx.drawImage(imageRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
         const newDataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
         pushHistory(newDataUrl);
         setActiveTool('NONE'); // Reset tool after crop
      }
    } else {
      // Burn annotation into the image
      // We redraw the canvas one last time with the finalized shape, then save it
      ctx.drawImage(imageRef.current, 0, 0); // Base
      
      if (activeTool === 'BOX') {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 4;
        ctx.strokeRect(startX, startY, width, height);
      } else if (activeTool === 'ARROW') {
        drawArrow(ctx, startX, startY, currentX, currentY);
      }

      const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      pushHistory(newDataUrl);
    }

    setInteractionState(null);
  };

  const pushHistory = (newImage: string) => {
    setHistory(prev => [...prev, newImage]);
    setEditingImage(newImage);
  };

  const undo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setEditingImage(newHistory[newHistory.length - 1]);
    } else {
        // If undoing the initial capture, go back to video? 
        // Or just keep initial. Let's keep initial for now, user can "Retake"
    }
  };

  // Standard Handlers
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, title: e.target.value });
  };

  const handleOverviewChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setData({ ...data, overview: e.target.value });
  };

  const handleStepDescriptionChange = (index: number, value: string) => {
    const newSteps = [...data.steps];
    newSteps[index] = { ...newSteps[index], description: value };
    setData({ ...data, steps: newSteps });
  };

  const handleDeleteStep = (index: number) => {
    if (window.confirm('Are you sure you want to delete this step?')) {
      const newSteps = data.steps.filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 }));
      setData({ ...data, steps: newSteps });
    }
  };

  const handleInsertStep = (afterIndex: number) => {
    const prevTimestamp = afterIndex >= 0 ? data.steps[afterIndex].timestampSeconds : 0;
    const newStep: SopStep = {
      stepNumber: 0,
      description: '', 
      timestampSeconds: prevTimestamp,
      screenshotUrl: undefined
    };
    const newSteps = [...data.steps];
    newSteps.splice(afterIndex + 1, 0, newStep);
    const reorderedSteps = newSteps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setData({ ...data, steps: reorderedSteps });
    
    // Open capture immediately
    const newIndex = afterIndex + 1;
    openCaptureModal(newIndex, 'VIDEO');
  };

  const handleAddStepAtEnd = () => {
    handleInsertStep(data.steps.length - 1);
  };

  const openCaptureModal = (index: number, initialMode: 'VIDEO' | 'IMAGE' = 'VIDEO') => {
    setActiveStepIndex(index);
    
    // If requesting image mode but no image exists, fallback to video
    if (initialMode === 'IMAGE' && !data.steps[index].screenshotUrl) {
        initialMode = 'VIDEO';
    }

    setMode(initialMode);
    
    if (initialMode === 'IMAGE' && data.steps[index].screenshotUrl) {
        setEditingImage(data.steps[index].screenshotUrl!);
        setHistory([data.steps[index].screenshotUrl!]);
    } else {
        setEditingImage(null);
        setHistory([]);
    }
    
    setActiveTool('NONE');
    setIsModalOpen(true);
    
    setTimeout(() => {
      if (initialMode === 'VIDEO' && videoRef.current && data.steps[index]) {
        videoRef.current.currentTime = data.steps[index].timestampSeconds;
      }
    }, 100);
  };

  const captureFrameToEdit = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9); // High quality
        
        setEditingImage(dataUrl);
        setHistory([dataUrl]);
        setMode('IMAGE');
        setActiveTool('NONE');
      }
    }
  };

  const saveEditedImage = () => {
    if (editingImage && activeStepIndex !== null) {
        const newSteps = [...data.steps];
        // If we captured from video, update timestamp too? 
        // Ideally yes, but if we edited it, we use the timestamp from when capture started.
        // Let's update timestamp if it was a fresh capture from video mode.
        if (mode === 'IMAGE' && videoRef.current) {
             newSteps[activeStepIndex] = {
                ...newSteps[activeStepIndex],
                timestampSeconds: videoRef.current.currentTime,
                screenshotUrl: editingImage
            };
        } else {
             newSteps[activeStepIndex] = {
                ...newSteps[activeStepIndex],
                screenshotUrl: editingImage
            };
        }
        
        setData({ ...data, steps: newSteps });
        setIsModalOpen(false);
        setActiveStepIndex(null);
        setMode('VIDEO');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="bg-white rounded-xl shadow-lg border-t-4 border-afs-orange p-8">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h2 className="text-2xl font-display font-bold text-afs-navy">Edit SOP Details</h2>
          <div className="space-x-4">
             <button onClick={onCancel} className="text-gray-500 hover:text-afs-navy font-bold">Cancel</button>
             <button 
              onClick={() => onSave(data)}
              className="bg-afs-navy hover:bg-blue-900 text-white px-6 py-2 rounded-lg font-bold shadow transition-transform hover:-translate-y-0.5"
             >
               Save & Preview
             </button>
          </div>
        </div>

        {/* Global Fields */}
        <div className="space-y-6 mb-10">
          <div>
            <label className="block text-sm font-bold text-afs-navy mb-2">SOP Title</label>
            <input 
              type="text" 
              value={data.title} 
              onChange={handleTitleChange}
              className="w-full px-4 py-3 rounded border border-gray-300 bg-white text-gray-900 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-afs-navy mb-2">Overview</label>
            <textarea 
              value={data.overview} 
              onChange={handleOverviewChange}
              rows={4}
              className="w-full px-4 py-3 rounded border border-gray-300 bg-white text-gray-900 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-afs-navy mb-4">Steps ({data.steps.length})</h3>
          
          {data.steps.map((step, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gray-50 flex flex-col gap-4 shadow-sm">
              <div className="flex gap-6 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-afs-navy text-white flex items-center justify-center font-bold mt-2">
                    {step.stepNumber}
                  </div>
                  
                  <div className="flex-grow space-y-4">
                    <textarea 
                      value={step.description}
                      onChange={(e) => handleStepDescriptionChange(index, e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded bg-white text-gray-900 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none"
                      rows={3}
                      placeholder="Describe this step..."
                    />
                    
                    {/* Visual Editor Entry */}
                    <div className="flex gap-4 items-start flex-wrap">
                      {step.screenshotUrl ? (
                        <div className="flex flex-col gap-2">
                          <div 
                            className="relative group w-56 h-32 bg-gray-200 rounded overflow-hidden border border-gray-300 shadow-sm cursor-pointer hover:border-afs-orange transition-colors"
                            onClick={() => openCaptureModal(index, 'IMAGE')}
                          >
                            <img src={step.screenshotUrl} alt="Step" className="w-full h-full object-cover" />
                            {/* Overlay icon on hover */}
                             <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                             </div>
                          </div>
                          
                          <div className="flex gap-3 text-sm">
                            <button 
                              onClick={() => openCaptureModal(index, 'IMAGE')}
                              className="font-bold text-afs-navy hover:underline flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Annotate / Crop
                            </button>
                            <span className="text-gray-300">|</span>
                            <button 
                              onClick={() => openCaptureModal(index, 'VIDEO')}
                              className="font-bold text-gray-500 hover:text-afs-orange flex items-center gap-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Retake Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-56 h-32 bg-white rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-500 gap-2 hover:border-afs-orange transition-colors cursor-pointer" onClick={() => openCaptureModal(index, 'VIDEO')}>
                          <span className="font-bold">No Image</span>
                          <span className="text-blue-600 underline">Add Screenshot</span>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200 mt-1">
                        Timestamp: {new Date(step.timestampSeconds * 1000).toISOString().substr(14, 5)}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                     <button 
                      onClick={() => handleDeleteStep(index)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                      title="Delete Step"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                     </button>
                  </div>
              </div>
              
              {/* Insert Button Divider */}
              <div className="border-t border-gray-200 pt-2 flex justify-center">
                  <button 
                    onClick={() => handleInsertStep(index)}
                    className="text-xs font-bold text-afs-medGrey hover:text-afs-orange flex items-center gap-1 px-3 py-1 rounded hover:bg-orange-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Insert Step Below
                  </button>
              </div>
            </div>
          ))}

          <button 
            onClick={handleAddStepAtEnd}
            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold hover:border-afs-navy hover:text-afs-navy hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Step at End
          </button>
        </div>
      </div>

      {/* Capture / Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        maxWidth="max-w-6xl"
      >
        <div className="flex flex-col h-full" style={{minHeight: '600px'}}>
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold text-afs-navy">
               {mode === 'VIDEO' ? `Select Frame for Step ${(activeStepIndex ?? 0) + 1}` : `Edit Screenshot - Step ${(activeStepIndex ?? 0) + 1}`}
             </h3>
             {mode === 'IMAGE' && (
                <div className="flex gap-2 bg-gray-100 p-2 rounded-lg items-center shadow-sm">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2 hidden sm:inline">Tools:</span>
                  <button 
                    onClick={() => setActiveTool('CROP')}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-sm transition-all ${activeTool === 'CROP' ? 'bg-white shadow text-afs-orange border border-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    title="Drag to crop the image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span>Crop</span>
                  </button>
                  <button 
                    onClick={() => setActiveTool('BOX')}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-sm transition-all ${activeTool === 'BOX' ? 'bg-white shadow text-red-600 border border-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    title="Draw a red box"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                    <span>Box</span>
                  </button>
                  <button 
                    onClick={() => setActiveTool('ARROW')}
                    className={`flex items-center gap-2 px-3 py-2 rounded font-bold text-sm transition-all ${activeTool === 'ARROW' ? 'bg-white shadow text-red-600 border border-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
                    title="Draw a red arrow"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span>Arrow</span>
                  </button>
                  
                  <div className="w-px h-6 bg-gray-300 mx-2"></div>
                  
                   <button 
                    onClick={undo}
                    disabled={history.length <= 1}
                    className="flex items-center gap-2 px-3 py-2 rounded font-bold text-sm text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Undo last action"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span>Undo</span>
                  </button>
                </div>
             )}
          </div>

          <div className="flex-grow bg-gray-900 rounded overflow-hidden shadow-inner relative flex items-center justify-center">
             {mode === 'VIDEO' ? (
                <video 
                  ref={videoRef}
                  src={videoUrl}
                  className="max-h-full max-w-full"
                  controls
                  crossOrigin="anonymous"
                />
             ) : (
                <div className={`relative ${activeTool !== 'NONE' ? 'cursor-crosshair' : ''}`}>
                  <canvas 
                    ref={canvasRef}
                    className="max-w-full max-h-[60vh] object-contain shadow-lg"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                  
                  {/* Instructional Banner inside Canvas Area */}
                  {!interactionState && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full pointer-events-none transition-opacity">
                       {activeTool === 'NONE' && "Select a tool above to start editing"}
                       {activeTool === 'CROP' && "Drag over the image to Crop"}
                       {activeTool === 'BOX' && "Drag to draw a Red Box"}
                       {activeTool === 'ARROW' && "Drag to draw a Red Arrow"}
                    </div>
                  )}
                </div>
             )}
          </div>

          <div className="flex justify-between items-center text-sm text-gray-500 mt-4 border-t pt-4">
             <span>
               {mode === 'VIDEO' 
                 ? "Find the perfect frame using the video controls." 
                 : "Changes are applied immediately. Click Save when finished."}
             </span>
             
             <div className="flex gap-3">
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded transition-colors"
               >
                 Cancel
               </button>
               
               {mode === 'VIDEO' ? (
                 <button 
                   onClick={captureFrameToEdit}
                   className="px-6 py-2 bg-afs-orange text-white font-bold rounded shadow hover:bg-orange-600 transition-colors flex items-center gap-2"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                   </svg>
                   Capture Frame
                 </button>
               ) : (
                 <>
                   <button 
                     onClick={() => {
                        setMode('VIDEO');
                        setEditingImage(null);
                        setHistory([]);
                     }}
                     className="px-4 py-2 text-afs-navy font-bold hover:bg-blue-50 rounded transition-colors"
                   >
                     Retake from Video
                   </button>
                   <button 
                     onClick={saveEditedImage}
                     className="px-6 py-2 bg-afs-navy text-white font-bold rounded shadow hover:bg-blue-900 transition-colors flex items-center gap-2"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                     Save Screenshot
                   </button>
                 </>
               )}
             </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};