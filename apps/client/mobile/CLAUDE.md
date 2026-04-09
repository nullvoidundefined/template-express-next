# Mobile Client Conventions

Auto-loaded when working in `apps/client/mobile/`. The root `../../../CLAUDE.md` non-negotiable rules still apply; these rules layer on top for mobile development. If a rule in this file and the root file appear to conflict, the root file wins and the conflict is a bug to file.

---

## Framework

**Use Expo (with Expo Router) for all mobile apps.** Expo is the required framework for this template. It targets iOS and Android from a single TypeScript codebase, with optional web output via React Native Web.

Why Expo over bare React Native:
- Managed workflow eliminates native build tooling for the majority of features.
- Expo Router provides file-system routing identical in concept to Next.js App Router, keeping the mental model consistent across web and mobile.
- EAS Build handles iOS and Android cloud builds without requiring local Xcode or Android Studio for CI.
- Expo SDK modules cover camera, notifications, secure storage, file system, and sensors without native module linking.
- OTA updates via EAS Update allow shipping JS fixes without an App Store review cycle.

Do not eject to bare workflow unless a native module is genuinely unavailable in the managed workflow. Ejection is a one-way door; treat it as a last resort and document the reason.

---

## Stack

- **Framework:** Expo (managed workflow) with Expo Router v3+.
- **Language:** TypeScript (strict mode). No `any`; use `unknown` and narrow.
- **UI:** React Native core components plus custom SCSS-equivalent styles via `StyleSheet.create`. No Tailwind (NativeWind is not used in this template; keep styling consistent with the web conventions where possible by using a design-token approach).
- **Navigation:** Expo Router (file-system routing). No React Navigation configured manually.
- **State:** React Context for app-wide concerns. TanStack Query for server state. `useState` for local UI state. No Redux or Zustand.
- **Storage:** `expo-secure-store` for sensitive data (tokens, credentials). `@react-native-async-storage/async-storage` for non-sensitive persisted data. Never use in-memory state for data that must survive an app restart.
- **Networking:** Same typed fetch wrapper pattern as the web client (`services/api.ts`). All API calls go through the wrapper; no raw `fetch` in components.
- **Package manager:** pnpm. Register in the monorepo as `apps/client/mobile`.

---

## Directory Structure

```
apps/client/mobile/
├── app.json                      # Expo app config (bundle ID, version, icon, splash)
├── app/                          # Expo Router file-system routes
│   ├── _layout.tsx               # Root layout (providers, fonts, navigation shell)
│   ├── index.tsx                 # Default route: redirects based on auth state
│   ├── (auth)/
│   │   ├── _layout.tsx           # Auth stack layout
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx           # Authenticated layout (auth-guarded)
│       └── dashboard.tsx
├── components/                   # Shared React Native components (per-folder rule)
│   └── Button/
│       ├── Button.tsx
│       └── Button.styles.ts      # StyleSheet.create styles
├── providers/                    # React context and provider components
│   └── QueryProvider.tsx         # TanStack Query client config + provider
├── services/                     # HTTP infrastructure
│   └── api.ts                    # Typed fetch wrapper (EXPO_PUBLIC_API_URL)
└── state/                        # State layer: hooks that own state + side-effects
    └── useAuth.ts                # Auth state (user, login, logout, register)
```

Rules:

- `app/` is Expo Router's magic directory. Files here become screens automatically.
- Route groups use parentheses: `(auth)`, `(app)`. Same convention as Next.js App Router.
- Each component gets its own folder: `ComponentName/ComponentName.tsx` plus `ComponentName.styles.ts`.
- No barrel `index.ts` files. Import directly from the file.
- Shared logic used by more than one screen lives in `services/` (HTTP), `state/` (hooks), or `providers/`, not inside screen files.

---

## Non-Negotiable Rules (Mobile-Specific)

These layer on top of the root non-negotiables in `../../CLAUDE.md`. If they conflict, root wins and file a bug.

