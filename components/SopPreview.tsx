import React from 'react';
import { SopData, UserDetails } from '../types';

interface SopPreviewProps {
  data: SopData;
  userDetails: UserDetails;
}

export const SopPreview: React.FC<SopPreviewProps> = ({ data, userDetails }) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div id="sop-preview-content" className="bg-white min-h-screen p-8 md:p-16 max-w-5xl mx-auto shadow-2xl print:shadow-none print:w-full print:max-w-none flex flex-col relative overflow-hidden">
      {/* Header */}
      <header className="border-b-4 border-afs-orange pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <img 
            src="https://cdn.shopify.com/s/files/1/1950/1891/files/TheAFSGroup.png?v=1766361187" 
            alt="The AFS Group" 
            className="h-16 mb-4 object-contain"
            crossOrigin="anonymous"
          />
          <h1 className="text-4xl font-display font-bold text-afs-navy mb-2 break-words max-w-2xl">
            {data.title}
          </h1>
          <div className="text-afs-medGrey font-sans">
            <p><span className="font-bold">Date:</span> {currentDate}</p>
            <p><span className="font-bold">Created By:</span> {userDetails.fullName} | {userDetails.role}</p>
            {userDetails.publicVideoUrl && (
              <p className="mt-1">
                <span className="font-bold">Video Reference:</span>{' '}
                <a href={userDetails.publicVideoUrl} target="_blank" rel="noreferrer" className="text-afs-orange underline">
                  View Source Video
                </a>
              </p>
            )}
          </div>
        </div>
        <div className="text-right hidden md:block print:hidden" data-html2canvas-ignore>
            <span className="bg-afs-navy text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
              Internal Use Only
            </span>
        </div>
      </header>

      {/* Overview */}
      <section className="mb-8">
        <h2 className="text-2xl font-display font-bold text-afs-navy mb-3 border-b border-gray-200 pb-2">
          1.0 Overview
        </h2>
        <p className="text-lg text-afs-darkGrey leading-relaxed font-sans">
          {data.overview}
        </p>
      </section>

      {/* Steps - Starts on new page for PDF */}
      <section className="flex-grow" style={{ pageBreakBefore: 'always' }}>
        <h2 className="text-2xl font-display font-bold text-afs-navy mb-6 border-b border-gray-200 pb-2 pt-2">
          2.0 Instructions
        </h2>
        <div className="space-y-8 mb-12">
          {data.steps.map((step, index) => (
            <div key={index} className="pdf-item" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-afs-navy text-white flex items-center justify-center font-bold font-display">
                  {step.stepNumber}
                </div>
                <div className="flex-grow pt-1">
                  <p className="text-lg text-afs-darkGrey font-medium font-sans">
                    {step.description}
                  </p>
                </div>
              </div>
              
              {step.screenshotUrl && (
                <div className="ml-12 mb-2 border-2 border-gray-100 rounded-lg overflow-hidden bg-gray-50 max-w-2xl">
                   <img 
                    src={step.screenshotUrl} 
                    alt={`Screenshot for Step ${step.stepNumber}`} 
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              <div className="ml-12 text-xs text-gray-400 font-mono">
                Video Timestamp: {new Date(step.timestampSeconds * 1000).toISOString().substr(14, 5)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer / Back Page Branding */}
      <div className="mt-16 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
         <div className="bg-afs-navy rounded-xl overflow-hidden shadow-lg border-t-4 border-afs-orange relative p-8 md:p-12 text-center text-white">
            
            <h3 className="text-3xl font-display font-bold mb-2 tracking-tight">The AFS Group</h3>
            <p className="text-white/60 text-sm mb-8 uppercase tracking-widest font-bold">Standard Operating Procedure</p>
            
            <div className="flex flex-col items-center justify-center space-y-4">
                <p className="text-white/80 font-medium">
                  Generated automatically by
                </p>
                <a 
                  href="https://live-autosop-generator-140130628305.us-west1.run.app" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-block bg-afs-orange text-white px-8 py-4 rounded-lg font-bold hover:bg-white hover:text-afs-navy transition-all duration-300 shadow-md no-underline text-lg"
                >
                  AutoSOP Generator
                </a>
                {/* Print-only URL for reference */}
                <p className="text-white/40 text-xs font-mono mt-2 hidden print:block">
                  https://live-autosop-generator-140130628305.us-west1.run.app
                </p>
            </div>

            <div className="mt-10 pt-8 border-t border-white/10 text-xs text-white/40 flex flex-col md:flex-row justify-center items-center gap-4">
               <span>© {new Date().getFullYear()} The AFS Group</span>
               <span className="hidden md:block">•</span>
               <span>Technical Support: Josh Hancock</span>
            </div>
            
            {/* Texture */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" 
                 style={{backgroundImage: 'radial-gradient(circle at 50% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px'}}>
            </div>
         </div>
      </div>
    </div>
  );
};