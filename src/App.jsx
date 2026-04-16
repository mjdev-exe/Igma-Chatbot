import React, { useState, useRef, useEffect } from "react";
import Header from "./components/Header";
import ChatMessage from "./components/ChatMessage";
import { formatTime } from "../utils/chatUtils";
import LoaderChat from "./components/LoaderChat";
import ChatInput from "./components/ChatInput";
import SplashScreen from "./components/SplashScreen";
import { generateContent } from "./Services/geminiAPI";

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello, how can I help you?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef(null);

  // Keep latest message visible after new messages/loading state updates.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Toggle between light and dark chat themes.
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Hide splash screen once intro animation ends.
  const handleSplashComplete = () => setShowSplash(false);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Add user message and fetch bot reply using recent conversation as context.
  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    const userMessage = {
      id: Date.now().toString(),
      text: trimmedInput,
      sender: "user",
      timestamp: new Date(),
    };

    // Optimistic update: render user message immediately for responsive UI.
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const recentMessages = [...messages, userMessage].slice(-5);
      const conversationContext = recentMessages
        .map((m) => `${m.sender === "user" ? "User" : "Igma"}: ${m.text}`)
        .join("\n");

      const botReply = await generateContent(trimmedInput, conversationContext);

      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: botReply,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Sorry, something went wrong. Please try again.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col min-h-dvh h-dvh ${
        darkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      <Header toggleDarkMode={toggleDarkMode} darkMode={darkMode} />
      <div className="flex-1 overflow-y-auto px-2 py-2 sm:px-3 sm:py-3 md:px-6 md:py-5">
        <div className="max-w-5xl mx-auto space-y-3 sm:space-y-4">
          {messages.map((message) => {
            return (
              <ChatMessage
                key={message.id}
                darkMode={darkMode}
                message={message}
                formatTime={formatTime}
              />
            );
          })}
          {isLoading && <LoaderChat darkMode={darkMode} />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput
        darkMode={darkMode}
        input={input}
        setInput={setInput}
        loading={isLoading}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default App;
