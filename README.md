# Velvet Verify

**Velvet Verify** is a privacy-first STI contact tracing app that allows users to send anonymous exposure alerts and track their own sexual health status over time. The goal is to reduce the stigma and friction around disclosure while improving public health outcomes through decentralized data sharing.

---

## 🚀 Features
- **Anonymous Exposure Alerts**: Notify past partners without revealing identity
- **Private Health Tracker**: Log test results and track exposure status across multiple STIs
- **Connection Levels**: Bond, Friend, Fling, and more—each with different data visibility rules
- **Onboarding Flows**: Profile setup, membership selection, and alert logic in place
- **Firebase Integration**: Auth, Firestore, Functions, and Storage
- **Cross-Platform**: Built with React Native + Expo for iOS and Android

---

## 🧱 Tech Stack
- **Frontend**: React Native, Expo, TypeScript
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Privacy Architecture**: Custom hash-based identifier system to separate identity from sensitive health data

---

## 🔐 Privacy Model
Velvet Verify uses a multi-hash ID system to separate user identity from:
- Profile data (PSUUID)
- Health data (HSUUID)
- Exposure logic (ESUUID)

This allows anonymous communication while preserving data ownership and integrity.

---

## 🧪 Running Locally
1. Clone the repo
2. Run `npm install`
3. Add a `.env` file (Firebase config, etc.)
4. Run `npx expo start`

---

## 📦 Folder Structure Highlights
- `/app` — React Native views organized by route group
- `/components` — Shared UI and modal logic
- `/functions` — Firebase backend functions (exposure alerts, test submission, hashed ID logic)

---

## 🛠️ Status
- ✅ Working prototype (iOS via TestFlight)
- ✅ Closed cohort testing in progress
- 🚧 Need technical cofounder to help refine architecture, scale security, and expand feature set

---

## 🙋‍♂️ Why This Matters
Disclosure is hard. Silence spreads risk. Velvet Verify aims to make sexual health data safe to share—**privately, respectfully, and effectively.**

---

## 📬 Contact
Raymond Willey — [raymond@velvetverifyapp.com](mailto:raymond@velvetverifyapp.com)

YC Reviewer Access: You may view this repo directly. Please reach out if you’d like a walkthrough or to see the TestFlight build.
