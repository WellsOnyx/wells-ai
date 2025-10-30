# WELLS AI - GITHUB UPLOAD INSTRUCTIONS

## STEP-BY-STEP UPLOAD GUIDE

### STEP 1: CREATE NEW REPO

1. Go to github.com
2. Click the "+" button (top-right) → "New repository"
3. Name: `wells-ai`
4. Privacy: **Private** ✓
5. DO NOT check "Add a README file"
6. Click "Create repository"

---

### STEP 2: UPLOAD FILES IN THIS ORDER

**IMPORTANT:** You must create folders BEFORE uploading files into them.

#### A. Create the app folder structure:

1. Click "creating a new file"
2. Type: `app/api/chat/.gitkeep`
3. Scroll down, click "Commit new file"

*(This creates all three folders: app/, app/api/, app/api/chat/)*

---

#### B. Upload root files:

1. Click "Add file" → "Upload files"
2. Drag these files from your `wells-ai-github-ready` folder:
   - package.json
   - next.config.js
   - tailwind.config.js
   - postcss.config.js
   - tsconfig.json
   - README.md
   - QUICKSTART.md
   - .gitignore
   - .env.local.example

3. Scroll down, click "Commit changes"

---

#### C. Upload app/ files:

1. Click into the `app` folder
2. Click "Add file" → "Upload files"
3. Drag these files:
   - globals.css
   - layout.tsx
   - page.tsx

4. Click "Commit changes"

---

#### D. Upload app/api/chat/ file:

1. Navigate to `app/api/chat/` folder
2. Click "Add file" → "Upload files"
3. Drag:
   - route.ts

4. Click "Commit changes"

---

### STEP 3: VERIFY STRUCTURE

Your repo should look like:

```
wells-ai/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── QUICKSTART.md
├── README.md
├── tailwind.config.js
└── tsconfig.json
```

---

### STEP 4: DEPLOY TO VERCEL

1. Go back to vercel.com
2. Click "Add New..." → "Project"
3. Import your `wells-ai` repo
4. Add environment variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: [your Claude API key]
5. Click "Deploy"

**This time it will work!**

---

## IF YOU GET STUCK

The issue last time was flat file structure.
This time, we're creating folders FIRST, then uploading files into them.

Take it slow, follow each step exactly.

You've got this!