1. **No inline styles.** All styles are defined in `StyleSheet.create` objects in co-located `.styles.ts` files. Inline style objects create a new object reference on every render and skip the native optimization layer.
2. **Design tokens for all visual values.** Colors, spacing, radii, and font sizes come from `constants/tokens.ts`. Never hardcode a hex value or pixel size directly in a component.
3. **TanStack Query for all server state.** No raw `useEffect` + `fetch` in components.
4. **Secure storage for credentials.** Tokens and session identifiers go in `expo-secure-store`. AsyncStorage is for non-sensitive preferences only.
5. **Named exports only.** No `export default`. Every file ends with an explicit `export { ComponentName }`.
6. **Expo Router only.** No manual React Navigation setup. All navigation is file-system driven.
7. **No platform-specific forks unless unavoidable.** When iOS and Android behavior must diverge, use `Platform.select` in a single file rather than creating `.ios.tsx` and `.android.tsx` siblings. File-level platform splits are a last resort.

---

## Component Patterns

File structure, top to bottom, in this exact order:

1. Imports (grouped, each group alphabetized: React/React Native, Expo, third-party, local, styles last)
2. Type definitions, alphabetized by type name, keys alphabetized inside each type
3. Constants and configuration objects, keys alphabetized
4. Pure helper functions (no hooks, no side effects)
5. The component function, destructured props alphabetized to match the type
6. `displayName` assignment
7. Named export statement

```typescript
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { styles } from './Button.styles';

type ButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function Button({ disabled, label, onPress }: ButtonProps) {
  const handlePress = useCallback(() => {
    if (!disabled) onPress();
  }, [disabled, onPress]);

  return (
    <Pressable
      accessibilityRole='button'
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}
      testID='button'
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

Button.displayName = 'Button';

export { Button };
```

Rules:

- Use `Pressable` instead of `TouchableOpacity` or `TouchableHighlight`. `Pressable` is the React Native team's recommended API and supports `pressed` state styling.
- Every interactive element sets `accessibilityRole` and `accessibilityLabel` (or `accessibilityLabel` falls back to visible text automatically for Text children).
- Every component's root element has a `testID` in kebab-case. This is the mobile equivalent of `data-test-id`.
- No `React.FC`. Plain function declarations with typed props.
- `useCallback` for event handlers passed to native components. Native components do a shallow prop comparison; unstable function references cause unnecessary re-renders.

---

## Styles

Co-locate styles in a `.styles.ts` file in the same folder as the component:

```typescript
// Button.styles.ts
import { StyleSheet } from 'react-native';
import { tokens } from '@/constants/tokens';

export const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radii.button,
    paddingHorizontal: tokens.spacing[7],
    paddingVertical: tokens.spacing[3],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    backgroundColor: tokens.colors.accentHover,
  },
  label: {
    color: tokens.colors.white,
    fontFamily: tokens.fonts.semibold,
    fontSize: tokens.fontSizes.body,
  },
});
```

Rules:

- All files export `styles` (always this name).
- Import as `import { styles } from './ComponentName.styles'`.
- Never use raw numbers or hex values in `.styles.ts`. Always reference `tokens`.
- Property ordering: layout (position, flex, width, height), spacing (margin, padding), border, background, typography, opacity, transform.
- camelCase property names (React Native standard).

---

## Design Tokens

Define all design tokens in `constants/tokens.ts`:

```typescript
// constants/tokens.ts
export const tokens = {
  colors: {
    accent: '#e8651a',
    accentHover: '#c85411',
    background: '#ffffff',
    border: '#ebebeb',
    foreground: '#222222',
    foregroundMuted: '#717171',
    surface: '#f7f7f7',
    white: '#ffffff',
  },
  fontSizes: {
    caption: 12,
    small: 13,
    body: 14,
    label: 15,
    subheading: 16,
    title: 28,
  },
  fonts: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  radii: {
    subtle: 4,
    standard: 8,
    button: 10,
    card: 12,
    pill: 20,
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
  },
} as const;
```

Rules:

- Token values match the web client's design tokens wherever the concepts overlap (same accent color, same spacing scale, same border radii). Visual consistency between web and mobile is a product requirement.
- Add new tokens to `tokens.ts` before using them. Never invent one-off values in `.styles.ts`.
- `as const` ensures token values are narrowed to their literal types, preventing accidental mutation.

