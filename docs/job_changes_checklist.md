# Slide-Based Job Post Refactor Checklist

This checklist outlines the steps needed to refactor the job posts from a video-centric design to a slide-based format, following the plan detailed in @job_presentation_changes.md.

---

## 1. Data Structure & Firestore Schema Updates

- [x] **Update `JobOpening` Schema**
  - [x] Change `videoUrl` to an optional field (e.g., `videoUrl?: string`).
  - [x] Deprecate or remove the `thumbnailUrl` field.
  - [x] Add an optional `voiceoverUrl?: string` field.
  - [x] Add a new `slides?: Slide[]` field.
  - [x] Retain existing fields such as `jobDescription`, `tags`, `userId`, `createdAt`, etc.

- [x] **Define the `Slide` Interface**
  - [x] Create a `Slide` definition with:
    - [x] `title`: string
    - [x] `heading`: string
    - [x] `bullets`: string[]
    - [x] Optional: `backgroundImageUrl?: string`

---

## 2. Slide Generation & Storage

- [x] **Implement Slide Generation Service**
  - [x] Create or update a Cloud Function/service called `generateSlidesFromDescription` (or add a new method in `SlideGenerationService`/`ParserService`).
  - [x] Use an LLM (e.g., Gemini API or OpenAI API) to generate 4 slide objects from the provided `jobDescription`.
  - [x] For each slide, call an image-generation endpoint (e.g., DALL·E) to obtain a `backgroundImageUrl`.
  - [x] Optionally, integrate TTS to generate and store a single voiceover or per-slide audio.

- [x] **Integrate with Firebase**
  - [x] Update the `JobOpening` document with the generated `slides` array.
  - [x] Handle async image generation by using temporary placeholders until images are ready.

---

## 3. UI / UX Component Changes

- [x] **Feed & Grid View Updates**
  - [x] Modify the feed to display `slides[0].backgroundImageUrl` (or a placeholder if unavailable) instead of `thumbnailUrl`.
  - [x] Overlay text (using `slides[0].heading` or `slides[0].title`) on the grid tile.
  - [x] If `videoUrl` exists, display a "Play Video" icon overlay.

- [ ] **Fullscreen & Swiping Enhancements**
  - [x] Allow left/right tap gestures to navigate between slides within a job.
  - [x] Reserve swipe (drag) gestures for:
    - [x] Rejecting a job (left swipe).
    - [x] Opening job details (right swipe).
  - [ ] Display TTS controls (mute/unmute)

- [ ] **SlideShow & Video Player Components**
  - [x] Create a new `SlideShowPlayer` component to cycle through the 4 slides.
  - [x] Update or conditionally render the existing `VideoPlayer` to play the video if `videoUrl` exists.
  - [x] Create a unified `JobViewer` component that selects between slide and video views based on the content.

---

## 4. Upload Workflow Adjustments

- [x] **Upload Form Changes (`Upload.tsx`)**
  - [x] Make the job description field mandatory
  - [x] Parse the uploaded PDF/text-based job description using the existing `ParserService`
  - [x] Immediately call the slide generation function upon successful parse
  - [x] Make video upload optional and clearly labeled as such
  - [x] Remove redundant Gemini toggle since it's now the default parser
  - [x] Reorganize component structure to:
    - [x] Title and tags input at the top
    - [x] Job description upload with preview
    - [x] Optional video upload section with transcription
    - [x] Clear error handling for both parsing and slide generation
    - [x] Progress indicators for upload and slide generation

- [x] **Job Document Creation**
  - [x] Ensure that the final `JobOpening` document is posted with:
    - [x] A valid `slides` array
    - [x] Optional `videoUrl` and/or `voiceoverUrl`
    - [x] All necessary metadata (title, tags, jobDescription, etc.)
    - [x] Proper status tracking for slide generation

---

## 5. Services & Functions

- [x] **Extend Parser/Slide Generation Service**
  - [x] Add a method: `generateSlides(jobDescription: JobDescription): Promise<Slide[]>`.
  - [x] Integrate the LLM API call to return a JSON array of 4 slide objects.
  - [x] Chain image generation calls to update each slide's `backgroundImageUrl`.

- [x] **(Optional) Voiceover Generation**
  - [x] Develop a function: `generateVoiceoverFromSlides(slides: Slide[]): Promise<string>`.
  - [x] Store the generated audio file in Firebase Storage and update the `voiceoverUrl`.

---

## 6. Navigation & Interaction Refinements

- [ ] **Touch Gesture Differentiation**
  - [ ] Ensure single taps navigate between slides.
  - [ ] Ensure drag/swipe gestures trigger job-level actions (reject or open details).

- [ ] **Unified JobViewer**
  - [ ] Create a component that intelligently renders either the `SlideShowPlayer` or the optional `VideoPlayer` depending on available content.
  - [ ] Maintain consistency with existing up/down feed navigation.

---

## 7. Testing, Migration & Final Considerations

- [ ] **Backward Compatibility**
  - [ ] Ensure jobs created under the old video-only schema gracefully fall back (e.g., display video if no slides exist).

- [ ] **Async Image Handling**
  - [ ] Test that placeholder images are displayed until the generated `backgroundImageUrl` is available.

- [ ] **TTS & Audio Playback**
  - [ ] Confirm that TTS audio playback is integrated correctly with mute/unmute functionality.

- [ ] **User Experience Validation**
  - [ ] Verify that tap versus swipe gestures do not conflict.
  - [ ] Check the slide carousel's navigation in both grid and fullscreen views.

---

## 8. File Modifications Recap

- [ ] **TypeScript Interfaces**
  - [ ] Update `src/types/job_opening.ts` with new schema changes.

- [ ] **Frontend Components**
  - [ ] Update `src/components/Feed.tsx` and `VideoTile.tsx` to use the new slide data.
  - [ ] Create or update `src/components/SlideShowPlayer.tsx`.
  - [ ] Modify `JobDetails` to include a slide carousel in addition to the job description.

- [ ] **Upload Workflow**
  - [ ] Adjust `src/components/Upload.tsx` to enforce new requirements and trigger slide generation.

- [ ] **Firebase**
  - [ ] Update Firestore rules to allow the new fields (`slides`, `voiceoverUrl`) within job documents.

---

## 9. Final Review

- [ ] Confirm that the architectural decisions (e.g., single TTS track, clear gesture handling, asynchronous image generation) are properly implemented.
- [ ] Test all new and legacy flows to ensure a smooth transition.
- [ ] Update project documentation and deployment instructions to reflect all changes.

---

Use this checklist as a guide during implementation to ensure no step is missed. Happy coding!