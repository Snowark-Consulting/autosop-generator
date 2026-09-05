import React, { useState, useRef, useEffect } from 'react';
import { UserDetails, SopData, AppState } from './types';
import { generateSopFromVideo } from './services/geminiService';
import { captureFrame } from './services/videoService';
import { SopPreview } from './components/SopPreview';
import { SopEditor } from './components/SopEditor';
import { Modal } from './components/Modal';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [userDetails, setUserDetails] = useState<UserDetails>({
    fullName: '',
    role: '',
    publicVideoUrl: ''
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sopData, setSopData] = useState<SopData | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [needsApiKey, setNeedsApiKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check configuration on load
    const checkConfiguration = async () => {
      // We check for AI Studio Environment API Key selection status
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setNeedsApiKey(true);
        }
      } 
    };

    checkConfiguration();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success if no error thrown, as per instructions
        setNeedsApiKey(false);
      } catch (e) {
        console.error("Failed to select key", e);
        setError("Failed to select API Key. Please try again.");
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVideoFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile || !userDetails.fullName || !userDetails.role) {
      setError("Please fill in all required fields and upload a video.");
      return;
    }

    setAppState(AppState.PROCESSING);
    setProcessingStatus('Analyzing video content...');

    try {
      // 1. Get Text/Timestamps from Gemini (using Frame Sampling + Audio)
      setProcessingStatus('Extracting audio & frames for analysis...');
      const data = await generateSopFromVideo(videoFile);
      
      setProcessingStatus(`Identified ${data.steps.length} steps. Capturing high-res screenshots...`);

      // 2. Extract Screenshots client-side
      // We use the original videoFile here to get high-quality images based on the timestamps
      const stepsWithScreenshots = await Promise.all(
        data.steps.map(async (step) => {
          try {
            const url = await captureFrame(videoFile, step.timestampSeconds);
            return { ...step, screenshotUrl: url };
          } catch (err) {
            console.error(`Failed to capture frame at ${step.timestampSeconds}`, err);
            return step; // Return step without screenshot if fails
          }
        })
      );

      setSopData({ ...data, steps: stepsWithScreenshots });
      // Go to Editing first instead of Preview
      setAppState(AppState.EDITING);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
      
      // If the error suggests API key issues, re-trigger the check
      if (err.message && (err.message.includes("API Key") || err.message.includes("400"))) {
          // Only force re-selection if we are in an environment that supports it
          if (window.aistudio) {
              setNeedsApiKey(true);
          }
      }
      
      setAppState(AppState.INPUT);
    }
  };

  const resetApp = () => {
    setAppState(AppState.INPUT);
    setVideoFile(null);
    setSopData(null);
    setError(null);
    setUserDetails({ fullName: '', role: '', publicVideoUrl: '' });
  };

  const handleEditorSave = (newData: SopData) => {
    setSopData(newData);
    setAppState(AppState.PREVIEW);
    setShowDoneModal(true);
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('sop-preview-content');
    if (!element || !window.html2pdf) {
      // Fallback
      window.print();
      return;
    }

    setIsGeneratingPdf(true);
    
    // Sanitize title but keep spaces and casing (Title Case)
    // Removes special characters like / \ : * ? " < > | that cause OS errors
    const safeTitle = sopData?.title.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const filename = `${safeTitle || 'SOP'}.pdf`;

    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5], // Top, Left, Bottom, Right
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      // Removed 'avoid-all' as it conflicts with explicit page breaks on large content
      pagebreak: { mode: ['css', 'legacy'] }
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      setIsGeneratingPdf(false);
    }).catch((err: any) => {
      console.error(err);
      setIsGeneratingPdf(false);
      alert('Failed to generate PDF automatically. Opening print dialog instead.');
      window.print();
    });
  };

  if (needsApiKey) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-afs-offWhite font-sans p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-afs-orange max-w-md w-full text-center">
             <img 
                src="https://cdn.shopify.com/s/files/1/1950/1891/files/TheAFSGroup.png?v=1766361187" 
                alt="The AFS Group" 
                className="h-16 mx-auto mb-6"
              />
            <h1 className="text-2xl font-bold text-afs-navy mb-4">Configuration Required</h1>
            <p className="text-gray-600 mb-6">
              To generate Standard Operating Procedures with AI, please select a valid Google Cloud API Key for this session.
            </p>
            <button 
              onClick={handleSelectKey}
              className="w-full bg-afs-orange hover:bg-orange-600 text-white font-bold py-3 rounded-lg shadow transition-colors"
            >
              Select API Key
            </button>
            <div className="mt-4 text-xs text-gray-400">
               <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-afs-navy">
                 Billing Information
               </a>
            </div>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans text-afs-darkGrey">
      
      {/* Main Content Area */}
      <main className="flex-grow bg-afs-offWhite">
        
        {/* INPUT STATE */}
        {appState === AppState.INPUT && (
          <div className="container mx-auto px-4 py-12 max-w-3xl">
            <div className="text-center mb-12">
              {!logoError && (
                <img 
                  src="https://cdn.shopify.com/s/files/1/1950/1891/files/TheAFSGroup.png?v=1766361187" 
                  alt="The AFS Group" 
                  className="h-20 mx-auto mb-6"
                  onError={() => setLogoError(true)}
                />
              )}
              {logoError && (
                <div className="h-20 flex items-center justify-center mb-6">
                   <h2 className="text-2xl font-bold text-afs-navy">The AFS Group</h2>
                </div>
              )}
              <h1 className="text-4xl font-display font-bold text-afs-navy mb-2">AutoSOP Creator</h1>
              <p className="text-lg text-afs-medGrey">Convert screen recordings into professional PDF procedures instantly.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-afs-orange">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-afs-navy mb-2" htmlFor="fullName">
                      Full Name *
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      value={userDetails.fullName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded border border-gray-300 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none transition-colors text-afs-darkGrey bg-gray-50"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-afs-navy mb-2" htmlFor="role">
                      Role *
                    </label>
                    <input
                      id="role"
                      name="role"
                      type="text"
                      required
                      value={userDetails.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded border border-gray-300 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none transition-colors text-afs-darkGrey bg-gray-50"
                      placeholder="Operations Manager"
                    />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-afs-navy mb-2" htmlFor="publicVideoUrl">
                      Public Video URL (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">If this video is hosted on Loom, YouTube, or Drive, paste the link here to include it in the SOP header.</p>
                    <input
                      id="publicVideoUrl"
                      name="publicVideoUrl"
                      type="url"
                      value={userDetails.publicVideoUrl}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded border border-gray-300 focus:border-afs-navy focus:ring-2 focus:ring-afs-navy/20 outline-none transition-colors text-afs-darkGrey bg-gray-50"
                      placeholder="https://loom.com/share/..."
                    />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-bold text-afs-navy mb-2">
                    Upload Screen Recording *
                  </label>
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      accept="video/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-afs-medGrey mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-afs-navy font-bold text-lg block mb-1">
                        {videoFile ? videoFile.name : 'Click to select video file'}
                      </span>
                      <span className="text-sm text-gray-500">MP4, MOV, WebM (Large files supported)</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-bold">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!videoFile}
                  className="w-full bg-afs-orange hover:bg-orange-600 text-white font-display font-bold text-xl py-4 rounded-lg shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  Generate SOP
                </button>

              </form>
            </div>
          </div>
        )}

        {/* PROCESSING STATE */}
        {appState === AppState.PROCESSING && (
          <div className="flex items-center justify-center min-h-screen">
             <div className="text-center max-w-md p-8">
               <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-afs-orange mx-auto mb-8"></div>
               <h2 className="text-2xl font-display font-bold text-afs-navy mb-4">Processing Video</h2>
               <p className="text-lg text-afs-medGrey animate-pulse">{processingStatus}</p>
               <p className="text-sm text-gray-400 mt-8">This may take a minute depending on video length...</p>
             </div>
          </div>
        )}

        {/* EDITING STATE */}
        {appState === AppState.EDITING && sopData && videoFile && (
           <SopEditor 
             initialData={sopData} 
             videoFile={videoFile}
             onSave={handleEditorSave}
             onCancel={() => setAppState(AppState.PREVIEW)} // Or back to input if you prefer, but usually staying or moving forward. If first time, maybe cancel resets?
           />
        )}

        {/* PREVIEW STATE */}
        {appState === AppState.PREVIEW && sopData && (
          <div>
            <div className="no-print bg-afs-navy text-white p-4 sticky top-0 z-40 shadow-md">
              <div className="container mx-auto flex justify-between items-center">
                <span className="font-bold font-display text-lg hidden sm:inline">Review Mode</span>
                <div className="flex space-x-4">
                  <button 
                    onClick={resetApp}
                    className="px-4 py-2 rounded bg-transparent border border-white/30 hover:bg-white/10 text-sm font-bold"
                  >
                    Start Over
                  </button>
                  <button 
                    onClick={() => setAppState(AppState.EDITING)}
                    className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-white text-sm font-bold border border-white/50"
                  >
                    Edit Content
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                  >
                    Print View
                  </button>
                  <button 
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="px-6 py-2 rounded bg-afs-orange hover:bg-orange-600 text-white text-sm font-bold shadow transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <SopPreview data={sopData} userDetails={userDetails} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-afs-navy text-white py-8 border-t border-gray-800 no-print">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm mb-2 text-gray-400">
            Created Using <a href="https://live-autosop-generator-140130628305.us-west1.run.app" className="text-afs-orange hover:text-white underline transition-colors">Internal AutoSOP Tool</a>
          </p>
          <p className="text-xs text-gray-500">
            Refer Josh Hancock for assistance
          </p>
        </div>
      </footer>

      {/* Success Modal */}
      <Modal isOpen={showDoneModal} onClose={() => setShowDoneModal(false)}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-display font-bold text-afs-navy mb-4">SOP Generated Successfully!</h3>
          <p className="text-gray-600 mb-8">
            Please save this document as a PDF and upload it to the central repository.
          </p>
          
          <a 
            href="https://drive.google.com/drive/folders/1DE3BJTjpafYIrs59EXr7QjaJCJ3gpBGw"
            target="_blank"
            rel="noreferrer"
            className="block w-full py-4 px-6 bg-afs-navy hover:bg-opacity-90 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
            onClick={() => setShowDoneModal(false)}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 2.985 3.76 6.578l3.735 6.533h3.765c2.07 0 3.745-.02 3.745-.047 0-.15-7.247-12.912-7.39-13.047-.075-.07-.38-.07-.468-.06zm-5.748.88C4.54 5.378 1.48 10.686 1.455 10.74c-.06.12.015.38.15.52.09.09 7.23 12.56 7.373 12.56.095 0 .285-.265 1.14-1.74l1.178-2.03H7.555c-4.48 0-6.19-.03-6.135-.11.025-.03 2.16-3.738 4.745-8.225l4.7-8.155-2.22-.65c-1.22-.36-2.26-.6-2.31-.54zm12.37 5.51L14.9 14.43l-3.73 6.47h8.77c6.88 0 8.765-.02 8.76-.08 0-.03-1.66-2.95-3.69-6.49l-3.69-6.44-1.68-.02z"/>
            </svg>
            Open 'Company Wide SOP' Folder
          </a>
          
          <button 
            onClick={() => setShowDoneModal(false)}
            className="mt-4 text-gray-500 hover:text-afs-navy text-sm font-semibold underline"
          >
            I'll do this later
          </button>
        </div>
      </Modal>

    </div>
  );
}

export default App;