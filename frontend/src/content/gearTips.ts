/** The "Know your gear" cards on the home page. */
export interface GearTip {
  tag: string;
  question: string;
  answer: string;
  /** Background of the front of the card. */
  gradient: string;
}

export const gearTips: readonly GearTip[] = [
  {
    tag: "RUNNING",
    question: "How much space should a running shoe leave at the toe?",
    answer:
      "About a thumb’s width between your longest toe and the front of the shoe, because feet swell on longer runs.",
    gradient: "linear-gradient(140deg, #0297DE, #0B3A6B)",
  },
  {
    tag: "RUNNING",
    question: "When should you replace running shoes?",
    answer: "Most running shoes are worn out after roughly 500–800 km. Flat, creased cushioning is the sign.",
    gradient: "linear-gradient(140deg, #FC734D, #8A2A12)",
  },
  {
    tag: "FOOTBALL",
    question: "FG or AG boots?",
    answer:
      "FG (firm ground) studs are made for natural grass. AG (artificial ground) studs are shorter and safer on turf.",
    gradient: "linear-gradient(140deg, #D83995, #3B0B44)",
  },
  {
    tag: "BASKETBALL",
    question: "Indoor or outdoor ball?",
    answer: "Leather and composite balls are for indoor courts. Rubber balls last much longer on asphalt.",
    gradient: "linear-gradient(140deg, #16825D, #06301F)",
  },
];