---

## Navigation (Expo Router)

```
app/
├── _layout.tsx           # Root: load fonts, set up providers, Stack or Tabs shell
├── index.tsx             # Default route: redirect based on auth state
├── (auth)/
│   ├── _layout.tsx       # Auth stack (no tab bar)
│   ├── login.tsx
│   └── register.tsx
└── (app)/
    ├── _layout.tsx       # Authenticated tabs or stack
    └── dashboard.tsx
```

Navigation rules:

- Use `router.push`, `router.replace`, and `router.back` from `expo-router`. No React Navigation imperative API.
- Auth guard lives in `app/(app)/_layout.tsx`. Check auth state and redirect to `/(auth)/login` if unauthenticated.
- Deep links are handled automatically by Expo Router from the scheme set in `app.json`.
- Pass data between screens via route params for simple values, or via TanStack Query cache for server data. Never pass large objects through route params.

---

## API Calls

```typescript
// services/api.ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...init?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  del: (path: string) => apiFetch(path, { method: 'DELETE' }),
  get: <T>(path: string) => apiFetch<T>(path),
  patch: <T>(path: string, json: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(json) }),
  post: <T>(path: string, json: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(json) }),
};
```

Rules:

- `EXPO_PUBLIC_*` prefix exposes env vars to the client bundle. Set `EXPO_PUBLIC_API_URL` in `.env.local`.
- `X-Requested-With: XMLHttpRequest` is included for CSRF compliance with the backend.
- Components always use TanStack Query hooks. No direct `api` calls in `useEffect`.

---

## Accessibility

React Native exposes the platform's native accessibility tree. Every component must be usable with VoiceOver (iOS) and TalkBack (Android).

- Every interactive element has `accessibilityRole` (`button`, `link`, `checkbox`, etc.).
- Icon-only buttons include `accessibilityLabel` with a plain-language description.
- Images include `accessible={true}` and `accessibilityLabel` for decorative images, or `accessible={false}` for purely decorative ones.
- Form inputs include `accessibilityLabel` or `accessibilityLabelledBy`.
- Focus order follows the visual order. Use `accessibilityViewIsModal={true}` on modals to trap focus.
- Respect `useReduceMotion()` from `expo-haptics` / `react-native-reanimated` for users who have reduced motion enabled.

---

## Testing

- Vitest + React Native Testing Library for unit and component tests.
- Test files live in `__tests__/`, mirroring the source tree. See the root `CLAUDE.md` Testing Conventions section.
- Test behavior, not implementation. Query by `accessibilityRole` and `accessibilityLabel` (analogues of ARIA queries in RTL).
- E2E testing with Maestro for critical flows (auth, core CRUD). Maestro YAML flows live in `e2e/`.

---

## Build and Dev Commands

```bash
pnpm expo start             # Start Expo dev server (scan QR with Expo Go)
pnpm expo start --ios       # Open in iOS Simulator
pnpm expo start --android   # Open in Android Emulator
pnpm expo run:ios           # Native build + open in Simulator
pnpm expo run:android       # Native build + open in Emulator
pnpm eas build --platform ios      # Cloud build for iOS (EAS)
pnpm eas build --platform android  # Cloud build for Android (EAS)
pnpm eas update             # Push OTA JS update to existing installs
pnpm expo typecheck         # TypeScript check only
```

Add these as scripts in `apps/client/mobile/package.json`:

```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android",
    "update": "eas update",
    "typecheck": "expo typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest"
  }
}
```

---

## Security

- Never store tokens or session data in AsyncStorage. Use `expo-secure-store` which maps to Keychain (iOS) and Keystore (Android).
- Never log auth tokens, passwords, or personal data. Check all `console.log` calls before committing.
- `EXPO_PUBLIC_*` env vars are bundled into the app binary and are visible to anyone who inspects the bundle. Never put secrets here. Only public values like API base URLs belong in `EXPO_PUBLIC_*`.
- Secrets that must be available at build time (e.g., Sentry DSN, analytics keys) go in EAS Secrets, not in the repo.
