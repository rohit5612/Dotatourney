import { Link } from "react-router-dom";

export function StubPage({ title, description, ctaHref, ctaLabel = "Back to home" }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-3xl text-foreground">{title}</h1>
      <p className="mt-4 text-muted-foreground">{description}</p>
      <Link to={ctaHref} className="btn btn-primary mt-8 inline-flex">
        {ctaLabel}
      </Link>
    </section>
  );
}
