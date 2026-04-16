import React, { useEffect, useState } from "react";
import logo from "../assets/igmalogo.png";

// Intro screen that briefly shows branding before chat loads.
const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [animationPhase, setAnimationPhase] = useState("fadeIn");

  useEffect(() => {
    // Sequence splash phases so the animation feels smooth and intentional.
    const timer1 = setTimeout(() => {
      setAnimationPhase("pulse");
    }, 400);

    const timer2 = setTimeout(() => {
      setAnimationPhase("fadeOut");
    }, 2200);

    const timer3 = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 2700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-700 via-red-600 to-red-500 px-4 sm:px-6">
      <div
        className={`w-full max-w-sm sm:max-w-md md:max-w-lg flex flex-col items-center justify-center transition-all duration-700 ${
          animationPhase === "fadeIn"
            ? "opacity-0 transform scale-95 translate-y-2"
            : animationPhase === "pulse"
            ? "opacity-100 transform scale-100 translate-y-0"
            : "opacity-0 transform scale-105 -translate-y-1"
        }`}
      >
        <div className="rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-7 sm:px-8 sm:py-10 shadow-2xl w-full">
          <div className="flex justify-center">
            <img
              src={logo}
              alt="IGMA logo"
              className={`w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-contain drop-shadow-lg transition-transform duration-700 ${
                animationPhase === "pulse" ? "scale-100" : "scale-95"
              }`}
            />
          </div>
          <h1 className="mt-4 sm:mt-5 text-center text-white text-xl sm:text-2xl md:text-3xl font-bold tracking-wide">
            IGMA Chatbot
          </h1>
          <p className="mt-2 text-center text-red-100 text-xs sm:text-sm md:text-base px-2">
            Your UE assistant is getting ready...
          </p>
        </div>
      </div>

      <div className="absolute bottom-8 sm:bottom-12 left-1/2 transform -translate-x-1/2">
        <div
          className={`transition-all duration-700 delay-300 ${
            animationPhase === "fadeIn"
              ? "opacity-0 transform translate-y-8"
              : animationPhase === "pulse"
              ? "opacity-100 transform translate-y-0"
              : "opacity-0 transform translate-y-8"
          }`}
        >
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/40 border-t-white"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;