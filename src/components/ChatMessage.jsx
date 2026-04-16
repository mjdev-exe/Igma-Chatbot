import { User } from "lucide-react";
import logo from "../assets/igmalogo.png";

// Renders one chat bubble, styled by sender and theme mode.
const ChatMessage = ({ darkMode, message, formatTime }) => {
  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex w-fit max-w-[92%] sm:max-w-[84%] lg:max-w-[66%] rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3.5 ${
          message.sender === "user"
            ? "bg-gradient-to-r from-red-500 to-red-300 text-white shadow-md"
            : darkMode
            ? "bg-gray-700 text-gray-100 border border-gray-700"
            : "bg-white text-gray-800 shadow-md"
        }`}
      >
        <div
          className={`flex-shrink-0 mr-2 sm:mr-3 ${
            message.sender === "user"
              ? "opacity-70"
              : darkMode
              ? "text-gray-400"
              : "text-gray-600"
          }`}
        >
          {message.sender === "user" ? (
            <User size={18} className="sm:w-5 sm:h-5" />
          ) : (
            <img src={logo} alt="Logo" className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex justify-between items-center">
            <span className="font-medium text-sm sm:text-base">
              {message.sender === "user" ? "You" : "Igma"}
            </span>
            <span
              className={`text-xs ${
                message.sender === "user"
                  ? "opacity-70"
                  : darkMode
                  ? "text-gray-400"
                  : "text-gray-600"
              } ml-2`}
            >
              {formatTime(message.timestamp)}
            </span>
          </div>
          <p className="text-sm sm:text-[15px] md:text-base whitespace-pre-wrap break-words leading-relaxed">
            {message.text}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
