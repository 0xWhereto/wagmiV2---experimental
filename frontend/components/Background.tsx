"use client";

export function Background() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Main background color from Figma: #0E1218 */}
      <div className="absolute inset-0" style={{ background: '#0E1218' }} />
      
      {/* Mountain image positioned at bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 w-full"
        style={{ 
          height: '300px',
          backgroundImage: 'url(/images/mountains-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat'
        }}
      />
    </div>
  );
}
