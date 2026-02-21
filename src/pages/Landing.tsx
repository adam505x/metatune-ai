import { useNavigate } from "react-router-dom";
import RotatingPrompt from "@/components/RotatingPrompt";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 page-enter">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-12 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
            MetaTune
          </span>
        </div>

        {/* Hero */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] animate-fade-in">
          Describe the problem.
          <br />
          <span className="text-muted-foreground">We'll train the model.</span>
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto animate-fade-in-up">
          Fine-tuning, without the PhD.
        </p>

        {/* CTA */}
        <div className="pt-4 animate-fade-in-up">
          <button
            onClick={() => navigate("/onboarding")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium text-base hover:opacity-90 transition-opacity"
          >
            Start training
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* Rotating prompt */}
        <div className="pt-8 animate-slide-up">
          <RotatingPrompt />
        </div>
      </div>
    </div>
  );
};

export default Landing;
