(function () {
  var STORAGE_KEY = "emoteAI_stories_v1";
  var KEY_STORAGE_KEY = "emoteAI_openrouter_key_v1";

  var state = {
    tone: "gentle",
    messages: [],
    stories: [],
    apiKey: "",
    online: false,
    typingId: null,
    suggestions: [],
    sessionEmotion: "",
    editingStoryId: null,
    listening: false,
    recognizer: null,
    voiceProfile: "soft",
    voiceRate: 0.96,
    voicePitch: 1.02,
    voiceId: "",
    voices: [],
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    bindEvents();
    initVoices();
    loadStories();
    renderStories();
    addInitialBotMessage();
    initOnlineState();
  });

  function cacheElements() {
    els.messages = document.getElementById("chatMessages");
    els.chatInput = document.getElementById("chatInput");
    els.chatForm = document.getElementById("chatForm");
    els.sendButton = document.getElementById("sendButton");
    els.micButton = document.getElementById("micButton");
    els.chatSuggestions = document.getElementById("chatSuggestions");
    els.quickEmotionButtons = document.querySelectorAll("[data-emotion]");
    els.toolButtons = document.querySelectorAll("[data-insert-text]");
    els.toneButtons = document.querySelectorAll("#toneSelector .chip");

    els.storyForm = document.getElementById("storyForm");
    els.storyTitle = document.getElementById("storyTitle");
    els.storyMood = document.getElementById("storyMood");
    els.storyBody = document.getElementById("storyBody");
    els.storyLesson = document.getElementById("storyLesson");
    els.storyFilter = document.getElementById("storyFilter");
    els.storyList = document.getElementById("storyList");

    els.apiKeyInput = document.getElementById("apiKeyInput");
    els.aiToggle = document.getElementById("aiToggle");
    els.chatStatusLabel = document.querySelector(".chat-status__label");
    els.chatStatusDot = document.querySelector(".chat-status__dot");

    els.apiHelpOpen = document.getElementById("apiHelpOpen");
    els.apiHelpModal = document.getElementById("apiHelpModal");
    els.apiHelpClose = document.getElementById("apiHelpClose");
    els.apiHelpBackdrop = els.apiHelpModal
      ? els.apiHelpModal.querySelector("[data-close-help]")
      : null;

    els.sessionEmotion = document.getElementById("sessionEmotion");
    els.quickCustom = document.getElementById("quickCustom");
    els.storySearch = document.getElementById("storySearch");
    els.voiceProfile = document.getElementById("voiceProfile");
    els.voiceRate = document.getElementById("voiceRate");
    els.voicePitch = document.getElementById("voicePitch");
    els.voiceSystem = document.getElementById("voiceSystem");
  }

  function handleDeleteStory(id) {
    var index = -1;
    for (var i = 0; i < state.stories.length; i++) {
      if (state.stories[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) return;
    if (!window.confirm("Delete this story? This cannot be undone.")) return;
    state.stories.splice(index, 1);
    saveStories();
    renderStories();
  }

  function handleEditStory(id) {
    if (!els.storyTitle || !els.storyMood || !els.storyBody) return;
    var story = null;
    for (var i = 0; i < state.stories.length; i++) {
      if (state.stories[i].id === id) {
        story = state.stories[i];
        break;
      }
    }
    if (!story) return;

    els.storyTitle.value = story.title || "";
    els.storyMood.value = story.mood || "";
    els.storyBody.value = story.body || "";
    if (els.storyLesson) {
      els.storyLesson.value = story.lesson || "";
    }

    state.editingStoryId = id;
    els.storyTitle.focus();
  }

  function initOnlineState() {
    loadApiKeyFromStorage();
    if (!state.online) {
      setOnlineMode(false);
    }
    setChatEnabled(!!state.apiKey && state.online);
  }

  function bindEvents() {
    if (els.chatForm) {
      els.chatForm.addEventListener("submit", function (event) {
        event.preventDefault();
        handleSend();
      });
    }

    if (els.sessionEmotion) {
      els.sessionEmotion.addEventListener("change", function () {
        state.sessionEmotion = els.sessionEmotion.value || "";
        updateSuggestions(els.chatInput ? els.chatInput.value || "" : "");
      });
    }

    if (els.quickCustom) {
      els.quickCustom.addEventListener("click", function () {
        var text = window.prompt(
          "Add a short phrase that describes how you're arriving right now:"
        );
        if (text) {
          insertTextIntoChat(text);
        }
      });
    }

    if (els.chatInput) {
      els.chatInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSend();
        }
      });

      els.chatInput.addEventListener("input", function () {
        updateSuggestions(els.chatInput.value || "");
      });
    }

    if (els.micButton) {
      els.micButton.addEventListener("click", function () {
        handleMicClick();
      });
    }

    if (els.voiceProfile) {
      els.voiceProfile.addEventListener("change", function () {
        handleVoiceProfileChange(els.voiceProfile.value || "");
      });
    }

    if (els.voiceRate) {
      els.voiceRate.addEventListener("input", function () {
        var value = parseFloat(els.voiceRate.value);
        if (!isNaN(value)) {
          state.voiceRate = value;
          state.voiceProfile = "custom";
          syncVoiceControls();
        }
      });
    }

    if (els.voicePitch) {
      els.voicePitch.addEventListener("input", function () {
        var value = parseFloat(els.voicePitch.value);
        if (!isNaN(value)) {
          state.voicePitch = value;
          state.voiceProfile = "custom";
          syncVoiceControls();
        }
      });
    }

    if (els.voiceSystem) {
      els.voiceSystem.addEventListener("change", function () {
        handleSystemVoiceChange(els.voiceSystem.value || "");
      });
    }

    if (els.quickEmotionButtons) {
      els.quickEmotionButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          var emotion = button.getAttribute("data-emotion");
          handleQuickEmotion(emotion);
        });
      });
    }

    if (els.toolButtons) {
      els.toolButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          var text = button.getAttribute("data-insert-text");
          insertTextIntoChat(text);
        });
      });
    }

    if (els.toneButtons) {
      els.toneButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          var tone = button.getAttribute("data-tone");
          setTone(tone);
        });
      });
    }

    if (els.storyForm) {
      els.storyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        handleStorySubmit();
      });
    }

    if (els.storyFilter) {
      els.storyFilter.addEventListener("change", function () {
        renderStories();
      });
    }

    if (els.storySearch) {
      els.storySearch.addEventListener("input", function () {
        renderStories();
      });
    }

    if (els.storyList) {
      els.storyList.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var actionEl = target.closest("[data-story-action]");
        if (!actionEl) return;
        var action = actionEl.getAttribute("data-story-action");
        var id = actionEl.getAttribute("data-story-id");
        if (!id) return;
        if (action === "delete") {
          handleDeleteStory(id);
        } else if (action === "edit") {
          handleEditStory(id);
        }
      });
    }

    if (els.chatSuggestions) {
      els.chatSuggestions.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var button = target.closest("[data-suggestion]");
        if (!button) return;
        var text = button.getAttribute("data-suggestion") || "";
        if (text) {
          insertTextIntoChat(text);
        }
      });
    }

    if (els.messages) {
      els.messages.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var speakButton = target.closest("[data-speak-id]");
        if (!speakButton) return;
        var id = speakButton.getAttribute("data-speak-id");
        if (!id) return;
        handleSpeakMessage(id);
      });
    }

    if (els.apiKeyInput) {
      els.apiKeyInput.addEventListener("input", function () {
        handleApiKeyInput();
      });
    }

    if (els.aiToggle) {
      els.aiToggle.addEventListener("click", function () {
        handleToggleAI();
      });
    }

    if (els.apiHelpOpen && els.apiHelpModal) {
      els.apiHelpOpen.addEventListener("click", function () {
        openHelpModal();
      });
    }

    if (els.apiHelpClose && els.apiHelpModal) {
      els.apiHelpClose.addEventListener("click", function () {
        closeHelpModal();
      });
    }

    if (els.apiHelpBackdrop && els.apiHelpModal) {
      els.apiHelpBackdrop.addEventListener("click", function () {
        closeHelpModal();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeHelpModal();
      }
    });
  }

  function addInitialBotMessage() {
    if (state.messages.length > 0) return;

    var intro =
      "Hi, I'm EmoteAI. This is a small space to vent, sort through feelings, and get gentle suggestions.\n\n" +
      "I'm not a professional or a crisis service, but I'll try to respond with care.\n\n" +
      "What feels most present for you right now?";

    addMessage("bot", intro);
    updateSuggestions("");

    syncVoiceControls();
  }

  function handleSend() {
    if (!els.chatInput) return;

    var text = els.chatInput.value.trim();
    if (!text) return;

    addMessage("user", text);
    els.chatInput.value = "";
    els.chatInput.focus();

    updateSuggestions(text);
    respondToUser(text);
  }

  function respondToUser(text) {
    showTypingIndicator();
    if (state.online && state.apiKey) {
      callOnlineAI(text)
        .then(function (reply) {
          hideTypingIndicator();
          addMessage("bot", reply);
        })
        .catch(function (error) {
          hideTypingIndicator();

          var isAuthError =
            error &&
            typeof error.message === "string" &&
            (error.message.indexOf("HTTP 401") !== -1 ||
              error.message.indexOf("HTTP 403") !== -1);

          if (isAuthError) {
            handleInvalidApiKey();
            addMessage(
              "bot",
              "The OpenRouter API key seems invalid or was rejected. Please paste a working key in the header to continue."
            );
            return;
          }

          addMessage(
            "bot",
            "I had trouble reaching the online model just now, so I'll respond from the local support mode instead."
          );
          setTimeout(function () {
            var fallback = generateSupportiveReply(text);
            addMessage("bot", fallback);
          }, 250);
        });
    } else {
      setTimeout(function () {
        hideTypingIndicator();
        var reply = generateSupportiveReply(text);
        addMessage("bot", reply);
      }, 350);
    }
  }

  function handleApiKeyInput() {
    if (!els.apiKeyInput) return;

    var value = els.apiKeyInput.value || "";
    state.apiKey = value.trim();

    if (!state.apiKey && state.online) {
      setOnlineMode(false);
    }

    saveApiKeyToStorage();
    setChatEnabled(!!state.apiKey && state.online);
  }

  function handleToggleAI() {
    if (!state.online) {
      if (!state.apiKey) {
        addMessage(
          "bot",
          "To turn on online AI, paste a valid OpenRouter API key into the field above. For now I'll keep using the offline support mode."
        );
        return;
      }
      setOnlineMode(true);
    } else {
      setOnlineMode(false);
    }
  }

  function setOnlineMode(enabled) {
    state.online = !!enabled;

    if (els.aiToggle) {
      els.aiToggle.textContent = state.online
        ? "AI mode: Online (OpenRouter)"
        : "AI mode: Offline (local)";
    }

    if (els.chatStatusLabel) {
      els.chatStatusLabel.textContent = state.online
        ? "Emotional Support Bot · Online (OpenRouter)"
        : "Emotional Support Bot · Offline (local mode)";
    }

    if (els.chatStatusDot) {
      if (state.online) {
        els.chatStatusDot.style.backgroundColor = "#22c55e";
        els.chatStatusDot.style.boxShadow = "0 0 0 5px rgba(34, 197, 94, 0.28)";
      } else {
        els.chatStatusDot.style.backgroundColor = "#4b5563";
        els.chatStatusDot.style.boxShadow = "0 0 0 3px rgba(75, 85, 99, 0.6)";
      }
    }

    setChatEnabled(!!state.apiKey && state.online);
  }

  function setChatEnabled(enabled) {
    var disabled = !enabled;

    if (els.chatInput) {
      els.chatInput.disabled = disabled;
    }
    if (els.sendButton) {
      els.sendButton.disabled = disabled;
    }
    if (els.micButton) {
      els.micButton.disabled = disabled;
    }
    if (els.quickEmotionButtons) {
      els.quickEmotionButtons.forEach(function (button) {
        button.disabled = disabled;
      });
    }
    if (els.toolButtons) {
      els.toolButtons.forEach(function (button) {
        button.disabled = disabled;
      });
    }
    if (els.storyMood) {
      els.storyMood.disabled = disabled;
    }
    if (els.storyFilter) {
      els.storyFilter.disabled = disabled;
    }
    if (els.storySearch) {
      els.storySearch.disabled = disabled;
    }
    if (els.sessionEmotion) {
      els.sessionEmotion.disabled = disabled;
    }
    if (els.quickCustom) {
      els.quickCustom.disabled = disabled;
    }
    if (els.chatSuggestions) {
      els.chatSuggestions.style.opacity = disabled ? "0.6" : "";
      els.chatSuggestions.style.pointerEvents = disabled ? "none" : "";
    }
    if (disabled && state.listening) {
      stopSpeechRecognition();
    }
  }

  function handleQuickEmotion(emotion) {
    if (!els.chatInput) return;

    var templates = {
      sad: "I'm feeling really low right now and could use a gentle place to talk.",
      anxious: "I'm feeling anxious and on edge. Can we unpack what's going on?",
      angry: "I'm feeling irritated and angry, and I don't fully know what to do with it.",
      overwhelmed: "I'm overwhelmed by everything I have to hold right now.",
      lonely: "I'm feeling pretty alone in what I'm going through.",
    };

    var base = templates[emotion] || "I'm not feeling great and could use a place to talk.";

    if (!els.chatInput.value) {
      els.chatInput.value = base;
    } else {
      els.chatInput.value = els.chatInput.value.replace(/\s+$/, "") + "\n" + base;
    }

    els.chatInput.focus();
  }

  function insertTextIntoChat(text) {
    if (!els.chatInput || !text) return;

    if (!els.chatInput.value) {
      els.chatInput.value = text;
    } else {
      els.chatInput.value = els.chatInput.value.replace(/\s+$/, "") + "\n" + text;
    }

    els.chatInput.focus();
  }

  function setTone(tone) {
    if (!tone) return;
    state.tone = tone;

    if (els.toneButtons) {
      els.toneButtons.forEach(function (button) {
        var isActive = button.getAttribute("data-tone") === tone;
        if (isActive) button.classList.add("chip--active");
        else button.classList.remove("chip--active");
      });
    }

    if (els.chatInput) {
      updateSuggestions(els.chatInput.value || "");
    }
  }

  function addMessage(role, text) {
    state.messages.push({
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      role: role,
      text: text,
      createdAt: new Date().toISOString(),
      justAdded: true,
    });

    renderMessages();
  }

  function renderMessages() {
    if (!els.messages) return;

    els.messages.innerHTML = "";

    state.messages.forEach(function (message) {
      var wrap = document.createElement("div");
      var classes =
        "chat-message " +
        (message.role === "user" ? "chat-message--user" : "chat-message--bot");
      if (message.typing) {
        classes += " chat-message--typing";
      } else if (message.justAdded) {
        classes += " chat-message--new";
      }
      wrap.className = classes;

      var avatar = document.createElement("div");
      avatar.className = "chat-message__avatar";
      avatar.textContent = message.role === "user" ? "You" : "EA";

      var content = document.createElement("div");
      content.className = "chat-message__content";

      var meta = document.createElement("div");
      meta.className = "chat-message__meta";
      meta.textContent =
        (message.role === "user" ? "You" : "EmoteAI") +
        " · " +
        formatTime(message.createdAt);

      var bubble = document.createElement("div");
      bubble.className = "chat-message__bubble";
      if (message.typing) {
        bubble.textContent = "EmoteAI is thinking…";
      } else {
        bubble.innerHTML = escapeHtml(message.text).replace(/\n/g, "<br>");
      }

      content.appendChild(meta);
      content.appendChild(bubble);

      if (!message.typing && message.text) {
        var tools = document.createElement("div");
        tools.className = "chat-message__tools";

        var speakBtn = document.createElement("button");
        speakBtn.type = "button";
        speakBtn.className =
          "chat-message__speaker" +
          (message.role === "bot" ? " chat-message__speaker--bot" : "");
        speakBtn.setAttribute("data-speak-id", message.id);
        speakBtn.textContent = "▶ Listen";

        tools.appendChild(speakBtn);
        content.appendChild(tools);
      }

      wrap.appendChild(avatar);
      wrap.appendChild(content);

      els.messages.appendChild(wrap);

      if (message.justAdded) {
        message.justAdded = false;
      }
    });

    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function handleSpeakMessage(id) {
    if (!id || !state.messages || !state.messages.length) return;

    var message = null;
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i].id === id) {
        message = state.messages[i];
        break;
      }
    }
    if (!message || !message.text) return;

    speakMessageText(message.text, message.role);
  }

  function speakMessageText(text, role) {
    if (!text) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
      var utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";

      var rate = state.voiceRate || 1.0;
      var pitch = state.voicePitch || 1.0;
      utterance.rate = rate;
      utterance.pitch = pitch;

      if (state.voiceId && state.voices && state.voices.length) {
        for (var i = 0; i < state.voices.length; i++) {
          if (state.voices[i].voiceURI === state.voiceId) {
            utterance.voice = state.voices[i];
            break;
          }
        }
      }
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      // fail silently if speech synthesis is not available
    }
  }

  function handleVoiceProfileChange(profile) {
    if (!profile) return;
    state.voiceProfile = profile;

    if (profile === "soft") {
      state.voiceRate = 0.9;
      state.voicePitch = 1.04;
    } else if (profile === "calm") {
      state.voiceRate = 0.82;
      state.voicePitch = 0.98;
    } else if (profile === "neutral") {
      state.voiceRate = 1.0;
      state.voicePitch = 1.0;
    } else if (profile === "deep") {
      state.voiceRate = 0.96;
      state.voicePitch = 0.9;
    } else if (profile === "bright") {
      state.voiceRate = 1.08;
      state.voicePitch = 1.08;
    } else if (profile === "lively") {
      state.voiceRate = 1.18;
      state.voicePitch = 1.04;
    }

    syncVoiceControls();
  }

  function syncVoiceControls() {
    if (els.voiceProfile) {
      els.voiceProfile.value = state.voiceProfile || "soft";
    }
    if (els.voiceRate && typeof state.voiceRate === "number") {
      els.voiceRate.value = String(state.voiceRate);
    }
    if (els.voicePitch && typeof state.voicePitch === "number") {
      els.voicePitch.value = String(state.voicePitch);
    }
  }

  function initVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    loadSystemVoices();
    try {
      window.speechSynthesis.onvoiceschanged = function () {
        loadSystemVoices();
      };
    } catch (error) {}
  }

  function loadSystemVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    var list = [];
    try {
      list = window.speechSynthesis.getVoices() || [];
    } catch (error) {
      list = [];
    }

    state.voices = list;
    populateSystemVoices();
  }

  function populateSystemVoices() {
    if (!els.voiceSystem) return;

    var select = els.voiceSystem;
    select.innerHTML = "";

    var defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Default";
    select.appendChild(defaultOption);

    if (!state.voices || !state.voices.length) return;

    state.voices.forEach(function (voice) {
      var opt = document.createElement("option");
      opt.value = voice.voiceURI;
      opt.textContent = voice.name + (voice.lang ? " (" + voice.lang + ")" : "");
      if (state.voiceId && state.voiceId === voice.voiceURI) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  }

  function handleSystemVoiceChange(id) {
    state.voiceId = id || "";
  }

  function handleMicClick() {
    if (state.listening) {
      stopSpeechRecognition();
      return;
    }

    var Recognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recognition) {
      addMessage(
        "bot",
        "Your browser doesn't support voice input yet. You can still type messages as usual."
      );
      return;
    }

    var recognizer = new Recognition();
    recognizer.lang = "en-US";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    state.listening = true;
    state.recognizer = recognizer;
    updateMicUI();

    recognizer.onresult = function (event) {
      var result = event && event.results && event.results[0] && event.results[0][0];
      var transcript = result && result.transcript ? result.transcript.trim() : "";
      if (transcript && els.chatInput) {
        els.chatInput.value = transcript;
        handleSend();
      }
    };

    recognizer.onerror = function () {
      state.listening = false;
      state.recognizer = null;
      updateMicUI();
    };

    recognizer.onend = function () {
      state.listening = false;
      state.recognizer = null;
      updateMicUI();
    };

    try {
      recognizer.start();
    } catch (error) {
      state.listening = false;
      state.recognizer = null;
      updateMicUI();
    }
  }

  function stopSpeechRecognition() {
    if (!state.recognizer) return;
    try {
      state.recognizer.stop();
    } catch (error) {}
  }

  function updateMicUI() {
    if (!els.micButton) return;
    if (state.listening) {
      els.micButton.classList.add("chat__mic--listening");
    } else {
      els.micButton.classList.remove("chat__mic--listening");
    }
  }

  function showTypingIndicator() {
    if (state.typingId || !els.messages) return;

    var id = "typing-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    state.typingId = id;

    state.messages.push({
      id: id,
      role: "bot",
      text: "",
      createdAt: new Date().toISOString(),
      typing: true,
    });

    renderMessages();
  }

  function hideTypingIndicator() {
    if (!state.typingId) return;

    var id = state.typingId;
    var index = -1;
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i].id === id) {
        index = i;
        break;
      }
    }

    if (index !== -1) {
      state.messages.splice(index, 1);
    }

    state.typingId = null;
    renderMessages();
  }

  function updateSuggestions(rawText) {
    if (!els.chatSuggestions) return;

    var text = (rawText || "").trim();
    var suggestions = [];
    var tone = state.tone || "gentle";
    var info = detectEmotion(text);
    var detectedEmotion = info.emotion;
    var emotion = state.sessionEmotion || detectedEmotion;

    if (!text) {
      if (tone === "practical") {
        suggestions.push("Can you help me pick one small, practical next step?");
        suggestions.push("Can you help me list out what's on my plate and sort it?");
      } else if (tone === "uplifting") {
        suggestions.push("Can you help me notice anything I'm handling better than I think?");
        suggestions.push("Can you remind me of reasons this version of me is still worth caring about?");
      } else {
        suggestions.push("I'm not sure where to start, but I'm not okay.");
        suggestions.push("Can you help me untangle what I'm feeling?");
      }
      suggestions.push("Can we go slowly and just check in about today?");
    } else {
      suggestions.push("Can you help me put what I'm feeling into clearer words?");

      if (emotion === "sad" || emotion === "worth") {
        if (tone === "uplifting") {
          suggestions.push("Can you help me see any small signs of hope or strength in this?");
        } else if (tone === "practical") {
          suggestions.push("Can you help me find one small, kind thing I could do for myself after this chat?");
        } else {
          suggestions.push("Can you offer a kinder way of looking at this?");
        }
      } else if (emotion === "anxious") {
        if (tone === "practical") {
          suggestions.push("Can you help me sort my worries into 'now' vs 'later'?");
        } else {
          suggestions.push("Can you help me challenge some of these anxious thoughts?");
        }
      } else if (emotion === "overwhelmed") {
        if (tone === "practical") {
          suggestions.push("Can you help me break this down into one small next step?");
        } else {
          suggestions.push("Can you help me name what feels like the heaviest part of this?");
        }
      } else if (emotion === "angry") {
        suggestions.push("Can you help me express this anger without turning it against myself?");
      } else if (emotion === "lonely") {
        suggestions.push("Can you help me feel a little less alone with this right now?");
      }

      suggestions.push("What would you suggest I focus on next?");
    }

    var seen = {};
    var finalList = [];
    for (var i = 0; i < suggestions.length; i++) {
      var s = suggestions[i];
      if (!s || seen[s]) continue;
      seen[s] = true;
      finalList.push(s);
      if (finalList.length >= 3) break;
    }

    state.suggestions = finalList;
    renderSuggestions();
  }

  function renderSuggestions() {
    if (!els.chatSuggestions) return;

    var items = state.suggestions || [];
    if (!items.length) {
      els.chatSuggestions.innerHTML = "";
      return;
    }

    var html = '<div class="chat__suggestions-label">Suggestions</div><div class="chat__suggestions-list">';
    for (var i = 0; i < items.length; i++) {
      var text = items[i];
      var safe = escapeHtml(text);
      html +=
        '<button type="button" class="chip chip--ghost chat__suggestion-chip" data-suggestion="' +
        safe +
        '">' +
        safe +
        "</button>";
    }
    html += "</div>";

    els.chatSuggestions.innerHTML = html;
  }

  function openHelpModal() {
    if (!els.apiHelpModal) return;
    els.apiHelpModal.classList.add("modal--open");
    els.apiHelpModal.setAttribute("aria-hidden", "false");
  }

  function closeHelpModal() {
    if (!els.apiHelpModal) return;
    els.apiHelpModal.classList.remove("modal--open");
    els.apiHelpModal.setAttribute("aria-hidden", "true");
  }

  function detectEmotion(text) {
    var lower = text.toLowerCase();

    var rules = {
      sad: ["sad", "down", "depressed", "empty", "cry", "heartbroken", "hopeless"],
      anxious: [
        "anxious",
        "nervous",
        "worried",
        "panic",
        "on edge",
        "overthinking",
        "stressed",
      ],
      angry: ["angry", "mad", "furious", "irritated", "annoyed", "rage"],
      lonely: ["lonely", "alone", "isolated", "ignored"],
      overwhelmed: [
        "overwhelmed",
        "too much",
        "burnout",
        "burned out",
        "exhausted",
        "drained",
      ],
      worth: ["worthless", "failure", "not enough", "hate myself", "disappointed in myself"],
      positive: ["grateful", "thankful", "hopeful", "proud", "relieved"],
    };

    var scores = {
      sad: 0,
      anxious: 0,
      angry: 0,
      lonely: 0,
      overwhelmed: 0,
      worth: 0,
      positive: 0,
    };

    Object.keys(rules).forEach(function (key) {
      var words = rules[key];
      for (var i = 0; i < words.length; i++) {
        if (lower.indexOf(words[i]) !== -1) {
          scores[key] += 2;
        }
      }
    });

    var intensifiers = ["really", "very", "so ", "can't", "cant", "never", "always"];
    var intensityScore = 0;
    intensifiers.forEach(function (word) {
      if (lower.indexOf(word) !== -1) intensityScore += 1;
    });

    var best = null;
    var maxScore = 0;
    Object.keys(scores).forEach(function (key) {
      if (scores[key] > maxScore) {
        maxScore = scores[key];
        best = key;
      }
    });

    if (!best || maxScore === 0) {
      return { emotion: null, intensity: 1 };
    }

    var intensity = intensityScore >= 3 ? 3 : intensityScore >= 1 ? 2 : 1;
    return { emotion: best, intensity: intensity };
  }

  function generateSupportiveReply(userText) {
    var detection = detectEmotion(userText);
    var emotion = state.sessionEmotion || detection.emotion;
    var tone = state.tone || "gentle";
    var sessionEmotion = state.sessionEmotion || "none/unspecified";

    var parts = [];

    if (!emotion) {
      parts.push(
        "Thank you for trusting this space with what you're feeling. It takes courage to put it into words."
      );
      parts.push(
        "If you had to describe what you're feeling in one or two words, what would they be?"
      );
    } else if (emotion === "sad" || emotion === "worth") {
      parts.push(
        "It sounds like you're carrying a lot of heaviness and sadness. It makes sense that it would feel like this, given what you're holding."
      );
      parts.push(
        "Feeling this low doesn't mean you're failing. It often means you've been carrying more than anyone should have to carry alone."
      );
    } else if (emotion === "anxious") {
      parts.push(
        "I hear how tense and on-edge things feel. Anxiety can make your mind race through every worst-case scenario, even when you just want a break."
      );
      parts.push(
        "Your reactions aren't silly or overdramatic. They're your nervous system trying very hard to protect you, even if it doesn't feel helpful."
      );
    } else if (emotion === "angry") {
      parts.push(
        "I'm hearing a lot of frustration and anger. Those feelings are signals that something hasn't felt fair, safe, or respected to you."
      );
      parts.push(
        "You don't have to judge yourself for feeling angry. Often it's the part of you that knows you deserved better."
      );
    } else if (emotion === "lonely") {
      parts.push(
        "Feeling this alone in what you're going through can be one of the hardest parts."
      );
      parts.push(
        "Even if it seems like nobody would fully get it, your experience still matters and deserves to be heard."
      );
    } else if (emotion === "overwhelmed") {
      parts.push(
        "It sounds like a lot is pressing on you at once, to the point where it might be hard to even know where to start."
      );
      parts.push(
        "Being overwhelmed usually isn't about you being weak. It's often about the situation demanding more than any one person can give."
      );
    } else if (emotion === "positive") {
      parts.push(
        "I'm glad you can notice some relief, hope, or gratitude in the middle of everything."
      );
      parts.push(
        "If you'd like, we can explore what made that possible so you can lean on it again in future moments."
      );
    }

    var story = pickStoryForEmotion(emotion);
    if (story) {
      var snippet = createStorySnippet(story.body);
      var moodLabel = labelForMood(story.mood) || "a moment";
      var storyText =
        "Someone once described a " +
        moodLabel.toLowerCase() +
        " like this: \"" +
        snippet +
        "\"";

      if (story.lesson) {
        storyText +=
          "\n\nIn their words, what helped even a little was: \"" + story.lesson.trim() + "\".";
      } else {
        storyText +=
          "\n\nYour experience is still your own, but you're not the only person who's felt something like this.";
      }

      parts.push(storyText);
    }

    var followUp = createToneFollowUp(tone, emotion);
    if (followUp) parts.push(followUp);

    parts.push(
      "If this ever feels too intense, it's okay to pause, take a few breaths, or step away and come back later."
    );

    return parts.join("\n\n");
  }

  function createToneFollowUp(tone, emotion) {
    if (tone === "practical") {
      if (emotion === "anxious" || emotion === "overwhelmed") {
        return (
          "Would it feel okay to choose just one tiny next step together? It could be writing everything down, circling one important thing for today, and giving yourself permission to leave the rest for later."
        );
      }
      if (emotion === "angry") {
        return (
          "Sometimes a first step with anger is to give it a safe place to exist  like an unsent message, writing here without editing yourself, or moving your body a bit. What feels safest for you?"
        );
      }
      if (emotion === "sad" || emotion === "worth") {
        return (
          "On a practical level, what is one very small thing that might make the next hour 2% more bearable  a warm drink, a shower, a change of room, or messaging someone you trust?"
        );
      }
      return (
        "If you name one thing you need most right now  comfort, clarity, distraction, or something else  we can focus our next messages around that."
      );
    }

    if (tone === "uplifting") {
      if (emotion === "worth") {
        return (
          "The way you're reflecting on all of this already shows a lot of care and self-awareness. Even if you can't feel it, there's clearly a thoughtful, caring part of you here."
        );
      }
      return (
        "Reaching out like this is a hopeful act. It means there's a part of you that still believes things might feel different someday, even if the rest of you is tired."
      );
    }

    return (
      "If you feel okay sharing a bit more about what happened or what today has been like, I can respond more specifically to your situation. There's no rush."
    );
  }

  function callOnlineAI(userText) {
    var apiKey = state.apiKey;
    if (!apiKey) {
      return Promise.reject(new Error("Missing API key"));
    }

    var tone = state.tone || "gentle";
    var sessionEmotion = state.sessionEmotion || "none/unspecified";
    var guidance =
      "You are EmoteAI, a gentle emotional support companion chatting with a single user. " +
      "Your job is to listen, validate feelings, reflect what you hear, and suggest small, realistic next steps. " +
      "You are not a therapist or crisis service and you must not claim to be. If the user mentions self-harm, suicide, or being in immediate danger, " +
      "gently encourage them to reach out to local emergency services or a crisis hotline and to a trusted person in their life.";

    var style =
      "Keep replies concise and readable: 2-5 short paragraphs or bullet-like lines. " +
      "Avoid long walls of text, avoid giving medical or legal advice, and avoid talking about being an AI model. " +
      "Match the requested tone: 'gentle' = more soothing and validating, 'practical' = more concrete steps, 'uplifting' = more hope and strengths-focused.";

    var body = {
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            guidance +
            "\n\n" +
            style +
            "\n\nCurrent tone setting: " +
            tone +
            "\nCurrent user-labeled main emotion (if any): " +
            sessionEmotion,
        },
        {
          role: "user",
          content: userText,
        },
      ],
      temperature: 0.8,
      max_tokens: 350,
    };

    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "X-Title": "EmoteAI Local Client",
      },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.choices || !data.choices.length) {
          throw new Error("No choices in response");
        }

        var msg = data.choices[0].message;
        if (!msg || !msg.content) {
          throw new Error("Empty message content");
        }
        return msg.content;
      });
  }

  function handleInvalidApiKey() {
    state.apiKey = "";
    if (els.apiKeyInput) {
      els.apiKeyInput.value = "";
    }
    saveApiKeyToStorage();
    setOnlineMode(false);
    setChatEnabled(false);
  }

  function pickStoryForEmotion(emotion) {
    if (!state.stories || state.stories.length === 0 || !emotion) return null;

    var targetMood = emotion;
    if (emotion === "worth") targetMood = "sad";
    if (emotion === "positive") targetMood = "grateful";

    var list = state.stories.filter(function (s) {
      return s.mood === targetMood;
    });

    if (list.length === 0) list = state.stories.slice();
    if (list.length === 0) return null;

    var index = Math.floor(Math.random() * list.length);
    return list[index];
  }

  function createStorySnippet(text) {
    if (!text) return "";
    var trimmed = text.trim();
    if (trimmed.length <= 220) return trimmed;
    return trimmed.slice(0, 217).trimEnd() + "...";
  }

  function handleStorySubmit() {
    if (!els.storyTitle || !els.storyMood || !els.storyBody) return;

    var title = els.storyTitle.value.trim();
    var mood = els.storyMood.value;
    var body = els.storyBody.value.trim();
    var lesson = els.storyLesson ? els.storyLesson.value.trim() : "";

    if (!title || !mood || !body) return;

    if (state.editingStoryId) {
      var idx = -1;
      for (var i = 0; i < state.stories.length; i++) {
        if (state.stories[i].id === state.editingStoryId) {
          idx = i;
          break;
        }
      }
      if (idx !== -1) {
        var existing = state.stories[idx];
        existing.title = title;
        existing.mood = mood;
        existing.body = body;
        existing.lesson = lesson;
        existing.updatedAt = new Date().toISOString();
        state.editingStoryId = null;
        saveStories();
        renderStories();
      }

      els.storyTitle.value = "";
      els.storyMood.value = "";
      els.storyBody.value = "";
      if (els.storyLesson) els.storyLesson.value = "";
      return;
    }

    var story = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      title: title,
      mood: mood,
      body: body,
      lesson: lesson,
      createdAt: new Date().toISOString(),
    };

    state.stories.unshift(story);
    saveStories();
    renderStories();

    els.storyTitle.value = "";
    els.storyMood.value = "";
    els.storyBody.value = "";
    if (els.storyLesson) els.storyLesson.value = "";
  }

  function loadStories() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.stories = [];
        return;
      }
      var parsed = JSON.parse(raw);
      state.stories = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      state.stories = [];
    }
  }

  function loadApiKeyFromStorage() {
    try {
      var stored = window.localStorage.getItem(KEY_STORAGE_KEY);
      if (stored) {
        state.apiKey = stored;
        if (els.apiKeyInput) {
          els.apiKeyInput.value = stored;
        }
        setOnlineMode(true);
      }
    } catch (error) {
      // ignore storage errors
    }
  }

  function saveStories() {
    try {
      var toStore = JSON.stringify(state.stories.slice(0, 80));
      window.localStorage.setItem(STORAGE_KEY, toStore);
    } catch (error) {
      // ignore storage errors
    }
  }

  function saveApiKeyToStorage() {
    try {
      if (state.apiKey) {
        window.localStorage.setItem(KEY_STORAGE_KEY, state.apiKey);
      } else {
        window.localStorage.removeItem(KEY_STORAGE_KEY);
      }
    } catch (error) {
      // ignore storage errors
    }
  }

  function renderStories() {
    if (!els.storyList) return;

    var filter = els.storyFilter ? els.storyFilter.value : "all";
    var stories = state.stories || [];
    var search = els.storySearch ? (els.storySearch.value || "").toLowerCase().trim() : "";

    var filtered = stories.filter(function (story) {
      if (filter && filter !== "all" && story.mood !== filter) {
        return false;
      }
      if (!search) return true;
      var title = (story.title || "").toLowerCase();
      var body = (story.body || "").toLowerCase();
      var lesson = (story.lesson || "").toLowerCase();
      return (
        title.indexOf(search) !== -1 ||
        body.indexOf(search) !== -1 ||
        lesson.indexOf(search) !== -1
      );
    });

    els.storyList.innerHTML = "";

    if (filtered.length === 0) {
      var empty = document.createElement("div");
      empty.className = "story-card story-card__empty";
      empty.textContent =
        "You haven't saved any stories yet. When you do, I'll be able to reference them in replies.";
      els.storyList.appendChild(empty);
      return;
    }

    filtered.forEach(function (story) {
      var card = document.createElement("article");
      card.className = "story-card";

      var header = document.createElement("header");
      header.className = "story-card__header";

      var title = document.createElement("div");
      title.className = "story-card__title";
      title.textContent = story.title;

      var chip = document.createElement("span");
      chip.className = "story-card__chip story-card__chip--" + story.mood;
      chip.textContent = labelForMood(story.mood);

      header.appendChild(title);
      header.appendChild(chip);

      var body = document.createElement("p");
      body.className = "story-card__body";
      body.textContent = story.body;

      card.appendChild(header);
      card.appendChild(body);

      if (story.lesson) {
        var lesson = document.createElement("p");
        lesson.className = "story-card__lesson";
        var label = document.createElement("span");
        label.className = "story-card__lesson-label";
        label.textContent = "What helped: ";
        lesson.appendChild(label);
        lesson.appendChild(document.createTextNode(story.lesson));
        card.appendChild(lesson);
      }

      var footer = document.createElement("footer");
      footer.className = "story-card__footer";
      var time = document.createElement("span");
      time.textContent = formatRelativeTime(story.createdAt);

      var actions = document.createElement("span");
      actions.className = "story-card__actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "story-card__link";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("data-story-id", story.id);
      editBtn.setAttribute("data-story-action", "edit");

      var sep = document.createTextNode(" · ");

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "story-card__link";
      delBtn.textContent = "Delete";
      delBtn.setAttribute("data-story-id", story.id);
      delBtn.setAttribute("data-story-action", "delete");

      actions.appendChild(editBtn);
      actions.appendChild(sep);
      actions.appendChild(delBtn);

      footer.appendChild(time);
      footer.appendChild(actions);

      card.appendChild(footer);

      els.storyList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function labelForMood(mood) {
    switch (mood) {
      case "sad":
        return "Sad / grief";
      case "anxious":
        return "Anxious / panic";
      case "angry":
        return "Angry / frustrated";
      case "lonely":
        return "Lonely / disconnected";
      case "overwhelmed":
        return "Overwhelmed / burnout";
      case "grateful":
        return "Grateful / hopeful";
      default:
        return "Mixed / other";
    }
  }

  function formatTime(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatRelativeTime(value) {
    var date = value instanceof Date ? value : new Date(value);
    var now = new Date();
    var diffMs = now - date;
    if (isNaN(diffMs)) return "";

    var seconds = Math.floor(diffMs / 1000);
    if (seconds < 45) return "just now";

    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " min ago";

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " h ago";

    var days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";

    return date.toLocaleDateString();
  }
})();
