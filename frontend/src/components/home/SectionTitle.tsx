/** The large heading that opens each home page section. */
export function SectionTitle({
  title,
  reveal,
}: {
  title: string;
  reveal?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className="home-title" ref={reveal}>
      <h2>{title}</h2>
    </div>
  );
}
