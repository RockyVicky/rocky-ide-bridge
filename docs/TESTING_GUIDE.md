# Rocky Ecosystem: Internal Testing Guide

Welcome to the internal testing phase! This guide outlines how to verify the stability and functionality of the Rocky stack.

## 1. Setup for Testers
1. Ensure the backend is running in production mode: `npm run start:prod`.
2. Connect the Mobile App to the server URL (Tunnel or Local IP).
3. Verify the "TESTING" banner appears in the top-right corner of the mobile app (if `isInternalTesting` is enabled).

## 2. Generate Testing APK
To create a standalone APK for testers, run this command in the `mobile-app` folder:
```bash
eas build --platform android --profile preview
```
*(This will give you a download link for the .apk file once finished)*

## 3. Testing Checklist

### Connectivity
- [ ] App connects successfully (Green icon).
- [ ] App reconnects automatically after being put in background.
- [ ] Tunnel stays stable for > 30 minutes.

### Autonomous Actions
- [ ] Speak/Type a goal: "Add a button to the home screen."
- [ ] Verify Rocky plans the goal (Plan appears in Intel Feed).
- [ ] Verify Rocky executes the goal (Handoff to Antigravity occurs).
- [ ] Verify the code is actually written in the workspace.

### Diagnostics
- [ ] Backend logs show `[Trigger]` and `[Recovery]` events correctly.
- [ ] Mobile app "Intel Feed" displays items from the Meta-Architect.

## 3. Reporting Bugs
When a bug is found, please provide:
1. **Screenshot** of the mobile app.
2. **Backend Log Snippet** around the time of failure.
3. **Reproduction Steps**: What did you say/type right before it failed?

## 4. Automated Verification
Run the following command in the `backend` folder to ensure core APIs are healthy:
```bash
npm test
```
