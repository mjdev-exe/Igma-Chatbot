// Clean version of chatUtils.js - keeping only what's actually used

export const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
