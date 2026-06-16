import { Link } from "react-router-dom";
import "../../styles/legal-pages.css";

export function LegalPageLayout({ eyebrow, title, subtitle, meta, children, footerNote }) {
  return (
    <div className="legal-page-layout">
      <article className="legal-page">
        <header className="legal-page__header">
          {eyebrow ? <p className="legal-page__eyebrow">{eyebrow}</p> : null}
          <h1 className="legal-page__title">{title}</h1>
          {subtitle ? <p className="legal-page__subtitle">{subtitle}</p> : null}
          {meta ? <p className="legal-page__meta">{meta}</p> : null}
        </header>
        <div className="legal-page__body">{children}</div>
        {footerNote ? <p className="legal-page__footer-note">{footerNote}</p> : null}
      </article>
    </div>
  );
}

export function LegalSection({ title, accent = false, children }) {
  return (
    <section className={`legal-page__section${accent ? " legal-page__section--accent" : ""}`}>
      {title ? <h2 className="legal-page__section-title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function LegalLink({ to, children }) {
  return (
    <Link className="legal-page__link" to={to}>
      {children}
    </Link>
  );
}

export function LegalExternalLink({ href, children }) {
  return (
    <a className="legal-page__link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
