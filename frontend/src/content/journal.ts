/** Static article teasers on the home page. Each one opens the shop on its category. */
export interface JournalPost {
  tag: string;
  /** Category slug from GET /api/categories. */
  category: string;
  title: string;
  meta: string;
  image: string;
}

export const journalPosts: readonly JournalPost[] = [
  {
    tag: "Running",
    category: "running",
    title: "How to pick your first running shoe",
    meta: "5 min read · Guide",
    image: "/images/category-running.webp",
  },
  {
    tag: "Sneakers",
    category: "sneakers",
    title: "Air Force 1 vs Old Skool: which classic fits you?",
    meta: "4 min read · Style",
    image: "/images/category-sneakers.webp",
  },
  {
    tag: "Gym",
    category: "gym",
    title: "Five training basics you can buy under $50",
    meta: "6 min read · Training",
    image: "/images/category-gym.webp",
  },
];
