# DataWallet - React Native

A beautiful clipboard/data manager app refactored from React Web to React Native. Store and manage your important information like passport numbers, loyalty cards, and more in beautiful tiles with tap-to-copy functionality.

## Features

✨ **Beautiful Tile UI** - Soft pastel color scheme with smooth animations
📋 **Tap to Copy** - Instantly copy tile content to clipboard with haptic feedback
🔒 **Secure Tiles** - Mark tiles as secure (Face ID integration ready)
⭐ **Priority Tiles** - Mark important tiles to keep them at the top
🎨 **Visual Feedback** - Smooth press animations with color transitions
📱 **Context Menu** - Long-press tiles to edit, delete, prioritize, or secure
💾 **Persistent Storage** - All tiles saved locally with AsyncStorage
🎯 **Smart Sorting** - Tiles sorted by priority, usage, and creation date

## Tech Stack

- **React Native** with Expo
- **TypeScript** types included
- **React Navigation** for navigation
- **AsyncStorage** for persistent storage
- **Expo Clipboard** for clipboard access
- **Expo Haptics** for haptic feedback
- **React Native Reanimated** for smooth animations

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your platform:
- **iOS**: Press `i` or run `npm run ios`
- **Android**: Press `a` or run `npm run android`
- **Web**: Press `w` or run `npm run web`

## Project Structure

```
DataWallet/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── AlertDialog.tsx  # Alert dialog component
│   │   ├── Button.tsx       # Button component
│   │   ├── ContextMenu.tsx  # Long-press context menu
│   │   ├── Input.tsx        # Text input component
│   │   ├── Modal.tsx        # Base modal component
│   │   ├── Tile.tsx         # Tile component with animations
│   │   ├── AddTileModal.tsx # Modal for adding/editing tiles
│   │   └── DeleteConfirmDialog.tsx
│   ├── screens/             # Screen components
│   │   └── HomeScreen.tsx   # Main screen with tile grid
│   ├── types/               # TypeScript types
│   │   └── tile.ts          # Tile interface
│   ├── constants/           # Constants
│   │   └── colors.ts        # Color theme
│   └── utils/               # Utility functions
│       └── storage.ts       # AsyncStorage utilities
├── assets/                  # Images and assets
├── App.js                   # Root component
└── package.json

```

## How It Works

### Tiles
Each tile stores:
- **Name**: Display name (e.g., "Passport")
- **Content**: The actual data to copy (e.g., "AB123456789")
- **Usage Count**: How many times it's been used
- **Priority**: Whether it's a priority tile (shown at top)
- **Secure**: Whether it requires authentication
- **Timestamps**: Created and last used dates

### Interactions
- **Tap**: Copy tile content to clipboard
- **Long Press**: Open context menu for edit/delete/priority/secure options
- **Press Animation**: Visual feedback with color transition on tap

### Storage
All tiles are automatically saved to AsyncStorage and persist between app launches.

## Refactored from Web

This app was refactored from a React Web application (built with Lovable) to React Native. Key changes:

1. **HTML → React Native Components**
   - `div` → `View`
   - `button` → `TouchableOpacity`
   - `input` → `TextInput`

2. **CSS → StyleSheet**
   - Tailwind CSS → React Native StyleSheet
   - HSL colors converted to hex values
   - Flexbox layout adapted for mobile

3. **Web APIs → Native Modules**
   - `localStorage` → `AsyncStorage`
   - `navigator.clipboard` → `expo-clipboard`
   - CSS transitions → `react-native-reanimated`
   - Added haptic feedback with `expo-haptics`

4. **UI Libraries → Custom Components**
   - Radix UI components → Custom Modal/Dialog/Button components
   - Lucide icons → Emoji icons
   - React Router → React Navigation

## Color Scheme

The app uses a beautiful soft pastel color scheme:
- **Background**: Soft warm white (`#FAF8F6`)
- **Tile Base**: Soft lavender (`#EEEBF4`)
- **Tile Pressed**: Medium lavender (`#9B7BC9`)
- **Primary**: Soft lavender (`#9D89B8`)
- **Priority**: Warm gold (`#F0CA7A`)
- **Secure**: Cool blue (`#7FA7D9`)
- **Destructive**: Muted coral (`#E08E8E`)

## Future Enhancements

- [ ] Face ID / Touch ID authentication for secure tiles
- [ ] Cloud sync across devices
- [ ] Categories/folders for tiles
- [ ] Search functionality
- [ ] Export/import tiles
- [ ] Tile templates
- [ ] Custom color themes
- [ ] Tile sharing

## License

Private - All rights reserved

---

Built with ❤️ using React Native and Expo








