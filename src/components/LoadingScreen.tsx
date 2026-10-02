/** A full-area loading state: a sliding progress bar and what is happening (a map being prepared, a world opening). */
export default function LoadingScreen({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      {children}
      <div className="loading-progress-track">
        <div className="loading-progress-bar" />
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
}
