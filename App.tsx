import React, { useState, useRef, useEffect } from 'react';
import { UserDetails, SopData, AppState } from './types';
import { generateSopFromVideo, getGeminiKey, setGeminiKey, clearGeminiKey } from './services/geminiService';
import { captureFrame } from './services/videoService';
import { SopPreview } from './components/SopPreview';
import { SopEditor } from './components/SopEditor';
import { Modal } from './components/Modal';

const SNOWARK_LOGO =
  'https://raw.githubusercontent.com/Snowark-Consulting/snowark-pages/main/assets/logos/SnowArk-Primary.png';

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
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasApiKey(!!getGeminiKey());
  }, []);

  const openSettings = () => {
    setApiKey(getGeminiKey() || '');
    setShowSettings(true);
  };

  const saveSettings = () => {
    if (!apiKey.trim()) {
      clearGeminiKey();
      setHasApiKey(false);
    } else {
      setGeminiKey(apiKey);
      setHasApiKey(true);
    }
    setShowSettings(false);
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
    if (!hasApiKey) {
      setError("Please add your Gemini API key in Settings before generating.");
      return;
    }

    setAppState(AppState.PROCESSING);
    setProcessingStatus('Analyzing video content...');

    try {
      setProcessingStatus('Extracting audio & frames for analysis...');
      const data = await generateSopFromVideo(videoFile);

      setProcessingStatus(`Identified ${data.steps.length} steps. Capturing high-res screenshots...`);

      const stepsWithScreenshots = await Promise.all(
        data.steps.map(async (step) => {
          try {
            const url = await captureFrame(videoFile, step.timestampSeconds);
            return { ...step, screenshotUrl: url };
          } catch (err) {
            console.error(`Failed to capture frame at ${step.timestampSeconds}`, err);
            return step;
          }
        })
      );

      setSopData({ ...data, steps: stepsWithScreenshots });
      setAppState(AppState.EDITING);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during processing.");
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
      window.print();
      return;
    }

    setIsGeneratingPdf(true);

    const safeTitle = sopData?.title.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const filename = `${safeTitle || 'SOP'}.pdf`;

    const opt = {
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
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

  return (
    <div className="flex flex-col min-h-screen font-sans text-snowark-dark">

      {/* Top bar */}
      <header className="w-full bg-snowark-teal text-white no-print">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!logoError ? (
              <img src={SNOWARK_LOGO} alt="SnowArk" className="h-9 object-contain"
                   onError={() => setLogoError(true)} />
            ) : (
              <span className="font-display text-xl font-bold tracking-tight">SnowArk</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openSettings}
              className="text-sm font-bold px-4 py-2 rounded-lg border border-white/40 hover:bg-white/10 transition-colors">
              {hasApiKey ? 'Settings' : 'Add API Key'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow bg-snowark-warm">

        {/* INPUT STATE */}
        {appState === AppState.INPUT && (
          <div className="container mx-auto px-4 py-12 max-w-3xl">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-display font-bold text-snowark-teal mb-2">AutoSOP Creator</h1>
              <p className="text-lg text-snowark-muted">Turn screen recordings into professional PDF procedures.</p>
              {!hasApiKey && (
                <p className="mt-4 text-sm text-snowark-muted">
                  You need a Gemini API key to generate. Add one in{' '}
                  <button onClick={openSettings} className="underline text-snowark-green font-bold">Settings</button>.
                </p>
              )}
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-snowark-green">
              <form onSubmit={handleSubmit} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-snowark-teal mb-2" htmlFor="fullName">
                      Full Name *
                    </label>
                    <input
                      id="fullName" name="fullName" type="text" required
                      value={userDetails.fullName} onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded border border-gray-300 focus:border-snowark-teal focus:ring-2 focus:ring-snowark-teal/20 outline-none transition-colors text-snowark-dark bg-gray-50"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-snowark-teal mb-2" htmlFor="role">
                      Role *
                    </label>
                    <input
                      id="role" name="role" type="text" required
                      value={userDetails.role} onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded border border-gray-300 focus:border-snowark-teal focus:ring-2 focus:ring-snowark-teal/20 outline-none transition-colors text-snowark-dark bg-gray-50"
                      placeholder="Operations Manager"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-snowark-teal mb-2" htmlFor="publicVideoUrl">
                    Public Video URL (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">If this video is hosted on Loom, YouTube, or Drive, paste the link here to include it in the SOP header.</p>
                  <input
                    id="publicVideoUrl" name="publicVideoUrl" type="url"
                    value={userDetails.publicVideoUrl} onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded border border-gray-300 focus:border-snowark-teal focus:ring-2 focus:ring-snowark-teal/20 outline-none transition-colors text-snowark-dark bg-gray-50"
                    placeholder="https://loom.com/share/..."
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-bold text-snowark-teal mb-2">
                    Upload Screen Recording *
                  </label>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file" accept="video/*" className="hidden" ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-snowark-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-snowark-teal font-bold text-lg block mb-1">
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
                  className="w-full bg-snowark-green hover:bg-green-600 text-white font-display font-bold text-xl py-4 rounded-lg shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-snowark-green mx-auto mb-8"></div>
              <h2 className="text-2xl font-display font-bold text-snowark-teal mb-4">Processing Video</h2>
              <p className="text-lg text-snowark-muted animate-pulse">{processingStatus}</p>
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
            onCancel={() => setAppState(AppState.PREVIEW)}
          />
        )}

        {/* PREVIEW STATE */}
        {appState === AppState.PREVIEW && sopData && (
          <div>
            <div className="no-print bg-snowark-teal text-white p-4 sticky top-0 z-40 shadow-md">
              <div className="container mx-auto flex justify-between items-center">
                <span className="font-bold font-display text-lg hidden sm:inline">Review Mode</span>
                <div className="flex space-x-4">
                  <button onClick={resetApp}
                    className="px-4 py-2 rounded bg-transparent border border-white/30 hover:bg-white/10 text-sm font-bold">
                    Start Over
                  </button>
                  <button onClick={() => setAppState(AppState.EDITING)}
                    className="px-4 py-2 rounded bg-white/20 hover:bg-white/30 text-white text-sm font-bold border border-white/50">
                    Edit Content
                  </button>
                  <button onClick={() => window.print()}
                    className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors">
                    Print View
                  </button>
                  <button onClick={handleDownloadPdf} disabled={isGeneratingPdf}
                    className="px-6 py-2 rounded bg-snowark-green hover:bg-green-600 text-white text-sm font-bold shadow transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait">
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
      <footer className="bg-snowark-teal text-white py-8 border-t border-gray-800 no-print">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm mb-2 text-gray-200">
            Built with SnowArk AutoSOP. Generated sheets are internal documents.
          </p>
          <p className="text-xs text-gray-400">
            SnowArk Consulting
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} maxWidth="max-w-md">
        <div>
          <h3 className="text-2xl font-display font-bold text-snowark-teal mb-2">Gemini API Key</h3>
          <p className="text-sm text-snowark-muted mb-6">
            Enter a Google Gemini API key to generate SOPs. The key is stored only in your browser
            (localStorage) and used directly by the app. It does not leave your machine.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-3 rounded border border-gray-300 focus:border-snowark-teal focus:ring-2 focus:ring-snowark-teal/20 outline-none transition-colors mb-6"
          />
          <div className="flex gap-3">
            <button onClick={() => setShowSettings(false)}
              className="flex-1 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-snowark-teal font-bold transition-colors">
              Cancel
            </button>
            <button onClick={saveSettings}
              className="flex-1 px-4 py-2 rounded bg-snowark-green hover:bg-green-600 text-white font-bold transition-colors">
              Save Key
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline hover:text-snowark-teal">
              Get a Gemini API key
            </a>
          </p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={showDoneModal} onClose={() => setShowDoneModal(false)}>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-display font-bold text-snowark-teal mb-4">SOP Generated Successfully!</h3>
          <p className="text-gray-600 mb-8">
            Please save this document as a PDF and file it in your SOP repository.
          </p>
          <button onClick={() => setShowDoneModal(false)}
            className="mt-4 text-gray-500 hover:text-snowark-teal text-sm font-semibold underline">
            I'll do this later
          </button>
        </div>
      </Modal>

    </div>
  );
}

export default App;