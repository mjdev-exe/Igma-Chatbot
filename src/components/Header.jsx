import React from "react";
import logo from "../assets/igmalogo.png";
import { Sun, Moon } from "lucide-react";

// Top navigation bar with branding and dark-mode toggle.
const Header = ({ toggleDarkMode, darkMode }) => {
  return (
    <header
      className={`${
        darkMode ? "bg-gray-800 text-white" : "bg-white"
      } shadow-lg py-2.5 sm:py-3.5 px-2.5 sm:px-5 border-b ${
        darkMode ? "border-gray-700" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          <div>
            <img
              src={logo}
              alt="IGMA logo"
              className="w-9 h-9 sm:w-14 sm:h-14 md:w-16 md:h-16 p-1"
            />
          </div>
          <h1 className="text-sm sm:text-xl md:text-2xl font-bold truncate pr-2">
            IGMA Chatbot
          </h1>
        </div>
        <div className="flex items-center flex-shrink-0">
          <button
            className={`p-2 sm:p-2.5 md:p-3 rounded-full cursor-pointer transition-colors ${
              darkMode ? "bg-gray-700 text-white" : "bg-gray-200"
            }`}
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
