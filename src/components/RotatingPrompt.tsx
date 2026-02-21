import { useState, useEffect } from "react";

const prompts = [
  "I want to classify customer support tickets by urgency",
  "I want to generate energy drink flavour descriptions",
  "I want to detect toxic comments in my app",
  "I want to summarize legal contracts into bullet points",
  "I want to extract product specs from reviews",
];

const RotatingPrompt = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const prompt = prompts[currentIndex];

    if (isTyping) {
      if (displayed.length < prompt.length) {
        const timeout = setTimeout(() => {
          setDisplayed(prompt.slice(0, displayed.length + 1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => setIsTyping(false), 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      if (displayed.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayed(displayed.slice(0, -1));
        }, 15);
        return () => clearTimeout(timeout);
      } else {
        setCurrentIndex((prev) => (prev + 1) % prompts.length);
        setIsTyping(true);
      }
    }
  }, [displayed, isTyping, currentIndex]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="surface-elevated rounded-md px-5 py-4 text-muted-foreground text-base md:text-lg">
        <span>{displayed}</span>
        <span className="text-primary ml-0.5 animate-pulse">|</span>
      </div>
    </div>
  );
};

export default RotatingPrompt;
