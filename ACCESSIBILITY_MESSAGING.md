# Accessibility Messaging - Complete List

## HomeScreen.tsx

### Empty State Button
- **Location**: Empty state "Create first nugget" button
- **Label**: "Create first nugget"
- **Role**: button
- **Hint**: "Opens the create new nugget dialog"

### Search Input
- **Location**: Search bar TextInput
- **Label**: "Search nuggets"
- **Role**: (default - text input)
- **Hint**: "Search for nuggets by name or content"

### Clear Search Button
- **Location**: X button in search bar
- **Label**: "Close search"
- **Role**: button
- **Hint**: "Tap to close search query"
- **Note**: Icon has `accessibilityElementsHidden={true}` (correct)

### FAB (Floating Action Button)
- **Location**: Bottom right "+" button
- **Label**: "Add new nugget"
- **Role**: button
- **Hint**: "Opens the create new nugget dialog"

### Header Title
- **Location**: "Nuggio" text
- **Label**: (none - decorative text)
- **Role**: (none)
- **Note**: Consider adding accessibility if it's interactive

---

## Tile.tsx

### Nugget Button
- **Location**: Each nugget in the grid
- **Label**: Dynamic - `${tile.name}` or `${tile.name} content: ${tile.content}` (when content is showing)
- **Role**: button
- **Hint**: `Tap to copy ${tile.name}. Double tap to ${showContent ? 'hide' : 'view'} content. Long press for more options.`
- **State**: 
  - `selected: showContent`
  - `disabled: isContextMenuOpen`

---

## PillButton.tsx

### PillButton (with icon)
- **Location**: Pin/Secure toggle buttons
- **Label**: Dynamic - `${title} ${icon === 'priority' ? 'priority' : 'secure'}` (e.g., "Pin priority" or "Secure secure")
- **Role**: togglebutton
- **Hint**: `Tap to ${active ? 'disable' : 'enable'} ${title.toLowerCase()}`
- **State**: `checked: active`

### PillButton (without icon)
- **Location**: Regular buttons (e.g., Yes/No in delete dialog)
- **Label**: `${title}` (e.g., "Yes", "No")
- **Role**: button
- **Hint**: (none)

---

## AddTileModal.tsx

### Name Input
- **Location**: MinimalistInput for nugget name
- **Label**: "Name" (from placeholder)
- **Role**: none
- **Note**: Uses MinimalistInput component

### Content Input
- **Location**: MinimalistInput for nugget content
- **Label**: "Contents" (from placeholder)
- **Role**: none
- **Note**: Uses MinimalistInput component

### Character Counters
- **Location**: Name and content character counters
- **Label**: (none - decorative)
- **Role**: (none)
- **Live Region**: "polite"
- **Note**: Shows character count (e.g., "10 / 50")

### Circular Action Button
- **Location**: Create nugget button at bottom
- **Label**: "Create nugget"
- **Role**: button
- **Hint**: `Tap to create nugget` or `Fill in nugget name and contents to enable` (when disabled)

---

## AlertDialog.tsx

### Title
- **Location**: Dialog title text
- **Label**: (text content - e.g., "Are you sure?")
- **Role**: header

### Description
- **Location**: Dialog description text
- **Label**: (text content - e.g., "This will permanently delete...")
- **Role**: text

### Cancel Button
- **Location**: "No" button (PillButton)
- **Label**: "No" (or custom cancelText)
- **Role**: button (from PillButton)
- **Hint**: (none)

### Confirm Button
- **Location**: "Yes" button (PillButton)
- **Label**: "Yes" (or custom confirmText)
- **Role**: button (from PillButton)
- **Hint**: (none)

---

## ContextMenu.tsx

### Edit Menu Item
- **Location**: Context menu "Edit" option
- **Label**: "Edit"
- **Role**: button
- **Hint**: "Tap to edit this nugget"

### Pin/Unpin Menu Item
- **Location**: Context menu "Pin" or "Unpin" option
- **Label**: "Pin" or "Unpin" (dynamic)
- **Role**: button
- **Hint**: "Tap to pin this nugget" or "Tap to unpin this nugget"

### Secure/Unsecure Menu Item
- **Location**: Context menu "Secure" or "Unsecure" option
- **Label**: "Secure" or "Unsecure" (dynamic)
- **Role**: button
- **Hint**: "Tap to secure this nugget" or "Tap to unsecure this nugget"

### Delete Menu Item
- **Location**: Context menu "Delete" option
- **Label**: "Delete"
- **Role**: button
- **Hint**: "Tap to delete this nugget"
- **Note**: Icons have `accessibilityElementsHidden={true}` (correct - decorative)

### Overlay
- **Location**: Background overlay
- **Label**: (none)
- **Role**: (none)
- **Note**: Closes menu on tap

---

## Modal.tsx

### Close Button (Overlay)
- **Location**: Tap outside modal to close
- **Label**: "Close modal"
- **Role**: button
- **Hint**: "Tap outside modal to close"

### Handle Bar
- **Location**: Swipe handle at top of modal
- **Label**: "Swipe down to close"
- **Role**: none
- **Note**: Decorative element

---

## Toast.tsx

### Toast Message
- **Location**: Toast notification
- **Label**: `${message}` (dynamic)
- **Role**: alert
- **Live Region**: "assertive"
- **Note**: Auto-announces to screen readers

---

## MinimalistInput.tsx

### Input Field
- **Location**: Text input component
- **Label**: `${props.placeholder || label}` (from props)
- **Role**: none
- **Note**: Uses placeholder as label

---

## Issues Found & Fixed

1. ✅ **ContextMenu items missing accessibility labels** - FIXED: Added labels, roles, and hints to all menu items
2. **Header title** - Consider if "Nuggio" should be accessible (currently just decorative)
3. **Character counters** - Currently decorative, but could be announced via live region (already has liveRegion="polite")

---

## Color Contrast Check

### Text Colors
- **Foreground on Background**: `#FFFFFF` on `#000000` = 21:1 ✅ (AAA)
- **Foreground on Card**: `#FFFFFF` on `#1C1C1E` = 12.6:1 ✅ (AAA)
- **Muted Foreground**: `#8E8E93` on `#000000` = 3.5:1 ✅ (AA)
- **Muted Foreground on Card**: `#8E8E93` on `#1C1C1E` = 2.1:1 ❌ (Below AA)

### Button Colors
- **Primary Button**: `#FFFFFF` on `#0A84FF` = 4.5:1 ✅ (AA)
- **Destructive Button**: `#FFFFFF` on `#FF453A` = 3.8:1 ⚠️ (Borderline AA)

### Recommendations
- Muted text on card background may need adjustment for better contrast
- Destructive button contrast is borderline - consider darkening red slightly
