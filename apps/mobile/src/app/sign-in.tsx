import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { Spacing } from '@/theme/tokens';

const logo = require('../../assets/images/logo.png');
const LOGO_SIZE = 160;

export default function SignInScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'loading') {
    return <LoadingState label="Loading…" />;
  }

  if (auth.status === 'signedIn') {
    return <Redirect href="/" />;
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await auth.signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.brandHalf}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Text variant="title" style={styles.centerText}>
            Shreeram Doodh Diary &amp; Sweets
          </Text>
          <Text variant="body" color="secondary" style={styles.centerText}>
            Quality &amp; Purity are our first priority.
          </Text>
          <Text variant="caption" color="secondary" style={styles.centerText}>
            R9 Sector, Life Republic, Kolte Patil
          </Text>
        </View>

        <View style={styles.formHalf}>
          <View style={styles.form}>
            <Text variant="body" color="secondary" style={styles.centerText}>
              Sign in to continue.
            </Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              error={error ?? undefined}
            />
            <Button
              label="Sign in"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              fullWidth
            />
          </View>

          <Text variant="caption" color="secondary" style={styles.footnote}>
            Accounts are created by your administrator. There is no public sign-up — contact
            Shreeram Doodh Diary &amp; Sweets if you need access.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 0, gap: 0 },
  flex: { flex: 1 },
  brandHalf: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, marginBottom: Spacing.sm },
  centerText: { textAlign: 'center' },
  formHalf: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  form: { gap: Spacing.md, justifyContent: 'center' },
  footnote: { textAlign: 'center' },
});
