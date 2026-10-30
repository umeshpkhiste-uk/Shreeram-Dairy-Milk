import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { LoadingState } from '@/components/loading-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth/auth-provider';
import { Spacing } from '@/theme/tokens';

const logo = require('../../assets/images/logo.png');

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
    <Screen>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} contentFit="cover" />
        <Text variant="title">Shreeram Doodh Diary &amp; Sweets</Text>
        <Text variant="body" color="secondary">
          Quality &amp; Purity are our first priority.
        </Text>
        <Text variant="body" color="secondary">
          R9 Sector, Life Republic, Kolte Patil
        </Text>
        <Text variant="body" color="secondary">
          Sign in to continue.
        </Text>
      </View>

      <View style={styles.form}>
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
        Accounts are created by your administrator. There is no public sign-up — contact Shreeram
        Doodh Diary &amp; Sweets if you need access.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.xs },
  logo: { width: 56, height: 56, borderRadius: 8, marginBottom: Spacing.xs },
  form: { gap: Spacing.md },
  footnote: { textAlign: 'center', marginTop: 'auto' },
});
