import { Send } from "lucide-react";

// Handles user text entry and submit actions for the chat.
const ChatInput = ({
  darkMode,
  input,
  setInput,
  loading,
  handleSendMessage,
}) => {
  return (
    <div
      className={`${
        darkMode
          ? "bg-gray-800 border-t border-gray-700"
          : "bg-white border-t border-gray-200 "
      } px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends the message; Shift+Enter is reserved for multiline in future.
              if (e.key === "Enter" && !e.shiftKey && !loading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={loading}
            placeholder="Type your message..."
            className={`min-w-0 flex-1 border ${
              darkMode
                ? "bg-gray-700 border-gray-700 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900"
            } ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            } rounded-full px-3 sm:px-5 py-2 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent`}
          />
          <button
            className={`shrink-0 p-2 sm:p-2.5 rounded-full transition-colors shadow-md ${
              loading || !input.trim()
                ? "opacity-50 cursor-not-allowed"
                : darkMode
                ? "cursor-pointer hover:bg-gray-700"
                : "cursor-pointer hover:bg-gray-100"
            }`}
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <Send
              size={16}
              className={`sm:w-[18px] sm:h-[18px] ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
