# Fix TypeScript Errors - Quick Guide

## Quick Fix (Try This First!)

1. **Restart TypeScript Server in your IDE:**
   - Press `Ctrl+Shift+P`
   - Type: `TypeScript: Restart TS Server`
   - Press Enter

2. **If that doesn't work, reinstall dependencies:**
   ```powershell
   cd Frontend
   npm install
   ```

3. **Restart your IDE completely**

## Detailed Fix Steps

### Option 1: Clean Install (Recommended)

```powershell
cd Frontend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

### Option 2: Verify Installation

```powershell
cd Frontend
npm list @types/react
npm list @types/react-dom
npm list typescript
```

All three should show installed versions.

### Option 3: Manual Type Installation

If types are missing:
```powershell
cd Frontend
npm install --save-dev @types/react@^18.2.43 @types/react-dom@^18.2.17
```

## Why This Happens

TypeScript errors after `npm install` are usually caused by:
1. **IDE cache** - TypeScript server hasn't reloaded the new types
2. **Incomplete installation** - Some packages didn't install correctly
3. **Version conflicts** - Package versions don't match

## Verification

After fixing, you should be able to:
- See no TypeScript errors in `LandingPage.tsx` and `LoginPage.tsx`
- Run `npm run dev` without errors
- See proper autocomplete for React components

## Still Having Issues?

1. Check Node.js version: `node --version` (need 18+)
2. Check you're in the Frontend directory
3. Try: `npm cache clean --force` then `npm install`
4. Make sure your IDE is using the workspace TypeScript version

