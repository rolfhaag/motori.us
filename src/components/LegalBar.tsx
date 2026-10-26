/** Small links bar under every page's own footer. */
export default function LegalBar() {
  return (
    <nav className="legal-bar" aria-label="Legal and following">
      <div className="wrap">
        <a href="/terms">Terms</a>
        <a href="/builder-terms">Builder Terms</a>
        <a href="/spotter-terms">Spotter Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/follow">Follow new builds</a>
        <a href="/feed.xml">RSS</a>
      </div>
    </nav>
  );
}
