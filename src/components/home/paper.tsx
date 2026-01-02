import React from "react";

interface PaperProps {
  paragraphs?: string[];
}

const NOTEBOOK_LINE_HEIGHT = 32; // distance between paragraph lines
const PAPER_PADDING_TOP = 40;
const LEFT_MARGIN = 70;
const RIGHT_MARGIN = 24;

const Paper: React.FC<PaperProps> = ({
  paragraphs = [
    "PASSAGE: THE DOUBLE-EDGED SWORD OF CONNECTIVITY",
    "IN THE EARLY TWENTY-FIRST CENTURY, THE RISE OF DIGITAL TECHNOLOGY RESHAPED NEARLY EVERY ASPECT OF HUMAN LIFE.",
    "ONE OF THE MOST REMARKABLE BENEFITS OF GLOBAL CONNECTIVITY IS THE ABILITY TO SHARE INFORMATION INSTANTLY.",
    "A FARMER IN KENYA CAN LEARN MODERN IRRIGATION TECHNIQUES FROM AN ONLINE COURSE, WHILE A STUDENT IN BRAZIL CAN COLLABORATE ON A RESEARCH PROJECT WITH PEERS IN JAPAN.",
    "BUSINESSES, TOO, HAVE TRANSFORMED; ONLINE MARKETS ALLOW SMALL ENTREPRENEURS TO REACH GLOBAL AUDIENCES WITHOUT OWNING PHYSICAL STORES.",
    "IN MANY WAYS, DIGITAL TOOLS HAVE DEMOCRATIZED KNOWLEDGE AND OPPORTUNITY.", 
    "IN MANY WAYS, DIGITAL TOOLS HAVE DEMOCRATIZED KNOWLEDGE AND OPPORTUNITY.", 
    "IN MANY WAYS, DIGITAL TOOLS HAVE DEMOCRATIZED KNOWLEDGE AND OPPORTUNITY.", 
  ],
}) => {
  const totalHeight =
    PAPER_PADDING_TOP + paragraphs.length * NOTEBOOK_LINE_HEIGHT + 60;

  return (
    <div
      className="relative w-full bg-white"
      style={{
        minHeight: totalHeight,
        border: "1px solid #ccc",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* SVG lines below each paragraph */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background */}
        <rect x="0" y="0" width="100%" height="100%" fill="#fff" />

        {/* Red margin line */}
        <line
          x1={LEFT_MARGIN + 30}
          x2={LEFT_MARGIN + 30}
          y1="0"
          y2={totalHeight}
          stroke="#d91f20"
          strokeWidth={2}
          opacity={0.8}
        />

        {/* Blue horizontal line below each paragraph */}
        {paragraphs.map((_, i) => (
          <line
            key={i}
            x1={LEFT_MARGIN - 30}
            x2="95%"
            y1={PAPER_PADDING_TOP + (i + 1) * NOTEBOOK_LINE_HEIGHT}
            y2={PAPER_PADDING_TOP + (i + 1) * NOTEBOOK_LINE_HEIGHT}
            stroke="#4285F4"
            strokeWidth={1.5}
            opacity={0.25}
          />
        ))}
      </svg>

      {/* Text overlay */}
      <div
        className="relative z-10 text-black font-bold uppercase text-xs sm:text-base px-12"
        style={{
          paddingTop: PAPER_PADDING_TOP - 10,
          lineHeight: `${NOTEBOOK_LINE_HEIGHT}px`,
        }}
      >
        {paragraphs.map((p, idx) => (
          <p
            key={idx}
            style={{
              marginLeft: LEFT_MARGIN,
              marginRight: RIGHT_MARGIN,
              marginBottom: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </div>
  );
};

export default Paper;
