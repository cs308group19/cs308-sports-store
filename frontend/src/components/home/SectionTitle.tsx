/** The numbered mono label and large heading that open each home page section. */
export function SectionTitle({
  label,
  title,
  hot = false,
  reveal,
}: {
  label: string;
  title: string;
  hot?: boolean;
  reveal?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className="home-title" ref={reveal}>
      <span className={`mono-label ${hot ? "hot" : ""}`}>{label}</span>
      <h2>{title}</h2>
    </div>
  );
}
