# Verifying Installation

If you're seeing TypeScript errors after `npm install`, follow these steps:

## Step 1: Verify Dependencies Are Installed

```bash
cd Frontend
npm install
```

Check that `node_modules` folder exists and contains:
- `react`
- `@types/react`
- `@types/react-dom`
- `typescript`

## Step 2: Restart TypeScript Server

**In VS Code:**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "TypeScript: Restart TS Server"
3. Press Enter

**In Cursor:**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "TypeScript: Restart TS Server"
3. Press Enter

## Step 3: Clear Cache and Reinstall (If Still Having Issues)

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

## Step 4: Verify TypeScript Can Find Types

Run this command to check if types are installed:
```bash
npm list @types/react @types/react-dom
```

You should see both packages listed.

## Step 5: Check tsconfig.json

Make sure your `tsconfig.json` includes:
- `"jsx": "react-jsx"` in compilerOptions
- `"include": ["src", "src/**/*", "src/**/*.tsx", "src/**/*.ts"]`
- `"exclude": ["node_modules"]`

## Common Issues

### Issue: "Cannot find module 'react'"
**Solution**: Run `npm install` again. If it persists, delete `node_modules` and reinstall.

### Issue: "JSX tag requires 'react/jsx-runtime'"
**Solution**: 
1. Ensure `@types/react` is installed: `npm install --save-dev @types/react @types/react-dom`
2. Restart TypeScript server
3. Check that `package.json` has `"jsx": "react-jsx"` in tsconfig

### Issue: TypeScript errors but code runs fine
**Solution**: This is often an IDE cache issue. Restart the TypeScript server (Step 2).

## Still Having Issues?

1. Make sure you're in the `Frontend` directory
2. Check Node.js version: `node --version` (should be 18+)
3. Check npm version: `npm --version`
4. Try: `npm cache clean --force` then `npm install`

