# Website Redesign Prompt — Convert Landing Page into App Shell with Chat + Auth

Use this prompt as-is in Antigravity. It covers layout restructuring, content removal, chat integration, and authentication.

---

## 1. Restructure the Top Navigation into a Left Sidebar

Currently the header has: logo/name "Autonomous BI Studio", nav links (Agent Squad, Architecture, Power BI & TMDL), and a pill button "Open Studio" — all in one horizontal bar.

Convert this into a **vertical left sidebar** with the following stacked order, top to bottom:

1. **Brand name**: Replace "Autonomous BI Studio" with **"AI Data Analyst"** (keep the small logo icon to its left if one exists).
2. **Primary action button**: Replace "Open Studio" button label with **"Studio"**. Position it directly below the "AI Data Analyst" brand name (not beside it).
3. **New Chat button**: Add a **"+ New Chat"** button directly below the Studio button. Clicking it clears the current chat thread and starts a fresh session.
4. **Nav links, now stacked vertically** (moved from the old horizontal bar): 
   - Agent Squad
   - Architecture
   - Power BI & TMDL
5. **Projects section**: Below the nav links, add a **"Projects"** section header that lists the user's saved/previous projects (collapsible list).
6. **New Project button**: Add a **"+ New Project"** button/link near the top of the Projects section (either right under the "Projects" label or as an icon button next to it) to create a new project workspace.

Keep this sidebar fixed/pinned on the left side of the screen, full height, with the main content area to its right.

---

## 2. Remove Existing Hero Content

Delete these elements completely from the page:

- The pill badge text: **"Autonomous Multi-Agent Analytics Engine • v1.0"**
- The large heading: **"Autonomous AI Agents For Data & BI Intelligence"** (including the italic purple subtitle line)
- The paragraph description below it ("Drop messy tabular datasets and executive business questions...")
- The two CTA buttons **"Launch Studio Workspace"** and **"Explore Multi-Agent Squad"**

The main content area should now be empty and ready for the chat interface described below.

---

## 3. Add a Central Chatbox (LLM-Powered via Groq)

- Place a **chat interface in the vertical/horizontal center of the main content area** (similar to ChatGPT/Claude's centered chat UI when no conversation has started yet).
- Include:
  - A message input box with a send button, placed centered on first load.
  - Once a conversation starts, shift to a standard chat layout: message history scrolling above, input box pinned to the bottom.
- **Backend integration**: Connect this chatbox to the **Groq API** (e.g., using a Groq-hosted LLM such as Llama 3.1/3.3 or similar) to generate responses to user questions.
  - Store the Groq API key securely as an environment variable (e.g., `GROQ_API_KEY`), never hard-coded in frontend code.
  - Create a backend route/function (e.g., `/api/chat`) that receives the user's message, calls the Groq chat completions endpoint, and streams/returns the response to the frontend.
  - Support streaming responses if possible for a smoother chat experience.

---

## 4. Add Authentication (Login / Sign Up)

Build a login/signup flow supporting **three methods**, selectable by the user:

1. **Name + Mobile Number with OTP**
   - Fields: Full Name, Mobile Number
   - Send OTP via SMS to the entered mobile number.
   - Verify OTP before creating/logging in the account.
2. **Email with OTP**
   - Field: Email address
   - Send a one-time password/code to the email.
   - Verify OTP before creating/logging in the account.
3. **Google Sign-In**
   - Direct OAuth sign-in with Google (one-click), no OTP needed.

Requirements:
- Show this login/signup screen (modal or dedicated page) before allowing chat access, or allow limited guest use with a prompt to sign in.
- Store user session (e.g., JWT or session cookie) after successful authentication.
- Persist user's name for later display.

---

## 5. Post-Login Welcome State

- Once logged in, display **"Welcome, [User Name]"** at the **top of the chat box area** (above the chat messages/input).
- This welcome message should update dynamically based on the logged-in user's name (from name entry, email, or Google profile name).
- The sidebar's "New Chat" and "Projects" sections should now be tied to this authenticated user (i.e., saved chats/projects persist per user).

---

## 6. Summary of Final Layout

**Left Sidebar (top to bottom):**
- AI Data Analyst (brand)
- Studio (button)
- + New Chat
- Agent Squad
- Architecture
- Power BI & TMDL
- Projects (section header)
  - + New Project
  - [list of existing projects]

**Main Content Area:**
- Welcome, [User Name] (after login, shown at top)
- Centered chatbox (before conversation starts) → standard chat layout (after conversation starts), powered by Groq LLM

**Auth:**
- Login/Signup modal with: Name + Mobile OTP | Email OTP | Google Sign-In

---

## Notes for Implementation
- Keep the existing color theme (dark navbar / off-white background / purple accents) consistent across the new sidebar and chat UI.
- Make the sidebar collapsible/responsive for smaller screens.
- Ensure OTP verification has expiry (e.g., 5 minutes) and resend option.
- Add basic error handling for failed OTP delivery, invalid codes, and Groq API failures (show a friendly retry message in the chat).
