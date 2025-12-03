# Thumbnail Builder Prototype Walkthrough

I have built a high-fidelity HTML/CSS prototype for the **Thumbnail Builder** app. This prototype demonstrates the full user flow, from the marketing dashboard to the complex creation wizard.

## 📂 File Structure

- **`index.html`**: The main Dashboard and Landing page.
- **`create.html`**: The 6-step Creation Wizard (the core app experience).
- **`library.html`**: A gallery of generated thumbnails.
- **`presets.html`**: A manager for style presets.
- **`styles.css`**: The global stylesheet containing all design tokens, layout styles, and component definitions.
- **`app.js`**: The JavaScript logic handling the multi-step wizard interactivity in `create.html`.

## 🚀 How to Test

1.  **Start at the Dashboard**: Open `index.html` in your browser.
    -   Review the "Dark Neon Blueprint" aesthetic.
    -   Check the "Recent Sessions" table.
2.  **Start a Session**: Click "Start New Session" or navigate to "Create" in the top bar.
3.  **Experience the Wizard**: You will be taken to `create.html`.
    -   **Step 1 (Face)**: See the upload area and face gallery.
    -   **Step 2 (Video)**: Click "Next" to see the video URL input and preview.
    -   **Step 3 (Style)**: Choose a niche and style preset.
    -   **Step 4 (Brief)**: Interact with the chat-like brief interface.
    -   **Step 5 (Thumbnails)**: Review generated thumbnail concepts.
    -   **Step 6 (Export)**: See the export options, including the "Title Tester Pro" integration.
    -   *Note: The "Next" and "Back" buttons are fully functional.*
4.  **Explore Secondary Pages**:
    -   Click "Library" to see the filterable gallery.
    -   Click "Presets" to see the style management screen.

## 🎨 Design Highlights

-   **Visual DNA**: Deep space black backgrounds with neon orange/purple accents, matching the "Title Tester Pro v8" family.
-   **Premium Feel**: Glassmorphism effects on the nav bar, subtle glows on active elements, and modern typography (Outfit/Inter).
-   **Interactive Elements**: Hover states on cards, buttons, and inputs to make the app feel alive.
