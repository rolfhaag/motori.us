/** The standard top bar for React-rendered pages (matches the hand-built pages). */
export default function SiteHeader() {
  return (
    <header className="site">
      <div className="navbar">
        <div className="navleft">
          <a className="brand" href="/">
            motori<em>.</em>us
          </a>
        </div>
        <nav className="navright">
          <a href="/about/">About</a>
          <span id="auth-slot"></span>
        </nav>
      </div>
    </header>
  );
}
