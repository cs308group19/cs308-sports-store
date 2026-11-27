import { journalPosts } from "../../content/journal";
import { useReveal } from "../../hooks/useReveal";
import { SectionTitle } from "./SectionTitle";

export function JournalSection({ openCategory }: { openCategory: (slug: string) => void }) {
  const reveal = useReveal();

  return (
    <section id="journal" tabIndex={-1} className="home-section journal">
      <SectionTitle title="Read before you run." reveal={reveal} />
      <div className="journal-grid">
        {journalPosts.map((post, index) => (
          <div key={post.title} ref={reveal} style={{ "--delay": `${index * 120}ms` } as React.CSSProperties}>
            <button className="journal-card" onClick={() => openCategory(post.category)}>
              <span className="journal-photo">
                <img src={post.image} alt="" width="1600" height="1067" loading="lazy" />
                <span className="journal-tag">{post.tag}</span>
              </span>
              <b>{post.title}</b>
              <small>{post.meta}</small>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
